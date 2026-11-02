/**
 * Jadoo Travel - Auth Service & Router
 * Handles user registration, login, JWT issuance, profile updates, and authentication middleware.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { pool } from './db.js';

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

// ── Helpers ──────────────────────────────────────────────────
export function generateUUID(): string {
  return crypto.randomUUID();
}

export function isUUID(str: any): boolean {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export function generateToken(user: { id: string; email: string; full_name?: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, full_name: user.full_name || '' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
}

export function extractToken(req: express.Request): string | null {
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

export function authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
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

export function optionalAuth(req: AuthenticatedRequest, _res: express.Response, next: express.NextFunction) {
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

// ── Router ───────────────────────────────────────────────────
export const authRouter = express.Router();

/**
 * POST /api/auth/register
 */
authRouter.post('/register', async (req, res) => {
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

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req, res) => {
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

/**
 * GET /api/auth/me (Validates JWT)
 */
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

/**
 * GET /api/auth/profile
 */
authRouter.get('/profile', optionalAuth, async (req: AuthenticatedRequest, res) => {
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

/**
 * PATCH /api/auth/profile
 */
authRouter.patch('/profile', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    let { id, email, full_name, phone, avatar_url, password } = req.body;
    // Security enhancement: if authenticated, enforce user's own id/email to prevent IDOR
    if (req.user) {
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

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (_req, res) => {
  res.setHeader(
    'Set-Cookie',
    'jadoo_auth_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
  res.json({ success: true, message: 'Logged out successfully' });
});

