'use strict';

// SQLite via node:sqlite — schema, prepared statements, persistence.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH, MAX_HISTORY, RAW_RETENTION_MS, ROLLUP_RETENTION_MS } = require('./config');
const auth = require('./auth');

// Default password on first run — forced change after login.
const DEFAULT_PASSWORD = '123456';

const SETTINGS = {
  PASSWORD_HASH: 'password_hash',
  MUST_CHANGE: 'must_change_password',
  AGENT_TOKEN: 'agent_token',
};

let db;
let stmts = {};

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

// Safe JSON.parse with fallback.
function safeParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function initDatabase() {
  const dir = path.dirname(DB_PATH);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');

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

    CREATE TABLE IF NOT EXISTS history_hourly (
      hostname   TEXT NOT NULL,
      bucket     INTEGER NOT NULL,
      cpu        REAL,
      mem_pct    REAL,
      disk_pct   REAL,
      rx         REAL,
      tx         REAL,
      samples    INTEGER,
      PRIMARY KEY (hostname, bucket)
    );

    CREATE INDEX IF NOT EXISTS idx_hourly_host ON history_hourly(hostname, bucket);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Prepared statements use positional ? params (node:sqlite).
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
    deleteOldHistory: db.prepare('DELETE FROM history WHERE t < ?'),
    deleteHourlyHistory: db.prepare('DELETE FROM history_hourly WHERE hostname = ?'),
    deleteOldHourly: db.prepare('DELETE FROM history_hourly WHERE bucket < ?'),
    upsertHourly: db.prepare(`
      INSERT INTO history_hourly (hostname, bucket, cpu, mem_pct, disk_pct, rx, tx, samples)
      SELECT hostname, (t / 3600000) * 3600000 AS bucket,
             AVG(cpu), AVG(mem_pct), AVG(disk_pct), AVG(rx), AVG(tx), COUNT(*)
      FROM history
      WHERE t < ?
      GROUP BY hostname, bucket
      ON CONFLICT(hostname, bucket) DO UPDATE SET
        cpu=excluded.cpu, mem_pct=excluded.mem_pct, disk_pct=excluded.disk_pct,
        rx=excluded.rx, tx=excluded.tx, samples=excluded.samples
    `),
    getHistoryRange: db.prepare(`
      SELECT t, cpu, mem_pct AS memPct, disk_pct AS diskPct, rx, tx
      FROM history
      WHERE hostname = ? AND t >= ?
      ORDER BY t ASC
    `),
    getHourlyRange: db.prepare(`
      SELECT bucket AS t, cpu, mem_pct AS memPct, disk_pct AS diskPct, rx, tx
      FROM history_hourly
      WHERE hostname = ? AND bucket >= ?
      ORDER BY bucket ASC
    `),
    setOffline: db.prepare('UPDATE servers SET online = 0 WHERE hostname = ?'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `),
  };

  seedDefaultAuth();
  seedAgentToken();

  const rows = db.prepare('SELECT * FROM servers').all();
  const records = rows.map(rowToRecord);

  // Load history per server (newest first, reversed to chronological).
  for (const rec of records) {
    const hRows = stmts.getHistory.all(rec.hostname, MAX_HISTORY);
    rec.history = hRows.reverse().map(historyRowToSample);
  }

  return records;
}

// Persist a ServerRecord (upsert).
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

// Insert a metric sample into raw history.
// Trimming of old raw data is done by maintenance job, not on every insert.
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
}

// Mark a server as offline.
function setOfflineInDb(hostname) {
  stmts.setOffline.run(hostname);
}

// Seed default credentials on first run:
//   - hash of default password (123456)
//   - must_change_password = '1' (force password change on first login)
function seedDefaultAuth() {
  const existing = stmts.getSetting.get(SETTINGS.PASSWORD_HASH);
  if (existing) return;
  stmts.setSetting.run(SETTINGS.PASSWORD_HASH, auth.hashPassword(DEFAULT_PASSWORD));
  stmts.setSetting.run(SETTINGS.MUST_CHANGE, '1');
}

// Generate a cryptographically secure random token for agent authentication.
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Seed the agent token in database if it doesn't exist.
// Uses env TOKEN if set and not the default 'changeme', otherwise generates a new token.
function seedAgentToken() {
  const existing = getSetting(SETTINGS.AGENT_TOKEN);
  if (existing) return;

  let token;
  const envToken = process.env.TOKEN;
  if (envToken && envToken !== 'changeme') {
    token = envToken;
  } else {
    token = generateToken();
  }
  setSetting(SETTINGS.AGENT_TOKEN, token);
}

// Get the current agent token from database.
function getAgentToken() {
  return getSetting(SETTINGS.AGENT_TOKEN);
}

// Regenerate the agent token and return the new one.
function regenerateAgentToken() {
  const newToken = generateToken();
  setSetting(SETTINGS.AGENT_TOKEN, newToken);
  return newToken;
}

function getSetting(key) {
  const row = stmts.getSetting.get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  stmts.setSetting.run(key, value);
}

function closeDatabase() {
  if (db) db.close();
}

// Maintenance job: prune old raw history data.
function pruneRawHistory() {
  try {
    stmts.deleteOldHistory.run(Date.now() - RAW_RETENTION_MS);
  } catch (err) {
    console.error('Error pruning raw history:', err);
  }
}

// Maintenance job: roll up raw history to hourly aggregations.
function rollupHistory() {
  try {
    const now = Date.now();
    const cutoff = now - (now % 3600000); // Start of current hour, roll up only completed hours
    stmts.upsertHourly.run(cutoff);
  } catch (err) {
    console.error('Error rolling up history:', err);
  }
}

// Maintenance job: prune old hourly data.
function pruneRollup() {
  try {
    stmts.deleteOldHourly.run(Date.now() - ROLLUP_RETENTION_MS);
  } catch (err) {
    console.error('Error pruning rollup data:', err);
  }
}

// Run all maintenance jobs.
function runMaintenance() {
  try {
    rollupHistory();
    pruneRawHistory();
    pruneRollup();
  } catch (err) {
    console.error('Maintenance job failed:', err);
  }
}

// Get historical data for a server within a time range.
function getHistoryRange(hostname, sinceMs, useRollup) {
  let rows;
  if (useRollup) {
    rows = stmts.getHourlyRange.all(hostname, sinceMs);
  } else {
    rows = stmts.getHistoryRange.all(hostname, sinceMs);
  }
  
  // Downsample if too many points for performance
  if (rows.length > 500) {
    return downsample(rows, 500);
  }
  return rows;
}

// Downsample array of data points to maximum number of points
function downsample(rows, maxPoints) {
  if (!rows || rows.length === 0) return [];
  if (rows.length <= maxPoints) return rows;
  
  const step = Math.ceil(rows.length / maxPoints);
  const downsampled = [];
  for (let i = 0; i < rows.length; i += step) {
    downsampled.push(rows[i]);
  }
  // Always include the latest data point to avoid losing most recent data
  if (!downsampled.length || rows[rows.length - 1].t !== downsampled[downsampled.length - 1].t) {
    downsampled.push(rows[rows.length - 1]);
  }
  return downsampled;
}

// Delete a server and all its history (raw + hourly rollup).
function deleteServerFromDb(hostname) {
  stmts.deleteHistory.run(hostname);
  stmts.deleteHourlyHistory.run(hostname);
  stmts.deleteServer.run(hostname);
}

module.exports = {
  initDatabase,
  saveServer,
  saveHistory,
  deleteServerFromDb,
  setOfflineInDb,
  closeDatabase,
  runMaintenance,
  getHistoryRange,
  seedDefaultAuth,
  seedAgentToken,
  getAgentToken,
  regenerateAgentToken,
  getSetting,
  setSetting,
  SETTINGS,
};
