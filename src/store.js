'use strict';

// In-memory Map cache over SQLite + monitoring business logic.
const { MAX_HISTORY, OFFLINE_TIMEOUT_MS } = require('./config');
const db = require('./database');
const crypto = require('crypto');

const servers = new Map();

const nowMs = () => Date.now();

// A server is stale when no report arrives within OFFLINE_TIMEOUT_MS.
const isStale = (rec) => nowMs() - rec.lastSeen > OFFLINE_TIMEOUT_MS;

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
    cpu: body.cpu || { name: '', usage: 0 },
    memory: body.memory || { used: 0, total: 0, percent: 0 },
    disk: body.disk || { used: 0, total: 0, percent: 0 },
    network: body.network || { rx: 0, tx: 0 },
    docker: body.docker || { containers: 0, running: 0 },
    history: [],
  };
}

// Update an existing record — only fields present in the payload.
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

// Push a metric sample into history, trim to MAX_HISTORY, persist to SQLite.
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

// Serialize a ServerRecord for API responses.
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

// Load data from DB into the Map — called once at startup.
function loadFromDb() {
  const records = db.initDatabase();
  for (const rec of records) {
    servers.set(rec.hostname, rec);
  }
}

// Process an incoming report: register a new server or update an existing one.
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

function getAllServers() {
  const list = [];
  for (const rec of servers.values()) {
    list.push(serialize(rec));
  }
  return list;
}

function getServer(hostname) {
  const rec = servers.get(hostname);
  return rec ? serialize(rec) : null;
}

// Delete a server from memory + DB.
function deleteServer(hostname) {
  if (!servers.has(hostname)) return false;
  servers.delete(hostname);
  db.deleteServerFromDb(hostname);
  return true;
}

// Aggregate stats — averages computed from online servers only.
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

// Periodic sweep: mark stale servers as offline + persist to DB.
function sweepOffline() {
  const now = nowMs();
  for (const rec of servers.values()) {
    if (rec.online && now - rec.lastSeen > OFFLINE_TIMEOUT_MS) {
      rec.online = false;
      db.setOfflineInDb(rec.hostname);
    }
  }
}

const serverCount = () => servers.size;

// Validate POST /api/report body. Returns an error string or null.
function validateReport(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object.';
  }
  
  const expected = db.getAgentToken();
  if (!body.token || !expected) {
    return 'Invalid or missing authentication token.';
  }
  
  // Use timing-safe comparison if the token length matches (security against timing attacks)
  if (body.token.length === expected.length) {
    const bodyBuffer = Buffer.from(body.token, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (!crypto.timingSafeEqual(bodyBuffer, expectedBuffer)) {
      return 'Invalid or missing authentication token.';
    }
  } else {
    // Length mismatch → invalid (no timing leak)
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

// Extract client IP, honoring proxy headers.
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
