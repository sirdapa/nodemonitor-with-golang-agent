'use strict';

/**
 * ============================================================================
 * node-monitor — Lightweight VPS Monitoring Dashboard (Entry Point)
 * ----------------------------------------------------------------------------
 * Aplikasi monitoring VPS ringan dengan dashboard real-time.
 *
 * Arsitektur modular:
 *   src/config.js             — Konfigurasi & env vars
 *   src/database.js           — Lapisan SQLite (node:sqlite bawaan Node.js)
 *   src/store.js              — In-memory cache & business logic
 *   src/middleware.js         — Setup middleware Express
 *   src/app.js                — Express app factory
 *   src/routes/api.js         — REST API routes
 *   src/routes/dashboard.js   — Dashboard route
 *   src/views/dashboard.js    — HTML template
 *
 * Run:
 *   npm install
 *   node index.js
 * ============================================================================
 */

const { createApp } = require('./src/app');
const { PORT, SWEEP_INTERVAL_MS, DB_PATH } = require('./src/config');
const store = require('./src/store');
const db = require('./src/database');

/**
 * HTTP server instance.
 * @type {import('http').Server}
 */
let httpServer;

// --- Inisialisasi: muat data dari SQLite ke memory cache -------------------
store.loadFromDb();

// --- Sweep timer: tandai server stale sebagai offline ----------------------
setInterval(store.sweepOffline, SWEEP_INTERVAL_MS);

// --- Start Express server --------------------------------------------------
const app = createApp();

httpServer = app.listen(PORT, () => {
  console.log('┌──────────────────────────────────────────────┐');
  console.log('│  Node Monitor — VPS Dashboard                │');
  console.log('│  Listening on http://localhost:' + ('      ' + PORT).slice(-5) + '      │');
  console.log('│  Database: ' + ('      ' + DB_PATH).slice(-28) + '      │');
  console.log('│  Servers loaded: ' + ('   ' + store.serverCount()).slice(-3) + '                      │');
  console.log('└──────────────────────────────────────────────┘');
});

// --- Graceful shutdown -----------------------------------------------------
/**
 * Tutup HTTP server dan database, lalu exit.
 * @returns {void}
 */
function shutdown() {
  console.log('Shutting down…');
  httpServer.close(() => {
    db.closeDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down…');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down…');
  shutdown();
});

/* ========================================================================== *
 * AGENT EXAMPLE
 * ----------------------------------------------------------------------------
 * Contoh agent Node.js yang menggunakan package `systeminformation` untuk
 * mengumpulkan metrik dan POST ke dashboard setiap 10 detik.
 *
 * Simpan sebagai agent.js, lalu:
 *   npm install systeminformation
 *   TOKEN=changeme DASHBOARD_URL=http://your-dashboard:3000 node agent.js
 * ========================================================================== */

/*
const si = require('systeminformation');
const os = require('os');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || 'changeme';

async function collectAndReport() {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const net = await si.networkStats();
    const docker = await si.dockerContainers().catch(() => []);

    const d = disk[0] || { used: 0, size: 0, use: 0 };
    const n = net[0] || { rx_sec: 0, tx_sec: 0 };

    const payload = {
      token: TOKEN,
      hostname: os.hostname(),
      os: os.type() + ' ' + os.release(),
      platform: os.platform(),
      uptime: os.uptime(),
      cpu: { usage: Math.round(cpu.currentLoad || 0) },
      memory: {
        used: Math.round(mem.used / 1024 / 1024),
        total: Math.round(mem.total / 1024 / 1024),
        percent: Math.round((mem.used / mem.total) * 100),
      },
      disk: {
        used: Math.round(d.used / 1024 / 1024 / 1024),
        total: Math.round(d.size / 1024 / 1024 / 1024),
        percent: Math.round(d.use || 0),
      },
      network: { rx: Math.round(n.rx_sec || 0), tx: Math.round(n.tx_sec || 0) },
      docker: {
        containers: docker.length,
        running: docker.filter(c => c.state === 'running').length,
      },
    };

    await fetch(DASHBOARD_URL + '/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[' + new Date().toISOString() + '] Reported to ' + DASHBOARD_URL);
  } catch (err) {
    console.error('Report failed:', err.message);
  }
}

collectAndReport();
setInterval(collectAndReport, 10 * 1000);
*/
