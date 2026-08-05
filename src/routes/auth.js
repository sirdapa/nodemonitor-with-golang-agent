'use strict';

/**
 * ============================================================================
 * src/routes/auth.js — Auth routes untuk dashboard
 * ----------------------------------------------------------------------------
 * Endpoint:
 *   GET  /login            → halaman login
 *   POST /login            → verifikasi password, buat session
 *   GET  /change-password  → halaman ganti password (wajib session)
 *   POST /change-password  → simpan password baru
 *   POST /logout           → hapus session
 *
 * Hanya melindungi halaman dashboard; API & /api/report tidak terpengaruh.
 * ============================================================================
 */

const express = require('express');
const db = require('../database');
const auth = require('../auth');
const { loginLimiter } = require('../middleware');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;

/**
 * GET /login
 * Serve halaman login. Bila sudah punya session valid, lempar ke / atau
 * /change-password (bila masih wajib ganti password).
 */
router.get('/login', (req, res) => {
  const sess = auth.sessionFromRequest(req);
  if (sess) {
    return res.redirect(sess.mustChange ? '/change-password' : '/');
  }
  res.type('html');
  res.send(require('../views/login'));
});

/**
 * POST /login
 * Verifikasi password dashboard. Sukses → buat session + set cookie.
 */
router.post('/login', loginLimiter, (req, res) => {
  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  const storedHash = db.getSetting(db.SETTINGS.PASSWORD_HASH);
  const mustChange = db.getSetting(db.SETTINGS.MUST_CHANGE) === '1';

  if (!storedHash || !auth.verifyPassword(password, storedHash)) {
    return res.status(401).json({ error: 'Password salah.' });
  }

  const token = auth.createSession(mustChange);
  auth.setSessionCookie(res, token);
  res.json({ ok: true, mustChange });
});

/**
 * GET /change-password
 * Serve halaman ganti password. Wajib session; bila sudah tidak wajib ganti,
 * lempar ke dashboard.
 */
router.get('/change-password', (req, res) => {
  const sess = auth.sessionFromRequest(req);
  if (!sess) return res.redirect('/login');
  if (!sess.mustChange) return res.redirect('/');
  res.type('html');
  res.send(require('../views/changePassword'));
});

/**
 * POST /change-password
 * Validasi & simpan password baru, matikan flag must_change_password.
 */
router.post('/change-password', (req, res) => {
  const sess = auth.sessionFromRequest(req);
  if (!sess) return res.status(401).json({ error: 'Tidak terautentikasi.' });

  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  const confirm = req.body && typeof req.body.confirm === 'string' ? req.body.confirm : '';

  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'Password minimal ' + MIN_PASSWORD_LENGTH + ' karakter.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ error: 'Konfirmasi password tidak cocok.' });
  }

  db.setSetting(db.SETTINGS.PASSWORD_HASH, auth.hashPassword(password));
  db.setSetting(db.SETTINGS.MUST_CHANGE, '0');
  auth.clearMustChange(auth.getCookie(req, auth.SESSION_COOKIE));

  res.json({ ok: true });
});

/**
 * POST /logout
 * Hapus session & cookie, lalu redirect ke halaman login.
 */
router.post('/logout', (req, res) => {
  auth.destroySession(auth.getCookie(req, auth.SESSION_COOKIE));
  res.clearCookie(auth.SESSION_COOKIE, { path: '/' });
  res.redirect('/login');
});

module.exports = router;
