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
const { AUTH_TOKEN } = require('../config');

const router = express.Router();

/**
 * Escape karakter berbahaya agar token aman disuntikkan ke HTML text node.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET /
 *
 * Serve halaman dashboard.  Semua HTML, CSS, dan client JS embedded di
 * template string.  Dilindungi oleh ensureAuth — redirect ke /login atau
 * /change-password bila perlu.  Token agent disuntikkan secara server-side
 * (aman karena route ini sudah behind auth).
 */
router.get('/', dashboardLimiter, ensureAuth, (req, res) => {
  res.type('html');
  res.send(DASHBOARD_HTML.replace(/__AGENT_TOKEN__/g, escapeHtml(AUTH_TOKEN)));
});

module.exports = router;
