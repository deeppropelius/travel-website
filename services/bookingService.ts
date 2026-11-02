/**
 * Jadoo Travel - Booking Service & Router
 * Manages trip bookings, reservations, status changes, and traveler manifests.
 */

import express from 'express';
import { pool } from './db.js';
import { authenticateToken, AuthenticatedRequest, isUUID, generateUUID } from './authService.js';

export function generateBookingRef(): string {
  return 'BK-' + Math.floor(10000 + Math.random() * 90000);
}

export const bookingRouter = express.Router();

/**
 * GET /api/bookings
 * Query filters: email, customer_id, status
 */
bookingRouter.get('/', async (req, res) => {
  try {
    const { email, customer_id, status } = req.query as Record<string, string>;
    let query = 'SELECT * FROM booking';
    const params: any[] = [];
    const conditions: string[] = [];

    if (email && customer_id) {
      params.push(email);
      params.push(customer_id);
      conditions.push(`(user_email ILIKE $${params.length - 1} OR customer_id = $${params.length})`);
    } else if (email) {
      params.push(email);
      conditions.push(`user_email ILIKE $${params.length}`);
    } else if (customer_id) {
      params.push(customer_id);
      conditions.push(`customer_id = $${params.length}`);
    }
    if (status && status !== 'all') {
      params.push(status.toLowerCase());
      conditions.push(`LOWER(status) = $${params.length}`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/bookings error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/bookings/:id
 */
bookingRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM booking WHERE id::text = $1 OR booking_ref ILIKE $2 LIMIT 1',
      [req.params.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/bookings/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /api/bookings
 */
bookingRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const b = req.body;
    const id = generateUUID();
    const booking_ref = b.booking_ref || b.bookingReference || b.bookingRef || generateBookingRef();

    const userEmail = (req.user?.email || b.user_email || b.userEmail || '').trim().toLowerCase();
    const userName = (req.user?.full_name || b.user_name || b.userName || '').trim() || 'Traveler';
    let customerId = req.user?.id || b.customer_id || b.userId || null;

    if (!userEmail || !customerId) {
      return res.status(401).json({ error: 'Authentication required. Please log in to book a trip.' });
    }

    const phoneNumber = (b.phone_number || b.phone || b.phoneNumber || '').trim();
    const destName = (b.destination_name || b.destination || '').trim() || 'Rome';
    const attrName = (b.attraction_name || b.placeName || b.attraction || '').trim() || (destName + ' Tour');
    const travelDate = b.travel_date || b.travelDate || new Date().toISOString().split('T')[0];
    const guestsCount = parseInt(b.guests_count || b.guests || '1', 10) || 1;

    // Normalize package_type
    const rawPkg = (b.package_type || b.packageType || 'standard').toString().toLowerCase();
    const packageType = rawPkg.includes('vip') ? 'VIP' : rawPkg.includes('lux') ? 'luxury' : 'standard';

    // Normalize status
    const rawStatus = (b.status || 'confirmed').toString().toLowerCase();
    const status = rawStatus === 'pending' ? 'pending' : rawStatus === 'cancelled' ? 'cancelled' : 'confirmed';

    const pricePerPerson = parseFloat(b.price_per_person || b.pricePerPerson || '0') || 0;
    const totalPrice = parseFloat(b.total_price || b.totalPrice || '0') || (pricePerPerson * guestsCount);
    const specialRequest = b.special_request || b.specialRequests || '';
    const imageUrl = b.image_url || b.image || null;

    // Verify customer exists in PostgreSQL
    if (!isUUID(customerId)) {
      const custCheck = await pool.query('SELECT id FROM customer WHERE email ILIKE $1 LIMIT 1', [userEmail]);
      if (custCheck.rows.length) {
        customerId = custCheck.rows[0].id;
      } else {
        return res.status(401).json({ error: 'Customer account not found. Please log in.' });
      }
    }

    // Resolve destination in PostgreSQL
    let destinationId = b.destination_id || b.destinationId || null;
    if (!destinationId || !isUUID(destinationId)) {
      const destCheck = await pool.query('SELECT id FROM destination WHERE name ILIKE $1 LIMIT 1', [destName]);
      if (destCheck.rows.length) {
        destinationId = destCheck.rows[0].id;
      } else {
        const firstDest = await pool.query('SELECT id, name FROM destination LIMIT 1');
        if (firstDest.rows.length) {
          destinationId = firstDest.rows[0].id;
        } else {
          const newDestId = generateUUID();
          await pool.query(
            'INSERT INTO destination (id, name, country, latitude, longitude) VALUES ($1, $2, $3, $4, $5)',
            [newDestId, destName, 'International', 0, 0]
          );
          destinationId = newDestId;
        }
      }
    }

    const { rows } = await pool.query(`
      INSERT INTO booking
        (id, booking_ref, name, customer_id, destination_id, destination_name, attraction_name,
         user_name, user_email, phone_number, travel_date, guests_count, package_type,
         price_per_person, total_price, special_request, status, image_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [id, booking_ref, attrName, customerId, destinationId, destName, attrName,
       userName, userEmail, phoneNumber, travelDate,
       guestsCount, packageType, pricePerPerson, totalPrice,
       specialRequest, status, imageUrl]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/bookings error:', err);
    res.status(500).json({ error: 'Database error', details: String(err) });
  }
});

/**
 * PATCH /api/bookings/:id/status
 */
bookingRouter.patch('/:id/status', async (req, res) => {
  try {
    const rawStatus = (req.body.status || '').toLowerCase();
    const status = rawStatus === 'pending' ? 'pending' : rawStatus === 'cancelled' ? 'cancelled' : rawStatus === 'confirmed' ? 'confirmed' : null;
    if (!status) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query(
      'UPDATE booking SET status=$1 WHERE id::text=$2 OR booking_ref ILIKE $3 RETURNING *',
      [status, req.params.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/bookings/:id/status error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

