/**
 * Jadoo Travel - Newsletter Service & Router
 * Handles newsletter subscription and subscriber persistence.
 */

import express from 'express';
import { pool } from './db.js';

export const newsletterRouter = express.Router();

// POST /api/newsletter
newsletterRouter.post('/', async (req, res) => {
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

