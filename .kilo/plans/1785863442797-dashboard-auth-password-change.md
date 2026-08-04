# Dashboard Auth — Password-Only Login dengan Force Password Change

## Context
Aplikasi `node-monitor` (Express + `node:sqlite`) saat ini **tidak punya autentikasi** untuk halaman
dashboard maupun API. Satu-satunya auth yang ada adalah `AUTH_TOKEN` untuk agent report
(`src/store.js:298`), yang **tetap tidak diubah**.

Keputusan user:
- Login pakai **password saja** (tanpa username), default `123456`.
- **Hanya halaman dashboard (`GET /`)** yang dilindungi. API JSON dan `/api/report` milik agent tetap terbuka.
- **Tanpa dependency baru** — pakai `node:crypto` (`scrypt` untuk hash, `randomBytes` untuk session token).
- **Session in-memory** (sederhana): hilang saat restart server, user cukup login ulang.

## Kebutuhan & Alur
1. User buka `/` → belum auth → redirect ke `/login`.
2. Isi password `123456` → sukses, karena `must_change_password` masih `1` → redirect ke `/change-password`.
3. Isi password baru → hash disimpan, flag `must_change_password` jadi `0` → redirect ke `/`.
4. Selanjutnya login pakai password baru → langsung ke `/` (karena `mustChange` sudah `0`).

## Implementasi

### 1. `src/database.js` — penyimpanan kredensial
- Tambah tabel:
  ```sql
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  ```
- Saat `initDatabase()`: jika belum ada row `password_hash`, seed:
  `password_hash = hashScrypt('123456')` dan `must_change_password = '1'`.
- Export helper:
  - `getSetting(key)` → string|null
  - `setSetting(key, value)`
  - konstanta key: `PASSWORD_HASH`, `MUST_CHANGE`.
- Hash util (bisa di `src/auth.js`, diimpor db): `scryptSync(pw, salt)`, bandingkan pakai
  `crypto.timingSafeEqual`. Format simpan: `salt:hash` (base64).

### 2. `src/auth.js` (BARU) — session & kripto
- `hashPassword(pw)` → `salt:hash`.
- `verifyPassword(pw, stored)` → bool (timing-safe).
- Session store in-memory: `Map<token, { expiresAt, mustChange }>`.
- `createSession(mustChange)` → generate `crypto.randomBytes(32).hex`, simpan dgn expiry 24 jam, return token.
- `getSession(token)` → objek atau null (hapus kalau expired).
- `destroySession(token)`.
- `clearExpiredSessions()` opsional (dipanggil saat cek).
- Konstanta: `SESSION_COOKIE = 'nm_session'`, `SESSION_TTL_MS = 24*3600*1000`.

### 3. `src/routes/auth.js` (BARU)
- **GET `/login`** → serve `views/login.js`. Kalau sudah punya session valid:
  `mustChange` → redirect `/change-password`, else redirect `/`.
- **POST `/login`** (JSON `{ password }`):
  - bandingkan dengan `getSetting(PASSWORD_HASH)`.
  - salah → 401 `{ error: 'Password salah.' }`.
  - benar → `createSession(mustChange = getSetting(MUST_CHANGE)==='1')`, set cookie
    `nm_session` (HTTP-only, SameSite=Lax, Secure kalau `req.secure`/proxy, path=/),
    response `{ mustChange }` atau redirect.
- **GET `/change-password`** → serve `views/changePassword.js`. Hanya kalau ada session;
  kalau `!mustChange` redirect `/`. Kalau tidak ada session → redirect `/login`.
- **POST `/change-password`** (JSON `{ password, confirm }`):
  - validasi: `password` length >= 6, `password === confirm`.
  - update `setSetting(PASSWORD_HASH, hashPassword(password))`,
    `setSetting(MUST_CHANGE, '0')`, update `session.mustChange = false`.
  - response sukses / redirect `/`.
- **POST `/logout`** → `destroySession`, clear cookie, redirect `/login`.

### 4. Guard `ensureAuth` (di `src/auth.js` atau `src/middleware.js`)
- `ensureAuth(req,res,next)`:
  - token dari cookie; `getSession(token)` null → redirect `/login`.
  - `session.mustChange` → redirect `/change-password`.
  - else `next()`.
- Dipasang **hanya** pada `GET /` (dashboard). Route `/login`, `/change-password`,
  `/logout`, dan seluruh `/api/*` **dikecualikan**.

### 5. `src/app.js` — wiring
- `const authRoutes = require('./routes/auth');`
- `app.use('/', authRoutes);` **sebelum** `dashboardRoutes`.
- Pastikan `apiRoutes` (`/api`) tidak terkena guard.

### 6. `src/routes/dashboard.js`
- Pasang `ensureAuth` pada `router.get('/', ...)` (sebelum `dashboardLimiter` atau setelahnya).

### 7. Views baru
- **`src/views/login.js`**: form password sederhana, Tailwind, konsisten dgn dashboard.
  Input `type=password`, submit via `fetch` POST `/login`, tangani redirect/`mustChange`.
- **`src/views/changePassword.js`**: form `password` + `confirm`, submit POST `/change-password`.
- **Edit `src/views/dashboard.js`**: tambah tombol **Logout** di header yang POST `/logout`
  lalu redirect ke `/login` (bisa pakai form tersembunyi / `fetch` + `location.href`).

### 8. Security hardening (ringan)
- Rate-limit ketat di `/login` (mis. 10 req/menit) untuk cegah brute-force `123456`.
  Tambah di `src/middleware.js` sebagai `loginLimiter`, pakai di `auth.js`.
- Cookie `SameSite=Lax` + `HTTP-only` + `Secure` (kondisional) cukup untuk mitigasi CSRF di MVP.
- **Jangan** kirim hash password ke client.

## Risiko / Catatan
- Session in-memory hilang saat restart → user login ulang (sesuai pilihan).
- API & `/api/report` tetap publik (sesuai pilihan user).
- `123456` lemah; force-change mengurangi risiko awal, tapi user bisa set password lemah lagi.
  Boleh ditambahkan aturan password (min length sudah 6) bila diinginkan nanti.

## Validation
1. `node --experimental-sqlite index.js`, buka `http://localhost:<PORT>` → redirect ke `/login`.
2. Login `123456` → redirect ke `/change-password` (karena `mustChange`).
3. Ganti password → kembali ke dashboard, bisa akses normal.
4. Restart server, buka `/` → minta login lagi (session in-memory).
   Login pakai password baru → langsung ke dashboard (`mustChange=0`).
5. `/api/servers` & `/api/report` tetap bisa diakses tanpa auth.
6. Pastikan `package.json` **tidak** bertambah dependency baru.
7. Cek tidak ada `password_hash` bocor ke response JSON/client.
