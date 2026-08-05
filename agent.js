'use strict';

// Example Node.js agent (systeminformation) — collect metrics & POST every 10s.
//   npm install systeminformation
//   TOKEN=changeme DASHBOARD_URL=http://your-dashboard:3000 node agent.js
const si = require('systeminformation');
const os = require('os');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || 'changeme';
const REPORT_INTERVAL_MS = 10 * 1000;

async function collectAndReport() {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const net = await si.networkStats();
    const docker = await si.dockerContainers().catch(() => []);

    // Use first disk and network interface as the representative.
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

collectAndReport();
setInterval(collectAndReport, REPORT_INTERVAL_MS);
