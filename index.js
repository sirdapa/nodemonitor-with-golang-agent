'use strict';

const { createApp } = require('./src/app');
const { PORT, SWEEP_INTERVAL_MS, DB_PATH, ROLLUP_INTERVAL_MS } = require('./src/config');
const store = require('./src/store');
const db = require('./src/database');

let httpServer;
let maintenanceInterval;

store.loadFromDb();
setInterval(store.sweepOffline, SWEEP_INTERVAL_MS);

// Run rollup before first prune so raw data isn't lost before aggregation,
// especially after long downtime periods.
db.runMaintenance();
maintenanceInterval = setInterval(db.runMaintenance, ROLLUP_INTERVAL_MS);

const app = createApp();

httpServer = app.listen(PORT, () => {
  console.log('┌──────────────────────────────────────────────┐');
  console.log('│  Node Monitor — VPS Dashboard                │');
  console.log('│  Listening on http://localhost:' + ('      ' + PORT).slice(-5) + '      │');
  console.log('│  Database: ' + ('      ' + DB_PATH).slice(-28) + '      │');
  console.log('│  Servers loaded: ' + ('   ' + store.serverCount()).slice(-3) + '                      │');
  console.log('└──────────────────────────────────────────────┘');
});

function shutdown() {
  console.log('Shutting down…');
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
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
