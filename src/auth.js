'use strict';

// Dashboard auth: scrypt hashing + in-memory sessions (no dependencies).
const crypto = require('crypto');

const SESSION_COOKIE = 'nm_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map();

// Hash format: `saltB64:hashB64`.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return salt.toString('base64') + ':' + hash.toString('base64');
}

// Timing-safe verification.
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) {
    return false;
  }
  const [saltB64, hashB64] = stored.split(':');
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function createSession(mustChange) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    expiresAt: Date.now() + SESSION_TTL_MS,
    mustChange: !!mustChange,
  });
  return token;
}

// Returns the session or null if missing/expired.
function getSession(token) {
  if (!token) return null;
  const sess = sessions.get(token);
  if (!sess) return null;
  if (sess.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return sess;
}

function clearMustChange(token) {
  const sess = getSession(token);
  if (sess) sess.mustChange = false;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

// Manual cookie parsing (no cookie-parser dependency).
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const pair = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  if (!pair) return undefined;
  return decodeURIComponent(pair.slice(name.length + 1));
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
    secure: process.env.NODE_ENV === 'production',
  });
}

function sessionFromRequest(req) {
  return getSession(getCookie(req, SESSION_COOKIE));
}

// Guard: redirect to /login or /change-password.
function ensureAuth(req, res, next) {
  const sess = sessionFromRequest(req);
  if (!sess) return res.redirect('/login');
  if (sess.mustChange) return res.redirect('/change-password');
  req.session = sess;
  next();
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  clearMustChange,
  destroySession,
  getCookie,
  setSessionCookie,
  sessionFromRequest,
  ensureAuth,
};
