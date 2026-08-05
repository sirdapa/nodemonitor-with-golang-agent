'use strict';

/**
 * ============================================================================
 * src/auth.js — Autentikasi dashboard (password-only, session in-memory)
 * ----------------------------------------------------------------------------
 * Modul ini menangani:
 *   - hashing & verifikasi password (node:crypto scrypt)
 *   - session store in-memory (Map token -> { expiresAt, mustChange })
 *   - generate/destroy session
 *
 * Tidak ada dependency baru — hanya memakai node:crypto bawaan.
 * ============================================================================
 */

const crypto = require('crypto');

/**
 * Nama cookie session.
 * @type {string}
 */
const SESSION_COOKIE = 'nm_session';

/**
 * Masa berlaku session (24 jam).
 * @type {number}
 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Session store in-memory: token -> { expiresAt, mustChange }.
 * @type {Map<string, { expiresAt: number, mustChange: boolean }>}
 */
const sessions = new Map();

/* -------------------------------------------------------------------------- *
 *  Password hashing (scrypt)
 * -------------------------------------------------------------------------- */

/**
 * Hash sebuah password dengan scrypt + salt acak.
 * Format simpan: `saltB64:hashB64`.
 *
 * @param {string} password - Plaintext password.
 * @returns {string} String `salt:hash` (base64).
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return salt.toString('base64') + ':' + hash.toString('base64');
}

/**
 * Verifikasi password terhadap hash tersimpan (timing-safe).
 *
 * @param {string} password - Plaintext password dari user.
 * @param {string} stored   - Hash tersimpan (`salt:hash` base64).
 * @returns {boolean} true jika cocok.
 */
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

/* -------------------------------------------------------------------------- *
 *  Session management (in-memory)
 * -------------------------------------------------------------------------- */

/**
 * Buat session baru dan return token-nya.
 *
 * @param {boolean} mustChange - Apakah user wajib ganti password dulu.
 * @returns {string} Session token (hex).
 */
function createSession(mustChange) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    expiresAt: Date.now() + SESSION_TTL_MS,
    mustChange: !!mustChange,
  });
  return token;
}

/**
 * Ambil session berdasarkan token. Hapus & return null bila expired/tidak ada.
 *
 * @param {string|undefined} token
 * @returns {{ expiresAt: number, mustChange: boolean }|null}
 */
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

/**
 * Tandai session sudah tidak wajib ganti password (setelah berhasil ganti).
 *
 * @param {string|undefined} token
 * @returns {void}
 */
function clearMustChange(token) {
  const sess = getSession(token);
  if (sess) sess.mustChange = false;
}

/**
 * Hapus session (logout).
 *
 * @param {string|undefined} token
 * @returns {void}
 */
function destroySession(token) {
  if (token) sessions.delete(token);
}

/* -------------------------------------------------------------------------- *
 *  Cookie & middleware helpers (tanpa dependency baru)
 * -------------------------------------------------------------------------- */

/**
 * Baca nilai cookie dari header request secara manual (tanpa cookie-parser).
 *
 * @param {import('express').Request} req
 * @param {string} name
 * @returns {string|undefined}
 */
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

/**
 * Set session cookie pada response.
 *
 * @param {import('express').Response} res
 * @param {string} token
 * @returns {void}
 */
function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Baca session dari cookie request. Return null bila tidak ada/expired.
 *
 * @param {import('express').Request} req
 * @returns {{ expiresAt: number, mustChange: boolean }|null}
 */
function sessionFromRequest(req) {
  return getSession(getCookie(req, SESSION_COOKIE));
}

/**
 * Guard: wajib autentikasi untuk mengakses dashboard.
 * Redirect ke /login bila belum login, ke /change-password bila wajib ganti.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
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
