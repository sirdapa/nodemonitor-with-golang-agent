'use strict';

/**
 * ============================================================================
 * src/database.js — Lapisan database SQLite
 * ----------------------------------------------------------------------------
 * Mengelola koneksi SQLite (node:sqlite — modul bawaan Node.js), schema,
 * prepared statements, dan operasi persistensi.  Semua query SQL dipusatkan
 * di sini.
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH, MAX_HISTORY } = require('./config');
const auth = require('./auth');

/**
 * Default password untuk login dashboard pertama kali.
 * User akan dipaksa mengganti password setelah login pertama.
 * @type {string}
 */
const DEFAULT_PASSWORD = '123456';

/**
 * Key untuk tabel settings.
 */
const SETTINGS = {
  PASSWORD_HASH: 'password_hash',
  MUST_CHANGE: 'must_change_password',
};

/**
 * Koneksi database SQLite (synchronous API via node:sqlite).
 * @type {DatabaseSync}
 */
let db;

/**
 * Prepared statements yang dibuat sekali saat startup lalu dipakai berulang.
 */
let stmts = {};

/* -------------------------------------------------------------------------- *
 *  Schema helpers
 * -------------------------------------------------------------------------- */

/**
 * Konversi row tabel `servers` menjadi object ServerRecord.
 *
 * @param {Object} row - Raw row dari tabel servers.
 * @returns {Object} ServerRecord.
 */
function rowToRecord(row) {
  return {
    hostname: row.hostname,
    os: row.os || 'unknown',
    platform: row.platform || 'unknown',
    uptime: row.uptime || 0,
    ip: row.ip || 'unknown',
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    online: !!row.online,
    cpu: safeParse(row.cpu, { usage: 0 }),
    memory: safeParse(row.memory, { used: 0, total: 0, percent: 0 }),
    disk: safeParse(row.disk, { used: 0, total: 0, percent: 0 }),
    network: safeParse(row.network, { rx: 0, tx: 0 }),
    docker: safeParse(row.docker, { containers: 0, running: 0 }),
    history: [],
  };
}

/**
 * Konversi row tabel `history` menjadi object MetricSample.
 *
 * @param {Object} row - Raw row dari tabel history.
 * @returns {Object} MetricSample.
 */
function historyRowToSample(row) {
  return {
    t: row.t,
    cpu: row.cpu || 0,
    memPct: row.memPct || 0,
    diskPct: row.diskPct || 0,
    rx: row.rx || 0,
    tx: row.tx || 0,
  };
}

/**
 * JSON.parse yang aman — return fallback jika parsing gagal.
 *
 * @param {string} str      - JSON string dari DB.
 * @param {*}      fallback - Nilai default jika parse gagal.
 * @returns {*}
 */
function safeParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- *
 *  Public API
 * -------------------------------------------------------------------------- */

/**
 * Inisialisasi database: buat file & direktori, buat tabel, prepare
 * statements, dan return semua row servers untuk dimuat ke memory cache.
 *
 * @returns {Object[]} Array of ServerRecord dari DB (tanpa history).
 */
function initDatabase() {
  // Pastikan direktori parent ada.
  const dir = path.dirname(DB_PATH);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');

  // --- Schema -------------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      hostname    TEXT PRIMARY KEY,
      os          TEXT,
      platform    TEXT,
      uptime      INTEGER,
      ip          TEXT,
      first_seen  INTEGER,
      last_seen   INTEGER,
      online      INTEGER,
      cpu         TEXT,
      memory      TEXT,
      disk        TEXT,
      network     TEXT,
      docker      TEXT
    );

    CREATE TABLE IF NOT EXISTS history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      hostname    TEXT NOT NULL,
      t           INTEGER NOT NULL,
      cpu         REAL,
      mem_pct     REAL,
      disk_pct    REAL,
      rx          REAL,
      tx          REAL,
      FOREIGN KEY (hostname) REFERENCES servers(hostname) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_host ON history(hostname, id);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // --- Prepared statements (node:sqlite uses positional ? params) -----
  stmts = {
    upsertServer: db.prepare(`
      INSERT INTO servers (hostname, os, platform, uptime, ip, first_seen, last_seen, online, cpu, memory, disk, network, docker)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hostname) DO UPDATE SET
        os=excluded.os, platform=excluded.platform, uptime=excluded.uptime,
        ip=excluded.ip, last_seen=excluded.last_seen, online=excluded.online,
        cpu=excluded.cpu, memory=excluded.memory, disk=excluded.disk,
        network=excluded.network, docker=excluded.docker
    `),
    deleteServer: db.prepare('DELETE FROM servers WHERE hostname = ?'),
    deleteHistory: db.prepare('DELETE FROM history WHERE hostname = ?'),
    insertHistory: db.prepare(`
      INSERT INTO history (hostname, t, cpu, mem_pct, disk_pct, rx, tx)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getHistory: db.prepare(`
      SELECT t, cpu, mem_pct AS memPct, disk_pct AS diskPct, rx, tx
      FROM history
      WHERE hostname = ?
      ORDER BY id DESC
      LIMIT ?
    `),
    trimHistory: db.prepare(`
      DELETE FROM history
      WHERE hostname = ?
        AND id NOT IN (
          SELECT id FROM history WHERE hostname = ? ORDER BY id DESC LIMIT ?
        )
    `),
    setOffline: db.prepare('UPDATE servers SET online = 0 WHERE hostname = ?'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `),
  };

  // --- Seed default credentials (hanya saat pertama kali) -------------------
  seedDefaultAuth();

  // --- Load semua server dari DB ------------------------------------------
  const rows = db.prepare('SELECT * FROM servers').all();
  const records = rows.map(rowToRecord);

  // Muat history untuk setiap server.
  for (const rec of records) {
    const hRows = stmts.getHistory.all(rec.hostname, MAX_HISTORY);
    rec.history = hRows.reverse().map(historyRowToSample);
  }

  return records;
}

/**
 * Persist ServerRecord ke database (upsert).
 *
 * @param {Object} rec - ServerRecord yang akan disimpan.
 * @returns {void}
 */
function saveServer(rec) {
  stmts.upsertServer.run(
    rec.hostname,
    rec.os,
    rec.platform,
    rec.uptime,
    rec.ip,
    rec.firstSeen,
    rec.lastSeen,
    rec.online ? 1 : 0,
    JSON.stringify(rec.cpu),
    JSON.stringify(rec.memory),
    JSON.stringify(rec.disk),
    JSON.stringify(rec.network),
    JSON.stringify(rec.docker)
  );
}

/**
 * Simpan metric sample ke tabel history dan trim entry lama agar hanya
 * menyimpan MAX_HISTORY baris terbaru per server.
 *
 * @param {string} hostname - Hostname server.
 * @param {Object} sample   - MetricSample yang akan disimpan.
 * @returns {void}
 */
function saveHistory(hostname, sample) {
  stmts.insertHistory.run(
    hostname,
    sample.t,
    sample.cpu,
    sample.memPct,
    sample.diskPct,
    sample.rx,
    sample.tx
  );
  stmts.trimHistory.run(hostname, hostname, MAX_HISTORY);
}

/**
 * Hapus server beserta seluruh history-nya dari database.
 *
 * @param {string} hostname - Hostname server yang akan dihapus.
 * @returns {void}
 */
function deleteServerFromDb(hostname) {
  stmts.deleteHistory.run(hostname);
  stmts.deleteServer.run(hostname);
}

/**
 * Tandai server sebagai offline di database.
 *
 * @param {string} hostname - Hostname server.
 * @returns {void}
 */
function setOfflineInDb(hostname) {
  stmts.setOffline.run(hostname);
}

/**
 * Seed kredensial default saat database pertama kali dibuat:
 *   - hash password default (123456)
 *   - flag must_change_password = '1' (paksa ganti password pertama login)
 *
 * @returns {void}
 */
function seedDefaultAuth() {
  const existing = stmts.getSetting.get(SETTINGS.PASSWORD_HASH);
  if (existing) return; // sudah pernah di-seed / diubah
  stmts.setSetting.run(SETTINGS.PASSWORD_HASH, auth.hashPassword(DEFAULT_PASSWORD));
  stmts.setSetting.run(SETTINGS.MUST_CHANGE, '1');
}

/**
 * Ambil nilai setting berdasarkan key.
 *
 * @param {string} key
 * @returns {string|null}
 */
function getSetting(key) {
  const row = stmts.getSetting.get(key);
  return row ? row.value : null;
}

/**
 * Simpan / update nilai setting.
 *
 * @param {string} key
 * @param {string} value
 * @returns {void}
 */
function setSetting(key, value) {
  stmts.setSetting.run(key, value);
}

/**
 * Tutup koneksi database.
 *
 * @returns {void}
 */
function closeDatabase() {
  if (db) db.close();
}

module.exports = {
  initDatabase,
  saveServer,
  saveHistory,
  deleteServerFromDb,
  setOfflineInDb,
  closeDatabase,
  seedDefaultAuth,
  getSetting,
  setSetting,
  SETTINGS,
};
