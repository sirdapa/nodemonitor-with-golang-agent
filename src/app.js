'use strict';

/**
 * ============================================================================
 * src/app.js — Express application setup
 * ----------------------------------------------------------------------------
 * Membuat dan mengkonfigurasi Express app: middleware, routes, dan
 * error handling.  Dipisah dari index.js agar mudah di-test.
 * ============================================================================
 */

const express = require('express');
const { setupMiddleware } = require('./middleware');
const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

/**
 * Buat dan konfigurasi Express application.
 *
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  // Pasang semua middleware (security, CORS, compression, logging, rate limit).
  setupMiddleware(app);

  // Auth routes (login, change-password, logout) — harus sebelum dashboard
  // agar halaman /login & /change-password bisa diakses tanpa session.
  app.use('/', authRoutes);

  // REST API routes.
  app.use('/api', apiRoutes);

  // Dashboard route (GET /).
  app.use('/', dashboardRoutes);

  return app;
}

module.exports = { createApp };
