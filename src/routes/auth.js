'use strict';

// Auth routes: /login, /change-password, /logout. API & /api/report are unaffected.
const express = require('express');
const db = require('../database');
const auth = require('../auth');
const { loginLimiter } = require('../middleware');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;

// Login page; redirect when already authenticated.
router.get('/login', (req, res) => {
  const sess = auth.sessionFromRequest(req);
  if (sess) {
    return res.redirect(sess.mustChange ? '/change-password' : '/');
  }
  res.type('html');
  res.send(require('../views/login'));
});

// Verify password, create session + cookie.
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

// Change-password page (requires session + mustChange).
router.get('/change-password', (req, res) => {
  const sess = auth.sessionFromRequest(req);
  if (!sess) return res.redirect('/login');
  if (!sess.mustChange) return res.redirect('/');
  res.type('html');
  res.send(require('../views/changePassword'));
});

// Validate & save the new password, clear must_change_password.
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

// Destroy session & cookie, redirect to /login.
router.post('/logout', (req, res) => {
  auth.destroySession(auth.getCookie(req, auth.SESSION_COOKIE));
  res.clearCookie(auth.SESSION_COOKIE, { path: '/' });
  res.redirect('/login');
});

module.exports = router;
