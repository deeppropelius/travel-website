/**
 * Jadoo Travel - Testimonial Service & Router
 * Handles retrieval and submission of customer travel reviews and stories.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { isUUID, generateUUID } from './authService.js';
const JWT_SECRET = process.env.JWT_SECRET || 'jadoo_super_secret_jwt_key_2026_travel_platform';
export const testimonialRouter = express.Router();
// GET /api/testimonials
testimonialRouter.get('/', async (req, res) => {
    try {
        const { user_id, customer_id, email, author_email } = req.query;
        if (user_id || customer_id) {
            const cid = String(user_id || customer_id);
            if (isUUID(cid)) {
                const { rows } = await pool.query('SELECT * FROM testimonials WHERE costumer_id = $1 ORDER BY created_at DESC', [cid]);
                return res.json(rows);
            }
            return res.json([]);
        }
        if (email || author_email) {
            const em = String(email || author_email);
            const { rows } = await pool.query(`
        SELECT t.* FROM testimonials t 
        LEFT JOIN customer c ON t.costumer_id = c.id 
        WHERE c.email ILIKE $1 
        ORDER BY t.created_at DESC
      `, [em]);
            return res.json(rows);
        }
        const { rows } = await pool.query('SELECT * FROM testimonials ORDER BY created_at DESC');
        res.json(rows);
    }
    catch (err) {
        console.error('GET /api/testimonials error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
// POST /api/testimonials
testimonialRouter.post('/', async (req, res) => {
    try {
        const t = req.body;
        const id = generateUUID();
        // Resolve customer_id safely against database foreign key
        let customerId = t.customer_id || t.costumer_id || t.user_id || null;
        if (customerId && !isUUID(customerId))
            customerId = null;
        if (customerId) {
            try {
                const check = await pool.query('SELECT id FROM customer WHERE id = $1 LIMIT 1', [customerId]);
                if (!check.rows.length)
                    customerId = null;
            }
            catch (_) {
                customerId = null;
            }
        }
        if (!customerId && (t.author_email || t.email)) {
            try {
                const email = t.author_email || t.email;
                const custRes = await pool.query('SELECT id FROM customer WHERE email ILIKE $1 LIMIT 1', [email]);
                if (custRes.rows.length)
                    customerId = custRes.rows[0].id;
            }
            catch (_) { }
        }
        // Check JWT from cookie or authorization header if not provided
        if (!customerId) {
            const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    if (decoded && decoded.id && isUUID(decoded.id)) {
                        customerId = decoded.id;
                    }
                }
                catch (_) { }
            }
        }
        // If customerId resolved, auto-fill author name from customer if omitted or default
        if (customerId && (!t.author_name || t.author_name === 'Traveler')) {
            try {
                const cust = await pool.query('SELECT full_name, email, avatar_url FROM customer WHERE id = $1', [customerId]);
                if (cust.rows.length) {
                    if (!t.author_name || t.author_name === 'Traveler')
                        t.author_name = cust.rows[0].full_name;
                    if (!t.avatar_url && cust.rows[0].avatar_url)
                        t.avatar_url = cust.rows[0].avatar_url;
                }
            }
            catch (_) { }
        }
        // Resolve destination_id
        let destinationId = t.destination_id || null;
        if (destinationId && !isUUID(destinationId))
            destinationId = null;
        const destName = t.destination_name || t.destination || 'Rome';
        if (!destinationId) {
            const destRes = await pool.query('SELECT id FROM destination WHERE name ILIKE $1 LIMIT 1', [destName]);
            if (destRes.rows.length)
                destinationId = destRes.rows[0].id;
        }
        const { rows } = await pool.query(`
      INSERT INTO testimonials
        (id, customer_id, costumer_id, destination_id, destination_name, author_name, author_location,
         role_title, quote, rating, avatar_url, trip_tag)
      VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`, [id, customerId, destinationId, destName,
            t.author_name || 'Traveler',
            t.author_location || 'Global Explorer',
            t.role_title || 'Verified Traveler',
            t.quote || '',
            parseFloat(t.rating) || 5.0,
            t.avatar_url || './assets/testimonials-avatar-1.png',
            t.trip_tag || (destName + ' Tour')]);
        res.status(201).json(rows[0]);
    }
    catch (err) {
        console.error('POST /api/testimonials error:', err);
        res.status(500).json({ error: 'Database error', details: String(err) });
    }
});
// PUT /api/testimonials/:id (Update existing review)
testimonialRouter.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const t = req.body;
        const ratingVal = t.rating !== undefined ? parseFloat(t.rating) : undefined;
        // Resolve customer/user ID for syncing safely against database foreign key
        let customerId = t.customer_id || t.costumer_id || t.user_id || null;
        if (customerId && !isUUID(customerId))
            customerId = null;
        if (customerId) {
            try {
                const check = await pool.query('SELECT id FROM customer WHERE id = $1 LIMIT 1', [customerId]);
                if (!check.rows.length)
                    customerId = null;
            }
            catch (_) {
                customerId = null;
            }
        }
        if (!customerId && (t.author_email || req.body.email)) {
            try {
                const email = t.author_email || req.body.email;
                const cust = await pool.query('SELECT id FROM customer WHERE email ILIKE $1 LIMIT 1', [email]);
                if (cust.rows.length)
                    customerId = cust.rows[0].id;
            }
            catch (_) { }
        }
        if (isUUID(id)) {
            const { rows } = await pool.query(`
        UPDATE testimonials
        SET 
          author_name = COALESCE($1, author_name),
          destination_name = COALESCE($2, destination_name),
          author_location = COALESCE($3, author_location),
          role_title = COALESCE($4, role_title),
          quote = COALESCE($5, quote),
          rating = COALESCE($6, rating),
          avatar_url = COALESCE($7, avatar_url),
          trip_tag = COALESCE($8, trip_tag),
          customer_id = COALESCE($9, customer_id),
          costumer_id = COALESCE($9, costumer_id),
          updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `, [
                t.author_name || null,
                t.destination_name || null,
                t.author_location || null,
                t.role_title || t.author_role || null,
                t.quote || null,
                !isNaN(ratingVal) ? ratingVal : null,
                t.avatar_url || null,
                t.trip_tag || null,
                customerId,
                id
            ]);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Review not found' });
            }
            return res.json(rows[0]);
        }
        else {
            return res.json({ id, ...t, updated_at: new Date().toISOString() });
        }
    }
    catch (err) {
        console.error('PUT /api/testimonials/:id error:', err);
        res.status(500).json({ error: 'Database error', details: String(err) });
    }
});
// DELETE /api/testimonials/:id (Remove review)
testimonialRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isUUID(id)) {
            const { rowCount } = await pool.query('DELETE FROM testimonials WHERE id = $1', [id]);
            if (rowCount === 0) {
                return res.status(404).json({ error: 'Review not found' });
            }
            return res.json({ success: true, id, message: 'Review deleted successfully' });
        }
        else {
            return res.json({ success: true, id, message: 'Review deleted successfully' });
        }
    }
    catch (err) {
        console.error('DELETE /api/testimonials/:id error:', err);
        res.status(500).json({ error: 'Database error', details: String(err) });
    }
});
