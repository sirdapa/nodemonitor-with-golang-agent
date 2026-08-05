'use strict';

// Dashboard route (GET /) — serves the HTML template from views.
const express = require('express');
const DASHBOARD_HTML = require('../views/dashboard');
const { dashboardLimiter } = require('../middleware');
const { ensureAuth } = require('../auth');
const { getAgentToken } = require('../database');

const router = express.Router();

// Escape dangerous characters so the token is safe in an HTML text node.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Serve the dashboard page (behind auth). Agent token is injected server-side.
router.get('/', dashboardLimiter, ensureAuth, (req, res) => {
  const token = getAgentToken();
  res.type('html');
  res.send(DASHBOARD_HTML.replace(/__AGENT_TOKEN__/g, escapeHtml(token)));
});

module.exports = router;
