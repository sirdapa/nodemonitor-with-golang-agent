'use strict';

// Change-password page (first login).
const CHANGE_PASSWORD_HTML = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Node Monitor — Ganti Password</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
  </style>
</head>
<body class="bg-gray-900 text-gray-200 min-h-screen antialiased flex items-center justify-center px-4">

  <div class="w-full max-w-sm">
    <div class="flex items-center gap-3 justify-center mb-6">
        <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-8 4 16 3-8h4"/>
        </svg>
      </div>
      <div>
        <h1 class="text-lg font-bold text-white leading-tight">Node Monitor</h1>
        <p class="text-xs text-gray-500">VPS Monitoring Dashboard</p>
      </div>
    </div>

    <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-1">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </span>
        <h2 class="text-base font-semibold text-white">Ganti Password</h2>
      </div>
      <p class="text-xs text-gray-500 mb-5">Ini adalah login pertama Anda. Untuk keamanan, silakan ganti password default.</p>

      <form id="changeForm" class="space-y-4">
        <div>
          <label for="password" class="block text-xs text-gray-400 mb-1.5">Password Baru</label>
          <input id="password" name="password" type="password" autocomplete="new-password" required minlength="6"
            class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
        </div>
        <div>
          <label for="confirm" class="block text-xs text-gray-400 mb-1.5">Konfirmasi Password</label>
          <input id="confirm" name="confirm" type="password" autocomplete="new-password" required minlength="6"
            class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
        </div>
        <p id="error" class="text-xs text-red-400 hidden"></p>
        <p id="success" class="text-xs text-green-400 hidden">Password berhasil diubah. Mengalihkan…</p>
        <button type="submit"
          class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg text-sm font-semibold text-white">
          Simpan & Lanjutkan
        </button>
      </form>
    </div>
  </div>

  <script>
  (function () {
    'use strict';
    var form = document.getElementById('changeForm');
    var pwd = document.getElementById('password');
    var confirm = document.getElementById('confirm');
    var err = document.getElementById('error');
    var ok = document.getElementById('success');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.classList.add('hidden');
      ok.classList.add('hidden');

      if (pwd.value.length < 6) {
        err.textContent = 'Password minimal 6 karakter.';
        err.classList.remove('hidden');
        return;
      }
      if (pwd.value !== confirm.value) {
        err.textContent = 'Konfirmasi password tidak cocok.';
        err.classList.remove('hidden');
        return;
      }

      fetch('/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd.value, confirm: confirm.value })
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (d) {
            throw new Error(d.error || 'Gagal mengubah password.');
          });
        }
        return res.json();
      }).then(function () {
        ok.classList.remove('hidden');
        window.location.href = '/';
      }).catch(function (e) {
        err.textContent = e.message;
        err.classList.remove('hidden');
      });
    });
  })();
  </script>
</body>
</html>`;

module.exports = CHANGE_PASSWORD_HTML;
