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
// ── Helpers ──────────────────────────────────────────────────
export function generateUUID() {
    return crypto.randomUUID();
}
export function isUUID(str) {
    if (typeof str !== 'string')
        return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}
export function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email, full_name: user.full_name || '' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
export function extractToken(req) {
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
            }
            catch (_) {
                return match[1];
            }
        }
    }
    return null;
}
export function authenticateToken(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Missing token.' });
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired authentication token.' });
        }
        req.user = decoded;
        next();
    });
}
export function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        }
        catch (_) {
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
        if (!email || !full_name)
            return res.status(400).json({ error: 'full_name and email are required' });
        // Check duplicate
        const exists = await pool.query('SELECT id FROM customer WHERE email ILIKE $1', [email]);
        if (exists.rows.length)
            return res.status(409).json({ error: 'Email already registered' });
        // Hash password securely with bcrypt
        let hashedPassword = null;
        if (password && typeof password === 'string' && password.trim().length > 0) {
            hashedPassword = await bcrypt.hash(password, 10);
        }
        const id = generateUUID();
        const { rows } = await pool.query(`
      INSERT INTO customer (id, full_name, email, password, phone, avatar_url, logged_in_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING id, full_name, email, phone, avatar_url, created_at, updated_at`, [id, full_name, email, hashedPassword, phone || null, avatar_url || null]);
        // Keep legacy users table in sync if it exists
        try {
            await pool.query(`INSERT INTO users (id, full_name, email, password, phone, avatar_url, logged_in_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()`, [id, full_name, email, hashedPassword, phone || null, avatar_url || null]);
        }
        catch (_) {
            // Non-fatal if users table is not active
        }
        const safeUser = rows[0];
        const token = generateToken(safeUser);
        const isSecure = process.env.NODE_ENV === 'production' || Boolean(process.env.DATABASE_URL?.includes('render.com'));
        res.setHeader('Set-Cookie', `jadoo_auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${isSecure ? '; Secure' : ''}`);
        res.status(201).json({
            ...safeUser,
            token,
            user: safeUser
        });
    }
    catch (err) {
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
        if (!identifier)
            return res.status(400).json({ error: 'Email, username, or ID is required' });
        let query = 'SELECT * FROM customer WHERE email ILIKE $1 OR full_name ILIKE $1';
        const params = [identifier];
        if (isUUID(identifier)) {
            query += ` OR id = $${params.length + 1}`;
            params.push(identifier);
        }
        query += ' LIMIT 1';
        const { rows } = await pool.query(query, params);
        if (!rows.length)
            return res.status(401).json({ error: 'Invalid credentials' });
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
            }
            else {
                // Plain text legacy fallback
                if (user.password === password) {
                    isValidPassword = true;
                    // Auto-upgrade legacy plaintext password to strong bcrypt hash in PostgreSQL
                    try {
                        const upgradedHash = await bcrypt.hash(password, 10);
                        await pool.query('UPDATE customer SET password = $1 WHERE id = $2', [upgradedHash, user.id]);
                        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [upgradedHash, user.id]).catch(() => { });
                    }
                    catch (upgradeErr) {
                        console.warn('Failed to upgrade password hash:', upgradeErr);
                    }
                }
            }
        }
        else {
            // Demo accounts without a password
            isValidPassword = true;
        }
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Update logged_in_at
        await pool.query('UPDATE customer SET logged_in_at=NOW() WHERE id=$1', [user.id]);
        await pool.query('UPDATE users SET logged_in_at=NOW() WHERE id=$1', [user.id]).catch(() => { });
        // Return user without password + signed JWT
        const { password: _pw, ...safeUser } = user;
        const token = generateToken(safeUser);
        const isSecure = process.env.NODE_ENV === 'production' || Boolean(process.env.DATABASE_URL?.includes('render.com'));
        res.setHeader('Set-Cookie', `jadoo_auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${isSecure ? '; Secure' : ''}`);
        res.json({
            ...safeUser,
            token,
            user: safeUser
        });
    }
    catch (err) {
        console.error('POST /api/auth/login error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
/**
 * GET /api/auth/me (Validates JWT)
 */
authRouter.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { rows } = await pool.query('SELECT id, full_name, email, phone, avatar_url, created_at, updated_at, logged_in_at FROM customer WHERE id::text = $1 LIMIT 1', [userId]);
        if (!rows.length)
            return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    }
    catch (err) {
        console.error('GET /api/auth/me error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
/**
 * GET /api/auth/profile
 */
authRouter.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows } = await pool.query('SELECT id, full_name, email, phone, avatar_url, created_at, updated_at, logged_in_at FROM customer WHERE id::text = $1 LIMIT 1', [userId]);
        if (!rows.length)
            return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    }
    catch (err) {
        console.error('GET /api/auth/profile error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
/**
 * PATCH /api/auth/profile
 * Strictly authenticated; users can only modify their own account.
 */
authRouter.patch('/profile', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { full_name, phone, avatar_url, password } = req.body;
        const sets = [];
        const params = [];
        if (full_name !== undefined) {
            const trimmed = String(full_name).trim();
            if (trimmed.length < 2 || trimmed.length > 80) {
                return res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
            }
            params.push(trimmed);
            sets.push(`full_name=$${params.length}`);
        }
        if (phone !== undefined) {
            const cleanPhone = phone ? String(phone).trim() : null;
            if (cleanPhone && !/^[\d\s+\-().]{6,25}$/.test(cleanPhone)) {
                return res.status(400).json({ error: 'Please enter a valid phone number (6-25 digits/symbols).' });
            }
            params.push(cleanPhone);
            sets.push(`phone=$${params.length}`);
        }
        if (avatar_url !== undefined) {
            const cleanUrl = avatar_url ? String(avatar_url).trim() : null;
            if (cleanUrl && cleanUrl.length > 2500000) {
                return res.status(400).json({ error: 'Avatar image is too large. Max size is 2MB.' });
            }
            params.push(cleanUrl);
            sets.push(`avatar_url=$${params.length}`);
        }
        if (password !== undefined && password !== '') {
            if (typeof password !== 'string' || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            params.push(hashedPassword);
            sets.push(`password=$${params.length}`);
        }
        if (!sets.length)
            return res.status(400).json({ error: 'No fields to update' });
        params.push(user.id);
        const { rows } = await pool.query(`UPDATE customer SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${params.length}
       RETURNING id, full_name, email, phone, avatar_url, updated_at`, params);
        if (!rows.length)
            return res.status(404).json({ error: 'User not found' });
        // Also sync to users table
        try {
            await pool.query(`UPDATE users SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${params.length}`, params);
        }
        catch (_) { }
        res.json(rows[0]);
    }
    catch (err) {
        console.error('PATCH /api/auth/profile error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (_req, res) => {
    res.setHeader('Set-Cookie', 'jadoo_auth_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.json({ success: true, message: 'Logged out successfully' });
});
