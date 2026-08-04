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

/**
 * Buat dan konfigurasi Express application.
 *
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  // Pasang semua middleware (security, CORS, compression, logging, rate limit).
  setupMiddleware(app);

  // REST API routes.
  app.use('/api', apiRoutes);

  // Dashboard route (GET /).
  app.use('/', dashboardRoutes);

  return app;
}

module.exports = { createApp };
