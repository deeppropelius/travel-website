/**
 * Jadoo Travel - Ticket Service & Router
 * Handles e-ticket, boarding pass QR verification, and online check-in.
 */

import express from 'express';
import { pool } from './db.js';
import { authenticateToken, isUUID, type AuthenticatedRequest } from './authService.js';

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

// POST /api/ticket/checkin
ticketRouter.post('/checkin', authenticateToken as any, async (req: AuthenticatedRequest, res: express.Response) => {
  const { booking_id, seat_number } = req.body || {};
  if (!booking_id) {
    return res.status(400).json({ error: 'booking_id is required' });
  }

  const assignedSeat = (typeof seat_number === 'string' && seat_number.trim())
    ? seat_number.trim().toUpperCase()
    : `${Math.floor(Math.random() * 28) + 1}${['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)]}`;

  try {
    const isIdUuid = isUUID(booking_id);
    const userEmail = req.user?.email || '';
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';

    const query = isIdUuid
      ? `UPDATE booking 
         SET is_boarded = true, 
             seat_number = COALESCE(NULLIF(seat_number, ''), $1),
             status = 'confirmed',
             updated_at = NOW()
         WHERE (id = $2::uuid OR booking_ref ILIKE $3)
           AND (customer_id = $4::uuid OR LOWER(user_email) = LOWER($5))
         RETURNING *`
      : `UPDATE booking 
         SET is_boarded = true, 
             seat_number = COALESCE(NULLIF(seat_number, ''), $1),
             status = 'confirmed',
             updated_at = NOW()
         WHERE booking_ref ILIKE $2
           AND (customer_id = $3::uuid OR LOWER(user_email) = LOWER($4))
         RETURNING *`;

    const params = isIdUuid
      ? [assignedSeat, booking_id, booking_id, userId, userEmail]
      : [assignedSeat, booking_id, userId, userEmail];

    const { rows } = await pool.query(query, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'Booking not found or not owned by user' });
    }

    res.json({
      success: true,
      message: 'Check-in completed successfully! Seat assigned: ' + (rows[0].seat_number || assignedSeat),
      booking: rows[0]
    });
  } catch (err: any) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to process online check-in', details: err.message });
  }
});
