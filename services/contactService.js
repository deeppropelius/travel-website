/**
 * Jadoo Travel - Contact Service & Router
 * Handles customer inquiries, concierge support requests, and persistence in PostgreSQL.
 */
import express from 'express';
import { pool } from './db.js';
import { optionalAuth, generateUUID } from './authService.js';
export const contactRouter = express.Router();
/**
 * POST /api/contact
 * Traveler submits a general inquiry or bespoke request.
 */
contactRouter.post('/', optionalAuth, async (req, res) => {
    try {
        const { full_name, name, email, phone, subject, message } = req.body;
        const resolvedName = (full_name || name || (req.user?.full_name) || '').trim();
        const resolvedEmail = (email || (req.user?.email) || '').trim().toLowerCase();
        const resolvedPhone = (phone || '').trim();
        const resolvedSubject = (subject || 'General Inquiry').trim();
        const resolvedMessage = (message || '').trim();
        if (!resolvedName) {
            return res.status(400).json({ error: 'Full name is required.' });
        }
        if (!resolvedEmail || !resolvedEmail.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }
        if (!resolvedMessage || resolvedMessage.length < 5) {
            return res.status(400).json({ error: 'Please enter a message of at least 5 characters.' });
        }
        const id = generateUUID();
        const { rows } = await pool.query(`INSERT INTO contact_inquiries (id, full_name, email, phone, subject, message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'unread', NOW())
       RETURNING *`, [id, resolvedName, resolvedEmail, resolvedPhone || null, resolvedSubject, resolvedMessage]);
        res.status(201).json({
            success: true,
            message: `Thank you, ${resolvedName}! Your inquiry has been logged with reference #${id.slice(0, 8).toUpperCase()}. Our concierge team will reach out shortly.`,
            inquiry: rows[0]
        });
    }
    catch (err) {
        console.error('POST /api/contact error:', err);
        res.status(500).json({ error: 'Failed to record inquiry in database.' });
    }
});
/**
 * GET /api/contact
 * Retrieve inquiries (admin or current user's submitted inquiries)
 */
contactRouter.get('/', optionalAuth, async (req, res) => {
    try {
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({ error: 'Authentication required to view inquiries.' });
        }
        const { rows } = await pool.query('SELECT id, full_name, email, subject, status, created_at FROM contact_inquiries WHERE email ILIKE $1 ORDER BY created_at DESC', [email]);
        res.json(rows);
    }
    catch (err) {
        console.error('GET /api/contact error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
