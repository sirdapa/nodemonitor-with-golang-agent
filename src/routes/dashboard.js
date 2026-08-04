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
const { ensureAuth } = require('../auth');

const router = express.Router();

/**
 * GET /
 *
 * Serve halaman dashboard.  Semua HTML, CSS, dan client JS embedded di
 * template string.  Dilindungi oleh ensureAuth — redirect ke /login atau
 * /change-password bila perlu.
 */
router.get('/', dashboardLimiter, ensureAuth, (req, res) => {
  res.type('html');
  res.send(DASHBOARD_HTML);
});

module.exports = router;
