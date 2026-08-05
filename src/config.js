'use strict';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const MAX_HISTORY = 100;

const OFFLINE_TIMEOUT_MS = 30 * 1000;

const SWEEP_INTERVAL_MS = 5 * 1000;

const DB_PATH = process.env.DB_PATH || 'data/monitor.db';

// Raw sample retention for long-term history
const RAW_RETENTION_MS = 48 * 60 * 60 * 1000; // 48 hours

// Rollup retention for aggregated hourly data
const ROLLUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Rollup interval - run maintenance job every 10 minutes
const ROLLUP_INTERVAL_MS = 10 * 60 * 1000;

module.exports = {
  PORT,
  MAX_HISTORY,
  OFFLINE_TIMEOUT_MS,
  SWEEP_INTERVAL_MS,
  DB_PATH,
  RAW_RETENTION_MS,
  ROLLUP_RETENTION_MS,
  ROLLUP_INTERVAL_MS,
};
