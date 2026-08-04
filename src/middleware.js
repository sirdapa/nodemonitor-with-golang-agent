'use strict';

/**
 * ============================================================================
 * src/middleware.js — Setup middleware Express
 * ----------------------------------------------------------------------------
 * Semua konfigurasi middleware (security, CORS, compression, logging,
 * rate limiting) dipusatkan di sini.
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

/**
 * Pasang semua middleware ke Express app.
 *
 * @param {import('express').Express} app - Instance Express.
 * @returns {void}
 */
function setupMiddleware(app) {
  // --- Body parsing ---
  app.use(express.json({ limit: '64kb' }));

  // --- Security headers ---
  // Relax beberapa default helmet agar inline <script>/<style> di dashboard
  // tetap berfungsi.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.tailwindcss.com',
            'https://cdn.jsdelivr.net',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        },
      },
    })
  );

  // --- CORS ---
  app.use(cors());

  // --- Compression ---
  app.use(compression());

  // --- Request logging ---
  app.use(morgan('tiny'));

  // --- Rate limiting (global) ---
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  });
  app.use(globalLimiter);
}

/**
 * Rate limiter khusus untuk dashboard page (lebih ketat).
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many dashboard requests.',
});

module.exports = {
  setupMiddleware,
  dashboardLimiter,
};
