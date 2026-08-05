'use strict';

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

function setupMiddleware(app) {
  app.use(express.json({ limit: '64kb' }));

  // Relaxed CSP to allow inline <script>/<style> and CDNs.
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
          // Inline event handlers are intentionally blocked; use addEventListener.
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        },
      },
    })
  );

  app.use(cors());
  app.use(compression());
  app.use(morgan('tiny'));

  // Global rate limit: 300 req/min.
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  });
  app.use(globalLimiter);
}

// Dashboard page rate limiter: 120 req/min.
const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many dashboard requests.',
});

// Login rate limiter: 10 req/min — brute-force protection.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
});

module.exports = {
  setupMiddleware,
  dashboardLimiter,
  loginLimiter,
};
