/**
 * Jadoo Travel – Main Express Server
 * Modularized Architecture running cleanly on local dev and Render.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { testConnection } from './services/db.js';
import { serveStaticFile } from './services/fileService.js';
import { authRouter } from './services/authService.js';
import { bookingRouter } from './services/bookingService.js';
import { destinationRouter } from './services/destinationService.js';
import { serviceRouter } from './services/serviceService.js';
import { testimonialRouter } from './services/testimonialService.js';
import { ticketRouter } from './services/ticketService.js';
import { newsletterRouter } from './services/newsletterService.js';

export const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Global Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', async (_req, res) => {
  const dbOk = await testConnection();
  res.json({
    status: 'ok',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    env: process.env.NODE_ENV || 'development'
  });
});

// Mount Modular Service Routers
app.use('/api/auth', authRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/services', serviceRouter);
app.use('/api/testimonials', testimonialRouter);
app.use('/api/ticket', ticketRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api', destinationRouter); // /api/destinations, /api/destinations/:id, /api/attractions, /api/destination

// Static Assets & Web Pages Fallback
app.use((req, res, next) => {
  if (serveStaticFile(req.url, res as any)) return;
  next();
});

// 404 Handler for Unmatched API / Static Routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Server Initialization
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
