'use strict';

/**
 * ============================================================================
 * src/config.js — Konfigurasi aplikasi
 * ----------------------------------------------------------------------------
 * Semua konstanta dan environment variables dikumpulkan di satu tempat.
 * ============================================================================
 */

/**
 * Port untuk dashboard. Default 3000, bisa override via env PORT.
 * @type {number}
 */
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * Token autentikasi yang harus dikirim agent di setiap POST /api/report.
 * Set via env TOKEN di production.
 * @type {string}
 */
const AUTH_TOKEN = process.env.TOKEN || 'changeme';

/**
 * Jumlah maksimum sample history per server untuk chart.
 * Dibatasi agar memory tetap stabil meski monitoring 1000+ server.
 * @type {number}
 */
const MAX_HISTORY = 100;

/**
 * Server dianggap offline jika tidak ada report dalam waktu ini (ms).
 * @type {number}
 */
const OFFLINE_TIMEOUT_MS = 30 * 1000; // 30 detik

/**
 * Interval sweep untuk menandai server yang offline.
 * @type {number}
 */
const SWEEP_INTERVAL_MS = 5 * 1000; // setiap 5 detik

/**
 * Path file database SQLite. Override via env DB_PATH.
 * Default: data/monitor.db (relative ke project root).
 * @type {string}
 */
const DB_PATH = process.env.DB_PATH || 'data/monitor.db';

module.exports = {
  PORT,
  AUTH_TOKEN,
  MAX_HISTORY,
  OFFLINE_TIMEOUT_MS,
  SWEEP_INTERVAL_MS,
  DB_PATH,
};
