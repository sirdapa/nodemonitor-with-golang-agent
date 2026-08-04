'use strict';

/**
 * ============================================================================
 * src/routes/api.js — REST API routes
 * ----------------------------------------------------------------------------
 * Semua endpoint API: /api/report, /api/servers, /api/server/:hostname,
 * /api/stats, /api/health.
 * ============================================================================
 */

const express = require('express');
const store = require('../store');

const router = express.Router();

/**
 * POST /api/report
 *
 * Terima laporan metrik dari agent.  Server baru otomatis diregistrasi.
 * Server yang sudah ada diupdate.
 */
router.post('/report', (req, res) => {
  const err = store.validateReport(req.body);
  if (err) {
    return res.status(400).json({ error: err });
  }

  const ip = store.getClientIp(req);
  const result = store.processReport(req.body, ip);
  res.json(result);
});

/**
 * GET /api/servers
 *
 * Return semua server sebagai JSON array.
 */
router.get('/servers', (req, res) => {
  res.json(store.getAllServers());
});

/**
 * GET /api/server/:hostname
 *
 * Return satu server berdasarkan hostname.  404 jika tidak ditemukan.
 */
router.get('/server/:hostname', (req, res) => {
  const server = store.getServer(req.params.hostname);
  if (!server) {
    return res.status(404).json({ error: 'Server not found.' });
  }
  res.json(server);
});

/**
 * DELETE /api/server/:hostname
 *
 * Hapus server dari store dan database.  404 jika tidak ditemukan.
 */
router.delete('/server/:hostname', (req, res) => {
  const ok = store.deleteServer(req.params.hostname);
  if (!ok) {
    return res.status(404).json({ error: 'Server not found.' });
  }
  res.json({ ok: true, deleted: req.params.hostname });
});

/**
 * GET /api/stats
 *
 * Return statistik agregat semua server.
 */
router.get('/stats', (req, res) => {
  res.json(store.computeStats());
});

/**
 * GET /api/health
 *
 * Health-check endpoint sederhana.
 */
router.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), servers: store.serverCount() });
});

/**
 * 404 handler untuk route API yang tidak dikenal.
 */
router.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

module.exports = router;
