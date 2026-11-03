/**
 * Jadoo Travel - Booking Service & Router
 * Manages trip bookings, reservations, status changes, service attachments, and traveler manifests.
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
 * Authenticated traveler retrieves their bookings list.
 * Query filters: status
 */
bookingRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { status } = req.query as Record<string, string>;
    
    let query = 'SELECT * FROM booking WHERE (user_email ILIKE $1 OR customer_id = $2)';
    const params: any[] = [user.email, user.id];

    if (status && status !== 'all') {
      params.push(status.toLowerCase());
      query += ` AND LOWER(status) = $${params.length}`;
    }
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
 * Retrieve a single booking by ID or Reference.
 * Enforces ownership check to prevent IDOR.
 */
bookingRouter.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const bookingId = req.params.id;

    const { rows } = await pool.query(
      'SELECT * FROM booking WHERE id::text = $1 OR booking_ref ILIKE $2 LIMIT 1',
      [bookingId, bookingId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // Ownership verification
    const isOwner =
      String(booking.customer_id).toLowerCase() === String(user.id).toLowerCase() ||
      String(booking.user_email).toLowerCase() === String(user.email).toLowerCase();

    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied. You can only view your own bookings.' });
    }

    res.json(booking);
  } catch (err) {
    console.error('GET /api/bookings/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Update booking status (e.g. cancelled, confirmed, pending).
 * Enforces ownership and strictly validates status.
 */
bookingRouter.patch('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const bookingId = req.params.id;
    const rawStatus = (req.body.status || '').toString().toLowerCase().trim();

    const VALID_STATUSES = new Set(['pending', 'confirmed', 'cancelled']);
    if (!VALID_STATUSES.has(rawStatus)) {
      return res.status(400).json({
        error: `Invalid status "${rawStatus}". Must be one of: pending, confirmed, cancelled.`
      });
    }

    const { rows } = await pool.query(
      `UPDATE booking 
       SET status = $1, updated_at = NOW() 
       WHERE (id::text = $2 OR booking_ref ILIKE $2) 
         AND (customer_id = $3 OR user_email ILIKE $4) 
       RETURNING *`,
      [rawStatus, bookingId, user.id, user.email]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Booking not found or you do not have permission to modify this booking.'
      });
    }

    res.json({
      success: true,
      message: `Booking #${rows[0].booking_ref || rows[0].id} status updated to ${rawStatus}.`,
      booking: rows[0]
    });
  } catch (err) {
    console.error('PATCH /api/bookings/:id/status error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Cancels / removes a booking owned by the caller.
 */
bookingRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const bookingId = req.params.id;

    const { rows } = await pool.query(
      `UPDATE booking 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE (id::text = $1 OR booking_ref ILIKE $1) 
         AND (customer_id = $2 OR user_email ILIKE $3) 
       RETURNING id, booking_ref, status`,
      [bookingId, user.id, user.email]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Booking not found or you do not have permission to cancel this booking.'
      });
    }

    res.json({
      success: true,
      message: `Booking #${rows[0].booking_ref || rows[0].id} has been cancelled.`,
      booking: rows[0]
    });
  } catch (err) {
    console.error('DELETE /api/bookings/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /api/bookings
 * Create a new trip booking in PostgreSQL.
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
    const todayStr = new Date().toISOString().split('T')[0];
    if (travelDate < todayStr) {
      return res.status(400).json({ error: 'Travel date cannot be in the past. Please select today or a future date.' });
    }
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
 * POST /api/bookings/:id/services
 * Attach a concierge service directly to this booking in PostgreSQL.
 */
bookingRouter.post('/:id/services', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const bookingId = req.params.id;
    const { service_id, service_title, category, price, notes } = req.body;

    const { rows: bRows } = await pool.query(
      `SELECT * FROM booking 
       WHERE (id::text = $1 OR booking_ref ILIKE $1)
         AND (customer_id = $2 OR user_email ILIKE $3)
       LIMIT 1`,
      [bookingId, user.id, user.email]
    );

    if (!bRows.length) {
      return res.status(404).json({ error: 'Booking not found or access denied.' });
    }
    const booking = bRows[0];

    let currentServices: any[] = [];
    if (Array.isArray(booking.booked_services)) {
      currentServices = booking.booked_services;
    } else if (typeof booking.booked_services === 'string' && booking.booked_services.trim()) {
      try {
        currentServices = JSON.parse(booking.booked_services);
      } catch (_) {
        currentServices = [];
      }
    }

    const addPrice = parseFloat(price || '0') || 0;
    const title = service_title || 'Concierge Service';
    const newEntry = {
      id: service_id || `srv-${Date.now()}`,
      service_id: service_id || null,
      title,
      category: category || 'Concierge',
      price: addPrice,
      notes: notes ? String(notes).trim() : '',
      attached_at: new Date().toISOString()
    };
    currentServices.push(newEntry);

    const newTotal = (parseFloat(booking.total_price || '0') || 0) + addPrice;

    const { rows: updated } = await pool.query(`
      UPDATE booking 
      SET booked_services = $1::jsonb, total_price = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [JSON.stringify(currentServices), newTotal, booking.id]);

    res.json({
      success: true,
      message: `Attached "${title}" to booking ${booking.booking_ref || booking.id}`,
      booking: updated[0],
      attached_service: newEntry
    });
  } catch (err) {
    console.error('POST /api/bookings/:id/services error:', err);
    res.status(500).json({ error: 'Database error', details: String(err) });
  }
});
