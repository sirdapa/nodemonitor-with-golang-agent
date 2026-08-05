'use strict';

// REST API: /api/report, /api/servers, /api/server/:hostname, /api/stats, /api/health.
const express = require('express');
const store = require('../store');
const db = require('../database');
const { getAgentToken, regenerateAgentToken } = require('../database');
const { ensureAuth } = require('../auth');

const router = express.Router();

// Accept agent metric reports (register new / update existing).
router.post('/report', (req, res) => {
  const err = store.validateReport(req.body);
  if (err) {
    return res.status(400).json({ error: err });
  }

  const ip = store.getClientIp(req);
  const result = store.processReport(req.body, ip);
  res.json(result);
});

// All servers as a JSON array.
router.get('/servers', (req, res) => {
  res.json(store.getAllServers());
});

// Single server by hostname; 404 when missing.
router.get('/server/:hostname', (req, res) => {
  const server = store.getServer(req.params.hostname);
  if (!server) {
    return res.status(404).json({ error: 'Server not found.' });
  }
  res.json(server);
});

// Delete a server from store + DB; 404 when missing.
router.delete('/server/:hostname', (req, res) => {
  const ok = store.deleteServer(req.params.hostname);
  if (!ok) {
    return res.status(404).json({ error: 'Server not found.' });
  }
  res.json({ ok: true, deleted: req.params.hostname });
});

// Aggregate stats across all servers.
router.get('/stats', (req, res) => {
  res.json(store.computeStats());
});

// Simple health check.
router.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), servers: store.serverCount() });
});

// Get current agent token (requires authentication).
router.get('/token', ensureAuth, (req, res) => {
  const token = getAgentToken();
  res.json({ ok: true, token });
});

// Regenerate agent token (requires authentication). All existing agents will lose connection.
router.post('/token/refresh', ensureAuth, (req, res) => {
  try {
    const newToken = regenerateAgentToken();
    res.json({ ok: true, token: newToken });
  } catch (err) {
    res.status(500).json({ error: 'Failed to regenerate token.' });
  }
});

// Get historical data for a server with time range selection.
router.get('/server/:hostname/history', (req, res) => {
  const hostname = req.params.hostname;
  const range = req.query.range || '24h';
  
  // Validate range parameter
  const validRanges = ['today', '24h', '7d', '30d', '60d'];
  if (!validRanges.includes(range)) {
    return res.status(400).json({ error: 'Invalid range. Use: today, 24h, 7d, 30d, 60d' });
  }
  
  // Check if server exists
  const server = store.getServer(hostname);
  if (!server) {
    return res.status(404).json({ error: 'Server not found.' });
  }
  
  // Calculate time range
  const now = Date.now();
  let sinceMs;
  let useRollup = false;
  
  switch (range) {
    case 'today':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      sinceMs = today.getTime();
      useRollup = false;
      break;
    case '24h':
      sinceMs = now - 24 * 60 * 60 * 1000;
      useRollup = false;
      break;
    case '7d':
      sinceMs = now - 7 * 24 * 60 * 60 * 1000;
      useRollup = true;
      break;
    case '30d':
      sinceMs = now - 30 * 24 * 60 * 60 * 1000;
      useRollup = true;
      break;
    case '60d':
      sinceMs = now - 60 * 24 * 60 * 60 * 1000;
      useRollup = true;
      break;
  }
  
  // Get historical data from database
  const points = db.getHistoryRange(hostname, sinceMs, useRollup);
  
  res.json({
    hostname,
    range,
    points,
  });
});

// 404 for unknown API routes.
router.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

module.exports = router;
