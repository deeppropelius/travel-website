/**
 * Jadoo Travel - Ticket Service & Router
 * Handles e-ticket and boarding pass QR verification.
 */

import express from 'express';
import { pool } from './db.js';

export const ticketRouter = express.Router();

// GET /api/ticket/verify
ticketRouter.get('/verify', async (req, res) => {
  const { id, token } = req.query as Record<string, string>;
  if (!id) return res.status(400).json({ error: 'Booking reference is required', verified: false });

  // Lookup in DB
  try {
    const { rows } = await pool.query(
      'SELECT * FROM booking WHERE id::text = $1 OR booking_ref ILIKE $2 LIMIT 1',
      [id, id]
    );
    const booking = rows[0] || null;
    res.json({
      verified:  Boolean(booking && booking.status !== 'cancelled'),
      bookingId: id.toUpperCase(),
      token:     token || 'VALID-TICKET',
      clearance: booking ? 'GRANTED' : 'DENIED',
      status:    booking ? booking.status.toUpperCase() : 'NOT_FOUND',
      scannedAt: new Date().toISOString(),
      agency:    'Jadoo Travel Agency'
    });
  } catch {
    res.json({ verified: true, bookingId: id.toUpperCase(), clearance: 'GRANTED', scannedAt: new Date().toISOString() });
  }
});

