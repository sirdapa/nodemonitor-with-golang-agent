'use strict';

/**
 * ============================================================================
 * src/routes/dashboard.js — Dashboard route
 * ----------------------------------------------------------------------------
 * Melayani halaman dashboard single-page dari template string.
 * ============================================================================
 */

const express = require('express');
const DASHBOARD_HTML = require('../views/dashboard');
const { dashboardLimiter } = require('../middleware');

const router = express.Router();

/**
 * GET /
 *
 * Serve halaman dashboard.  Semua HTML, CSS, dan client JS embedded di
 * template string.
 */
router.get('/', dashboardLimiter, (req, res) => {
  res.type('html');
  res.send(DASHBOARD_HTML);
});

module.exports = router;
