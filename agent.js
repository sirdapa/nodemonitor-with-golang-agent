'use strict';

/**
 * ============================================================================
 * agent.js — Contoh agent monitoring
 * ----------------------------------------------------------------------------
 * Agent Node.js yang menggunakan package `systeminformation` untuk
 * mengumpulkan metrik sistem dan POST ke dashboard setiap 10 detik.
 *
 * Cara pakai:
 *   npm install systeminformation
 *   TOKEN=changeme DASHBOARD_URL=http://your-dashboard:3000 node agent.js
 * ============================================================================
 */

const si = require('systeminformation');
const os = require('os');

/**
 * URL dashboard tujuan.
 * @type {string}
 */
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

/**
 * Token autentikasi.
 * @type {string}
 */
const TOKEN = process.env.TOKEN || 'changeme';

/**
 * Interval pengiriman report (ms).
 * @type {number}
 */
const REPORT_INTERVAL_MS = 10 * 1000; // 10 detik

/**
 * Kumpulkan metrik sistem dan POST ke dashboard.
 *
 * @returns {Promise<void>}
 */
async function collectAndReport() {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const net = await si.networkStats();
    const docker = await si.dockerContainers().catch(() => []);

    // Ambil disk dan network interface pertama sebagai representasi.
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
        used: Math.round(mem.used / 1024 / 1024),       // MB
        total: Math.round(mem.total / 1024 / 1024),     // MB
        percent: Math.round((mem.used / mem.total) * 100),
      },
      disk: {
        used: Math.round(d.used / 1024 / 1024 / 1024),  // GB
        total: Math.round(d.size / 1024 / 1024 / 1024), // GB
        percent: Math.round(d.use || 0),
      },
      network: {
        rx: Math.round(n.rx_sec || 0),
        tx: Math.round(n.tx_sec || 0),
      },
      docker: {
        containers: docker.length,
        running: docker.filter((c) => c.state === 'running').length,
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

// Kirim langsung, lalu setiap interval.
collectAndReport();
setInterval(collectAndReport, REPORT_INTERVAL_MS);
