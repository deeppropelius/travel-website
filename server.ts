/**
 * Jadoo Travel – Express + PostgreSQL API Server
 *
 * Routes:
 *  GET  /api/health
 *  GET  /api/destinations
 *  GET  /api/destinations/:id
 *  GET  /api/attractions?destination=Rome&category=...
 *  GET  /api/bookings?email=...
 *  GET  /api/bookings/:id
 *  POST /api/bookings
 *  PATCH /api/bookings/:id/status
 *  GET  /api/testimonials
 *  POST /api/auth/register
 *  POST /api/auth/login
 *  GET  /api/auth/profile?email=...
 *  PATCH /api/auth/profile
 *  GET  /api/destination          (OpenTripMap proxy – existing)
 *  GET  /api/ticket/verify
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, testConnection } from './services/db.js';
import { fetchDestinationDetails } from './services/destinationService.js';
import { serveStaticFile } from './services/fileService.js';
import { ServiceService } from './services/serviceService.js';
import { createServer } from 'node:http';
import crypto from 'node:crypto';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'jadoo_super_secret_jwt_key_2026_travel_platform';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ── Types ────────────────────────────────────────────────────
export interface JwtUserPayload {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthenticatedRequest extends express.Request {
  user?: JwtUserPayload;
}

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Helpers ──────────────────────────────────────────────────
function generateUUID(): string {
  return crypto.randomUUID();
}

function generateBookingRef(): string {
  return 'BK-' + Math.floor(10000 + Math.random() * 90000);
}

function generateToken(user: { id: string; email: string; full_name?: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, full_name: user.full_name || '' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
}

function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  // Cookie fallback: jadoo_auth_token=...
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|; )jadoo_auth_token=([^;]*)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch (_) {
        return match[1];
      }
    }
  }
  return null;
}

function authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Missing token.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }
    req.user = decoded as JwtUserPayload;
    next();
  });
}

function optionalAuth(req: AuthenticatedRequest, _res: express.Response, next: express.NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
    } catch (_) {
      // Ignore invalid optional token
    }
  }
  next();
}

function makeRow(row: any) {
  return row;
}

// ══════════════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════════════
app.get('/api/health', async (_req, res) => {
  const ok = await testConnection();
  res.json({ status: ok ? 'ok' : 'error', db: ok ? 'connected' : 'unreachable', ts: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════════════
// DESTINATIONS
// ══════════════════════════════════════════════════════════════
app.get('/api/destinations', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM destination ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/destinations error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/destinations/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM destination WHERE id = $1 OR name ILIKE $2 LIMIT 1',
      [req.params.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Destination not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/destinations/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ══════════════════════════════════════════════════════════════
// ATTRACTIONS
// ══════════════════════════════════════════════════════════════
app.get('/api/attractions', async (req, res) => {
  try {
    const { destination, category } = req.query as Record<string, string>;
    let query = 'SELECT * FROM attraction';
    const params: any[] = [];
    const conditions: string[] = [];

    if (destination) {
      params.push(`%${destination}%`);
      conditions.push(`destination_name ILIKE $${params.length}`);
    }
    if (category && category !== 'All') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY rating DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/attractions error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ══════════════════════════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════════
app.get('/api/bookings', async (req, res) => {
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

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM booking WHERE id = $1 OR booking_ref ILIKE $2 LIMIT 1',
      [req.params.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/bookings/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

function isUUID(str: any): boolean {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

app.post('/api/bookings', authenticateToken, async (req: AuthenticatedRequest, res) => {
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
        (id, booking_ref, customer_id, destination_id, destination_name, attraction_name,
         user_name, user_email, phone_number, travel_date, guests_count, package_type,
         price_per_person, total_price, special_request, status, image_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [id, booking_ref, customerId, destinationId, destName, attrName,
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

app.patch('/api/bookings/:id/status', async (req, res) => {
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

// ══════════════════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════════════════
app.get('/api/services', (_req, res) => {
  const category = _req.query.category as string | undefined;
  if (category) {
    return res.json(ServiceService.getServicesByCategory(category));
  }
  res.json(ServiceService.getAllServices());
});

app.get('/api/services/:slug', (req, res) => {
  const service = ServiceService.getServiceBySlug(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

app.post('/api/services/inquire', (req, res) => {
  try {
    const { service_id, service_title, customer_name, customer_email, customer_phone, travel_destination, travel_date, message } = req.body;
    if (!service_id || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'service_id, customer_name, and customer_email are required' });
    }
    const record = ServiceService.recordInquiry({
      service_id,
      service_title: service_title || 'Jadoo Travel Service',
      customer_name,
      customer_email,
      customer_phone,
      travel_destination,
      travel_date,
      message
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('POST /api/services/inquire error:', err);
    res.status(500).json({ error: 'Server error processing service inquiry' });
  }
});

app.post('/api/services', (req, res) => {
  try {
    const serviceData = req.body;
    if (!serviceData || !serviceData.title) {
      return res.status(400).json({ error: 'Service title is required' });
    }
    const created = ServiceService.createService(serviceData);
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/services error:', err);
    res.status(500).json({ error: 'Server error creating service' });
  }
});

// ══════════════════════════════════════════════════════════════
// TESTIMONIALS
// ══════════════════════════════════════════════════════════════
app.get('/api/testimonials', async (req, res) => {
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
  } catch (err) {
    console.error('GET /api/testimonials error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/testimonials', async (req, res) => {
  try {
    const t = req.body;
    const id = generateUUID();

    // Resolve customer_id
    let customerId = t.customer_id || t.costumer_id || t.user_id || null;
    if (customerId && !isUUID(customerId)) customerId = null;

    if (!customerId && (t.author_email || t.email)) {
      const email = t.author_email || t.email;
      const custRes = await pool.query('SELECT id FROM customer WHERE email ILIKE $1 LIMIT 1', [email]);
      if (custRes.rows.length) customerId = custRes.rows[0].id;
    }

    // Check JWT from cookie or authorization header if not provided
    if (!customerId) {
      const token = (req.cookies as any)?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded && decoded.id && isUUID(decoded.id)) {
            customerId = decoded.id;
          }
        } catch (_) {}
      }
    }

    // If customerId resolved, auto-fill author name from customer if omitted or default
    if (customerId && (!t.author_name || t.author_name === 'Traveler')) {
      try {
        const cust = await pool.query('SELECT full_name, email, avatar_url FROM customer WHERE id = $1', [customerId]);
        if (cust.rows.length) {
          if (!t.author_name || t.author_name === 'Traveler') t.author_name = cust.rows[0].full_name;
          if (!t.avatar_url && cust.rows[0].avatar_url) t.avatar_url = cust.rows[0].avatar_url;
        }
      } catch (_) {}
    }

    // Resolve destination_id
    let destinationId = t.destination_id || null;
    if (destinationId && !isUUID(destinationId)) destinationId = null;

    const destName = t.destination_name || t.destination || 'Rome';
    if (!destinationId) {
      const destRes = await pool.query('SELECT id FROM destination WHERE name ILIKE $1 LIMIT 1', [destName]);
      if (destRes.rows.length) destinationId = destRes.rows[0].id;
    }

    const { rows } = await pool.query(`
      INSERT INTO testimonials
        (id, costumer_id, destination_id, destination_name, author_name, author_location,
         role_title, quote, rating, avatar_url, trip_tag)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [id, customerId, destinationId, destName,
       t.author_name || 'Traveler',
       t.author_location || 'Global Explorer',
       t.role_title || 'Verified Traveler',
       t.quote || '',
       parseFloat(t.rating) || 5.0,
       t.avatar_url || './assets/testimonials-avatar-1.png',
       t.trip_tag || (destName + ' Tour')]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/testimonials error:', err);
    res.status(500).json({ error: 'Database error', details: String(err) });
  }
});

// ══════════════════════════════════════════════════════════════
// AUTH – Register / Login / Profile / Session (Bcrypt + JWT)
// ══════════════════════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone, avatar_url } = req.body;
    if (!email || !full_name) return res.status(400).json({ error: 'full_name and email are required' });

    // Check duplicate
    const exists = await pool.query('SELECT id FROM customer WHERE email ILIKE $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    // Hash password securely with bcrypt
    let hashedPassword: string | null = null;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const id = generateUUID();
    const { rows } = await pool.query(`
      INSERT INTO customer (id, full_name, email, password, phone, avatar_url, logged_in_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING id, full_name, email, phone, avatar_url, created_at, updated_at`,
      [id, full_name, email, hashedPassword, phone || null, avatar_url || null]
    );

    const safeUser = rows[0];
    const token = generateToken(safeUser);

    // Set secure HTTP-only cookie for session storage
    res.setHeader(
      'Set-Cookie',
      `jadoo_auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    res.status(201).json({
      ...safeUser,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, username, id } = req.body;
    const identifier = (email || username || id || '').toString().trim();
    if (!identifier) return res.status(400).json({ error: 'Email, username, or ID is required' });

    let query = 'SELECT * FROM customer WHERE email ILIKE $1 OR full_name ILIKE $1';
    const params: any[] = [identifier];
    if (isUUID(identifier)) {
      query += ` OR id = $${params.length + 1}`;
      params.push(identifier);
    }
    query += ' LIMIT 1';

    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];

    // Password verification with bcrypt & transparent legacy plaintext upgrade
    let isValidPassword = false;
    if (user.password) {
      if (!password) {
        return res.status(401).json({ error: 'Password is required' });
      }

      // Check if stored password is a bcrypt hash ($2a$, $2b$, or $2y$)
      if (/^\$2[aby]\$\d{2}\$/.test(user.password)) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        // Plain text legacy fallback
        if (user.password === password) {
          isValidPassword = true;
          // Auto-upgrade legacy plaintext password to strong bcrypt hash in PostgreSQL
          try {
            const upgradedHash = await bcrypt.hash(password, 10);
            await pool.query('UPDATE customer SET password = $1 WHERE id = $2', [upgradedHash, user.id]);
          } catch (upgradeErr) {
            console.warn('Failed to upgrade password hash:', upgradeErr);
          }
        }
      }
    } else {
      // Demo accounts without a password
      isValidPassword = true;
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update logged_in_at
    await pool.query('UPDATE customer SET logged_in_at=NOW() WHERE id=$1', [user.id]);

    // Return user without password + signed JWT
    const { password: _pw, ...safeUser } = user;
    const token = generateToken(safeUser);

    // Set secure HTTP-only cookie for session storage
    res.setHeader(
      'Set-Cookie',
      `jadoo_auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    res.json({
      ...safeUser,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Authenticated current user endpoint (validates JWT)
app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { rows } = await pool.query(
      'SELECT id, full_name, email, phone, avatar_url, created_at, updated_at, logged_in_at FROM customer WHERE id::text = $1 LIMIT 1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/auth/profile', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    let { email, id } = req.query as Record<string, string>;
    if (!email && !id && req.user) {
      id = req.user.id;
      email = req.user.email;
    }
    if (!email && !id) return res.status(400).json({ error: 'email or id is required (or Authorization token)' });

    const { rows } = await pool.query(
      'SELECT id, full_name, email, phone, avatar_url, created_at, updated_at, logged_in_at FROM customer WHERE email ILIKE $1 OR id::text = $2 LIMIT 1',
      [email || '', id || '']
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/auth/profile error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/auth/profile', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    let { id, email, full_name, phone, avatar_url, password } = req.body;
    if (!id && !email && req.user) {
      id = req.user.id;
      email = req.user.email;
    }
    if (!id && !email) return res.status(400).json({ error: 'id or email is required' });

    const sets: string[] = [];
    const params: any[] = [];

    if (full_name) { params.push(full_name); sets.push(`full_name=$${params.length}`); }
    if (phone !== undefined) { params.push(phone); sets.push(`phone=$${params.length}`); }
    if (avatar_url !== undefined) { params.push(avatar_url); sets.push(`avatar_url=$${params.length}`); }
    if (password && typeof password === 'string' && password.trim().length > 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      params.push(hashedPassword);
      sets.push(`password=$${params.length}`);
    }

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(id || '');
    params.push(email || '');
    const { rows } = await pool.query(
      `UPDATE customer SET ${sets.join(',')} WHERE id=$${params.length - 1} OR email ILIKE $${params.length}
       RETURNING id, full_name, email, phone, avatar_url, updated_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/auth/profile error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Logout endpoint (clears HTTP-only session cookie)
app.post('/api/auth/logout', (_req, res) => {
  res.setHeader(
    'Set-Cookie',
    'jadoo_auth_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
  res.json({ success: true, message: 'Logged out successfully' });
});

// ══════════════════════════════════════════════════════════════
// LEGACY: OpenTripMap proxy  (existing functionality)
// ══════════════════════════════════════════════════════════════
app.get('/api/destination', async (req, res) => {
  const destination = req.query.name as string;
  const API_KEY = process.env.Open_Trip_Map;

  if (!destination) return res.status(400).json({ error: 'Destination name is required' });
  if (!API_KEY) return res.status(500).json({ error: 'OpenTripMap API key is missing in .env' });

  try {
    const data = await fetchDestinationDetails(destination);
    if (!data) return res.status(404).json({ error: `Destination "${destination}" not found` });
    res.json(data);
  } catch (err) {
    console.error('OpenTripMap proxy error:', err);
    res.status(502).json({ error: 'Failed to fetch destination data' });
  }
});

// ══════════════════════════════════════════════════════════════
// TICKET VERIFY (existing)
// ══════════════════════════════════════════════════════════════
app.get('/api/ticket/verify', async (req, res) => {
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

// ══════════════════════════════════════════════════════════════
// NEWSLETTER SUBSCRIPTION
// ══════════════════════════════════════════════════════════════
app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email.trim().toLowerCase()]
    );
    res.json({ success: true, message: 'Subscribed successfully to Jadoo updates!' });
  } catch (err) {
    console.error('POST /api/newsletter error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ══════════════════════════════════════════════════════════════
// STATIC FILE FALLBACK (serve HTML/CSS/JS/Assets)
// ══════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  if (serveStaticFile(req.url, res as any)) return;
  next();
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start ─────────────────────────────────────────────────────
const httpServer = createServer(app);

function listenOnPort(port: number) {
  httpServer.once('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${port} is already in use by another process.`);
      console.log(`   Retrying on port ${port + 1}...\n`);
      listenOnPort(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  httpServer.listen(port, () => {
    console.log(`\n🌍 Server running at http://localhost:${port}`);
    console.log(`   API docs: http://localhost:${port}/api/health\n`);
  });
}

async function start() {
  console.log('\n🚀 Jadoo Travel – Express + PostgreSQL Server\n');

  // Test DB connection
  const dbOk = await testConnection();
  if (dbOk) {
    console.log('✅ PostgreSQL connected successfully');
    console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}  DB: ${process.env.DB_NAME}`);
  } else {
    console.warn('⚠️  PostgreSQL is NOT reachable – check .env and make sure PostgreSQL is running.');
    console.warn('   The server will still start but DB endpoints will fail.');
  }

  listenOnPort(PORT);
}

start();

export { httpServer as server };
