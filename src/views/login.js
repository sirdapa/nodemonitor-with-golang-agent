'use strict';

// Dashboard login page.
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Node Monitor — Login</title>
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
      <h2 class="text-base font-semibold text-white mb-1">Masuk</h2>
      <p class="text-xs text-gray-500 mb-5">Masukkan password dashboard untuk melanjutkan.</p>

      <form id="loginForm" class="space-y-4">
        <div>
          <label for="password" class="block text-xs text-gray-400 mb-1.5">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required
            class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
        </div>
        <p id="error" class="text-xs text-red-400 hidden"></p>
        <button type="submit"
          class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg text-sm font-semibold text-white">
          Masuk
        </button>
      </form>
    </div>

    <p class="text-center text-xs text-gray-600 mt-4">Sesi dilindungi. Password default harus diganti setelah login pertama.</p>
  </div>

  <script>
  (function () {
    'use strict';
    var form = document.getElementById('loginForm');
    var pwd = document.getElementById('password');
    var err = document.getElementById('error');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.classList.add('hidden');
      fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd.value })
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (d) {
            throw new Error(d.error || 'Login gagal.');
          });
        }
        return res.json();
      }).then(function (data) {
        window.location.href = data.mustChange ? '/change-password' : '/';
      }).catch(function (e) {
        err.textContent = e.message;
        err.classList.remove('hidden');
      });
    });
  })();
  </script>
</body>
</html>`;

module.exports = LOGIN_HTML;
