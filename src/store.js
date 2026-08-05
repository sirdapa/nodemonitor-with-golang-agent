'use strict';

/**
 * ============================================================================
 * src/store.js — In-memory store & business logic
 * ----------------------------------------------------------------------------
 * Map() sebagai cache baca cepat di atas SQLite.  Semua logic pembuatan,
 * update, serialisasi, dan perhitungan statistik server berada di sini.
 * ============================================================================
 */

const { MAX_HISTORY, OFFLINE_TIMEOUT_MS, AUTH_TOKEN } = require('./config');
const db = require('./database');

/**
 * In-memory store keyed by hostname.  O(1) lookup/insert/delete.
 * @type {Map<string, Object>}
 */
const servers = new Map();

/* -------------------------------------------------------------------------- *
 *  Utility
 * -------------------------------------------------------------------------- */

/**
 * Return timestamp sekarang dalam milidetik.
 * @returns {number}
 */
function nowMs() {
  return Date.now();
}

/**
 * Apakah server sudah stale (tidak ada report dalam timeout)?
 *
 * @param {Object} rec - ServerRecord.
 * @returns {boolean}
 */
function isStale(rec) {
  return nowMs() - rec.lastSeen > OFFLINE_TIMEOUT_MS;
}

/* -------------------------------------------------------------------------- *
 *  Record lifecycle
 * -------------------------------------------------------------------------- */

/**
 * Buat ServerRecord baru dari payload report agent.
 *
 * @param {Object} body - Body JSON dari /api/report.
 * @param {string} ip   - IP address agent.
 * @returns {Object} ServerRecord baru.
 */
function createRecord(body, ip) {
  const ts = nowMs();
  return {
    hostname: body.hostname,
    os: body.os || 'unknown',
    platform: body.platform || 'unknown',
    uptime: body.uptime || 0,
    ip: ip,
    firstSeen: ts,
    lastSeen: ts,
    online: true,
    cpu: body.cpu || { usage: 0 },
    memory: body.memory || { used: 0, total: 0, percent: 0 },
    disk: body.disk || { used: 0, total: 0, percent: 0 },
    network: body.network || { rx: 0, tx: 0 },
    docker: body.docker || { containers: 0, running: 0 },
    history: [],
  };
}

/**
 * Update ServerRecord yang sudah ada dengan data report terbaru.
 * Hanya mengubah field yang ada di payload.
 *
 * @param {Object} rec  - ServerRecord yang akan diupdate.
 * @param {Object} body - Body JSON dari /api/report.
 * @param {string} ip   - IP address agent.
 * @returns {void}
 */
function updateRecord(rec, body, ip) {
  rec.lastSeen = nowMs();
  rec.online = true;
  rec.ip = ip;
  if (body.os) rec.os = body.os;
  if (body.platform) rec.platform = body.platform;
  if (body.uptime) rec.uptime = body.uptime;
  if (body.cpu) rec.cpu = body.cpu;
  if (body.memory) rec.memory = body.memory;
  if (body.disk) rec.disk = body.disk;
  if (body.network) rec.network = body.network;
  if (body.docker) rec.docker = body.docker;
}

/**
 * Push metric sample ke history array server, trim ke MAX_HISTORY terakhir,
 * dan persist ke SQLite.
 *
 * @param {Object} rec  - ServerRecord.
 * @param {Object} data - Raw payload dari agent.
 * @returns {void}
 */
function pushHistory(rec, data) {
  const sample = {
    t: nowMs(),
    cpu: data.cpu ? data.cpu.usage : 0,
    memPct: data.memory ? data.memory.percent : 0,
    diskPct: data.disk ? data.disk.percent : 0,
    rx: data.network ? data.network.rx : 0,
    tx: data.network ? data.network.tx : 0,
  };
  rec.history.push(sample);
  if (rec.history.length > MAX_HISTORY) {
    rec.history.shift();
  }
  db.saveHistory(rec.hostname, sample);
}

/**
 * Serialisasi ServerRecord menjadi object JSON untuk API response.
 *
 * @param {Object} rec - ServerRecord.
 * @returns {Object}
 */
function serialize(rec) {
  return {
    hostname: rec.hostname,
    os: rec.os,
    platform: rec.platform,
    uptime: rec.uptime,
    ip: rec.ip,
    firstSeen: rec.firstSeen,
    lastSeen: rec.lastSeen,
    online: rec.online,
    status: rec.online ? 'online' : 'offline',
    cpu: rec.cpu,
    memory: rec.memory,
    disk: rec.disk,
    network: rec.network,
    docker: rec.docker,
    history: rec.history,
  };
}

/* -------------------------------------------------------------------------- *
 *  Store operations
 * -------------------------------------------------------------------------- */

/**
 * Muat data awal dari database ke in-memory Map.
 * Dipanggil sekali saat startup.
 *
 * @returns {void}
 */
function loadFromDb() {
  const records = db.initDatabase();
  for (const rec of records) {
    servers.set(rec.hostname, rec);
  }
}

/**
 * Proses incoming report: register server baru atau update yang ada.
 *
 * @param {Object} body - Body JSON dari /api/report.
 * @param {string} ip   - IP address agent.
 * @returns {{ ok: boolean, action: string, hostname: string }}
 */
function processReport(body, ip) {
  const hostname = body.hostname.trim();
  const existing = servers.get(hostname);

  if (existing) {
    updateRecord(existing, body, ip);
    db.saveServer(existing);
    pushHistory(existing, body);
    return { ok: true, action: 'updated', hostname };
  }

  const rec = createRecord(body, ip);
  servers.set(hostname, rec);
  db.saveServer(rec);
  pushHistory(rec, body);
  return { ok: true, action: 'registered', hostname };
}

/**
 * Ambil semua server sebagai array of serialized objects.
 *
 * @returns {Object[]}
 */
function getAllServers() {
  const list = [];
  for (const rec of servers.values()) {
    list.push(serialize(rec));
  }
  return list;
}

/**
 * Ambil satu server berdasarkan hostname.
 *
 * @param {string} hostname
 * @returns {Object|null} Serialized server atau null jika tidak ada.
 */
function getServer(hostname) {
  const rec = servers.get(hostname);
  return rec ? serialize(rec) : null;
}

/**
 * Hapus server dari memory dan database.
 *
 * @param {string} hostname
 * @returns {boolean} true jika berhasil dihapus, false jika tidak ditemukan.
 */
function deleteServer(hostname) {
  if (!servers.has(hostname)) return false;
  servers.delete(hostname);
  db.deleteServerFromDb(hostname);
  return true;
}

/**
 * Hitung statistik agregat semua server.
 * Average dihitung hanya dari server yang online.
 *
 * @returns {Object} { totalServers, onlineServers, offlineServers, avgCpu, avgRam }
 */
function computeStats() {
  let total = 0;
  let online = 0;
  let offline = 0;
  let cpuSum = 0;
  let ramSum = 0;

  for (const rec of servers.values()) {
    total++;
    if (rec.online) {
      online++;
      cpuSum += rec.cpu ? rec.cpu.usage || 0 : 0;
      ramSum += rec.memory ? rec.memory.percent || 0 : 0;
    } else {
      offline++;
    }
  }

  return {
    totalServers: total,
    onlineServers: online,
    offlineServers: offline,
    avgCpu: online > 0 ? Math.round((cpuSum / online) * 100) / 100 : 0,
    avgRam: online > 0 ? Math.round((ramSum / online) * 100) / 100 : 0,
  };
}

/**
 * Sweep periodik: tandai server yang stale sebagai offline.
 * Status offline dipersist ke SQLite.
 *
 * @returns {void}
 */
function sweepOffline() {
  const now = nowMs();
  for (const rec of servers.values()) {
    if (rec.online && now - rec.lastSeen > OFFLINE_TIMEOUT_MS) {
      rec.online = false;
      db.setOfflineInDb(rec.hostname);
    }
  }
}

/**
 * Jumlah server saat ini di memory.
 * @returns {number}
 */
function serverCount() {
  return servers.size;
}

/* -------------------------------------------------------------------------- *
 *  Validation
 * -------------------------------------------------------------------------- */

/**
 * Validasi body POST /api/report.  Return pesan error string jika invalid,
 * atau null jika valid.
 *
 * @param {Object} body - Body request.
 * @returns {string|null}
 */
function validateReport(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object.';
  }
  if (!body.token || body.token !== AUTH_TOKEN) {
    return 'Invalid or missing authentication token.';
  }
  if (!body.hostname || typeof body.hostname !== 'string' || body.hostname.trim() === '') {
    return 'hostname is required and must be a non-empty string.';
  }
  if (body.uptime !== undefined && typeof body.uptime !== 'number') {
    return 'uptime must be a number.';
  }
  if (body.cpu && typeof body.cpu.usage !== 'number') {
    return 'cpu.usage must be a number.';
  }
  if (body.memory && typeof body.memory.percent !== 'number') {
    return 'memory.percent must be a number.';
  }
  if (body.disk && typeof body.disk.percent !== 'number') {
    return 'disk.percent must be a number.';
  }
  return null;
}

/**
 * Ekstrak IP client dari Express request, memperhitungkan proxy headers.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) {
    return xf.toString().split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

module.exports = {
  servers,
  loadFromDb,
  processReport,
  getAllServers,
  getServer,
  deleteServer,
  computeStats,
  sweepOffline,
  serverCount,
  validateReport,
  getClientIp,
};
