'use strict';

/**
 * ============================================================================
 * src/views/dashboard.js — HTML template untuk dashboard
 * ----------------------------------------------------------------------------
 * Seluruh HTML, CSS (Tailwind), dan client-side JavaScript untuk dashboard
 * single-page.  Tidak ada file eksternal — semuanya embedded di template
 * string ini.
 * ============================================================================
 */

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Node Monitor — VPS Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50:  '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe',
              300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1',
              600: '#4f46e5', 700: '#4338ca', 800: '#3730a3',
              900: '#312e81',
            },
          },
        },
      },
    };
  </script>
  <style>
    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #4b5563; }

    /* Smooth row expansion */
    .expand-body { transition: max-height .25s ease, opacity .2s ease; overflow: hidden; }

    /* Pulse animation for online dot */
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
      50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
    }
    .pulse-online { animation: pulse-green 2s infinite; }

    /* Fade-in for cards */
    @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .fade-in { animation: fadeInUp .3s ease; }
  </style>
</head>
<body class="bg-gray-900 text-gray-200 min-h-screen antialiased">

  <!-- ============================ HEADER ============================ -->
  <header class="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-8 4 16 3-8h4"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white leading-tight">Node Monitor</h1>
          <p class="text-xs text-gray-500">VPS Monitoring Dashboard</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span id="lastRefresh" class="text-xs text-gray-500 hidden sm:inline"></span>
        <span id="refreshDot" class="w-2 h-2 rounded-full bg-green-500 pulse-online"></span>
        <span class="text-xs text-gray-400">Live</span>
        <div class="hidden md:flex items-center gap-2 ml-1">
          <span class="text-xs text-gray-500">Token:</span>
          <code id="agentToken" class="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded px-2 py-1 font-mono select-all">__AGENT_TOKEN__</code>
          <button id="copyToken" type="button" title="Salin token agent"
            class="text-xs font-medium text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
            Salin
          </button>
        </div>
        <form method="POST" action="/logout" class="ml-1">
          <button type="submit" title="Logout"
            class="text-xs font-medium text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
            Logout
          </button>
        </form>
      </div>
    </div>
  </header>

  <!-- ============================ MAIN ============================== -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

    <!-- ---- Stat cards ---- -->
    <section id="statCards" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <!-- Total Servers -->
      <div class="fade-in bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
        <div class="w-11 h-11 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16"/>
          </svg>
        </div>
        <div>
          <p id="statTotal" class="text-2xl font-bold text-white">0</p>
          <p class="text-xs text-gray-500">Total Servers</p>
        </div>
      </div>
      <!-- Online -->
      <div class="fade-in bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
        <div class="w-11 h-11 rounded-lg bg-green-600/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div>
          <p id="statOnline" class="text-2xl font-bold text-white">0</p>
          <p class="text-xs text-gray-500">Online</p>
        </div>
      </div>
      <!-- Offline -->
      <div class="fade-in bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
        <div class="w-11 h-11 rounded-lg bg-red-600/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <div>
          <p id="statOffline" class="text-2xl font-bold text-white">0</p>
          <p class="text-xs text-gray-500">Offline</p>
        </div>
      </div>
      <!-- Avg CPU -->
      <div class="fade-in bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
        <div class="w-11 h-11 rounded-lg bg-orange-600/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M9 9h6v6H9z"/>
          </svg>
        </div>
        <div>
          <p id="statCpu" class="text-2xl font-bold text-white">0%</p>
          <p class="text-xs text-gray-500">Avg CPU</p>
        </div>
      </div>
      <!-- Avg RAM -->
      <div class="fade-in bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
        <div class="w-11 h-11 rounded-lg bg-blue-600/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
        </div>
        <div>
          <p id="statRam" class="text-2xl font-bold text-white">0%</p>
          <p class="text-xs text-gray-500">Avg RAM</p>
        </div>
      </div>
    </section>

    <!-- ---- Controls ---- -->
    <section class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="relative flex-1">
        <svg class="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
        </svg>
        <input id="searchBox" type="text" placeholder="Search hostname or OS…"
          class="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
      </div>
      <select id="sortBy"
        class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
        <option value="hostname">Sort: Hostname</option>
        <option value="cpu">Sort: CPU</option>
        <option value="ram">Sort: RAM</option>
        <option value="disk">Sort: Disk</option>
        <option value="lastSeen">Sort: Last Seen</option>
      </select>
      <div class="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <button data-filter="all"    class="filter-btn px-4 py-2.5 text-sm font-medium text-white bg-brand-600">All</button>
        <button data-filter="online" class="filter-btn px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white">Online</button>
        <button data-filter="offline" class="filter-btn px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white">Offline</button>
      </div>
    </section>

    <!-- ---- Server table ---- -->
    <section class="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
              <th class="px-4 py-3 font-medium"></th>
              <th class="px-4 py-3 font-medium">Hostname</th>
              <th class="px-4 py-3 font-medium hidden md:table-cell">OS</th>
              <th class="px-4 py-3 font-medium hidden lg:table-cell">IP</th>
              <th class="px-4 py-3 font-medium">CPU</th>
              <th class="px-4 py-3 font-medium">RAM</th>
              <th class="px-4 py-3 font-medium hidden md:table-cell">Disk</th>
              <th class="px-4 py-3 font-medium hidden lg:table-cell">Docker</th>
              <th class="px-4 py-3 font-medium hidden xl:table-cell">Last Seen</th>
              <th class="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody id="serverTableBody">
            <!-- Filled dynamically -->
          </tbody>
        </table>
      </div>
      <div id="emptyState" class="hidden py-16 text-center text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 6h14M5 18h14"/>
        </svg>
        <p class="text-sm">No servers found.</p>
      </div>
    </section>
  </main>

  <!-- ============================ MODAL ============================= -->
  <div id="detailModal" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeModal()"></div>
    <div class="absolute inset-y-0 right-0 w-full max-w-2xl bg-gray-850 bg-gray-900 border-l border-gray-700 shadow-2xl overflow-y-auto">
      <div class="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h2 id="modalTitle" class="text-lg font-bold text-white"></h2>
          <p id="modalSubtitle" class="text-xs text-gray-500"></p>
        </div>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div id="modalBody" class="px-6 py-4 space-y-6"></div>
    </div>
  </div>

  <!-- ============================ SCRIPT ============================ -->
  <script>
  (function () {
    'use strict';

    /* ----------------------- State ----------------------- */
    let allServers = [];
    let currentFilter = 'all';
    let currentSort = 'hostname';
    let currentSearch = '';
    let charts = {};   // { hostname: { cpu: Chart, ram: Chart } }

    /* ----------------------- Helpers ----------------------- */

    /**
     * Format bytes into a human-readable string.
     * @param {number} bytes
     * @returns {string}
     */
    function fmtBytes(bytes) {
      if (!bytes || bytes <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
    }

    /**
     * Format seconds into a compact uptime string.
     * @param {number} sec
     * @returns {string}
     */
    function fmtUptime(sec) {
      if (!sec || sec <= 0) return '—';
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
      if (h > 0) return h + 'h ' + m + 'm';
      return m + 'm';
    }

    /**
     * Format a timestamp into a relative "time ago" string.
     * @param {number} ts - Unix timestamp in ms.
     * @returns {string}
     */
    function timeAgo(ts) {
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 5) return 'just now';
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    /**
     * Format a timestamp as a local date-time string.
     * @param {number} ts
     * @returns {string}
     */
    function fmtDate(ts) {
      if (!ts) return '—';
      return new Date(ts).toLocaleString();
    }

    /**
     * Return a Tailwind colour class for a usage percentage bar.
     * @param {number} pct
     * @returns {string}
     */
    function barColor(pct) {
      if (pct >= 90) return 'bg-red-500';
      if (pct >= 75) return 'bg-orange-500';
      if (pct >= 50) return 'bg-yellow-500';
      return 'bg-green-500';
    }

    /**
     * Escape HTML to prevent XSS when inserting user-controlled data.
     * @param {string} str
     * @returns {string}
     */
    function esc(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /**
     * Build a small usage bar with a label.
     * @param {number} pct   - Percentage 0-100.
     * @param {string} label - Label text.
     * @returns {string} HTML string.
     */
    function usageBar(pct, label) {
      pct = Math.max(0, Math.min(100, pct || 0));
      return ''
        + '<div class="space-y-1">'
        +   '<div class="flex justify-between text-xs">'
        +     '<span class="text-gray-400">' + esc(label) + '</span>'
        +     '<span class="text-white font-medium">' + pct.toFixed(1) + '%</span>'
        +   '</div>'
        +   '<div class="h-2 bg-gray-700 rounded-full overflow-hidden">'
        +     '<div class="h-full ' + barColor(pct) + ' rounded-full transition-all duration-500" style="width:' + pct + '%"></div>'
        +   '</div>'
        + '</div>';
    }

    /* ----------------------- Data fetching ----------------------- */

    /**
     * Fetch all servers and stats from the API, then re-render.
     * @returns {Promise<void>}
     */
    async function fetchData() {
      try {
        const [srvRes, statRes] = await Promise.all([
          fetch('/api/servers'),
          fetch('/api/stats'),
        ]);
        allServers = await srvRes.json();
        const stats = await statRes.json();
        renderStats(stats);
        renderTable();
        document.getElementById('lastRefresh').textContent = 'Updated ' + new Date().toLocaleTimeString();
      } catch (e) {
        console.error('Fetch error:', e);
      }
    }

    /* ----------------------- Rendering: stat cards ----------------------- */

    /**
     * Render the top summary cards.  Only the numeric values are updated
     * in-place so the cards do not flash / re-animate on every refresh.
     * @param {Object} stats
     */
    function renderStats(stats) {
      document.getElementById('statTotal').textContent = stats.totalServers;
      document.getElementById('statOnline').textContent = stats.onlineServers;
      document.getElementById('statOffline').textContent = stats.offlineServers;
      document.getElementById('statCpu').textContent = stats.avgCpu + '%';
      document.getElementById('statRam').textContent = stats.avgRam + '%';
    }

    /* ----------------------- Rendering: table ----------------------- */

    /**
     * Apply current filter / search / sort to the server list and render
     * the table rows.
     */
    function renderTable() {
      let list = allServers.slice();

      // Filter
      if (currentFilter === 'online') {
        list = list.filter(function (s) { return s.online; });
      } else if (currentFilter === 'offline') {
        list = list.filter(function (s) { return !s.online; });
      }

      // Search
      if (currentSearch) {
        var q = currentSearch.toLowerCase();
        list = list.filter(function (s) {
          return (s.hostname && s.hostname.toLowerCase().indexOf(q) !== -1) ||
                 (s.os && s.os.toLowerCase().indexOf(q) !== -1) ||
                 (s.ip && s.ip.toLowerCase().indexOf(q) !== -1);
        });
      }

      // Sort
      list.sort(function (a, b) {
        switch (currentSort) {
          case 'cpu':
            return (a.cpu ? a.cpu.usage : 0) - (b.cpu ? b.cpu.usage : 0);
          case 'ram':
            return (a.memory ? a.memory.percent : 0) - (b.memory ? b.memory.percent : 0);
          case 'disk':
            return (a.disk ? a.disk.percent : 0) - (b.disk ? b.disk.percent : 0);
          case 'lastSeen':
            return a.lastSeen - b.lastSeen;
          case 'hostname':
          default:
            return a.hostname.localeCompare(b.hostname);
        }
      });

      var tbody = document.getElementById('serverTableBody');
      var empty = document.getElementById('emptyState');

      if (list.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');

      tbody.innerHTML = list.map(function (s) {
        var cpuPct = s.cpu ? s.cpu.usage : 0;
        var ramPct = s.memory ? s.memory.percent : 0;
        var diskPct = s.disk ? s.disk.percent : 0;
        var docker = s.docker ? (s.docker.running + '/' + s.docker.containers) : '—';
        var statusBadge = s.online
          ? '<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400"><span class="w-2 h-2 rounded-full bg-green-500 pulse-online"></span>Online</span>'
          : '<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400"><span class="w-2 h-2 rounded-full bg-red-500"></span>Offline</span>';

        return ''
          + '<tr class="border-b border-gray-700/50 hover:bg-gray-800/60 cursor-pointer transition-colors" onclick="openModal(\\'' + esc(s.hostname) + '\\')">'
          +   '<td class="px-4 py-3">'
          +     '<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>'
          +   '</td>'
          +   '<td class="px-4 py-3 font-medium text-white">' + esc(s.hostname) + '</td>'
          +   '<td class="px-4 py-3 text-gray-400 hidden md:table-cell">' + esc(s.os) + '</td>'
          +   '<td class="px-4 py-3 text-gray-400 hidden lg:table-cell font-mono text-xs">' + esc(s.ip) + '</td>'
          +   '<td class="px-4 py-3">'
          +     '<div class="flex items-center gap-2">'
          +       '<div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden"><div class="h-full ' + barColor(cpuPct) + ' rounded-full" style="width:' + cpuPct + '%"></div></div>'
          +       '<span class="text-xs text-gray-300">' + (cpuPct || 0).toFixed(0) + '%</span>'
          +     '</div>'
          +   '</td>'
          +   '<td class="px-4 py-3">'
          +     '<div class="flex items-center gap-2">'
          +       '<div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden"><div class="h-full ' + barColor(ramPct) + ' rounded-full" style="width:' + ramPct + '%"></div></div>'
          +       '<span class="text-xs text-gray-300">' + (ramPct || 0).toFixed(0) + '%</span>'
          +     '</div>'
          +   '</td>'
          +   '<td class="px-4 py-3 text-gray-300 hidden md:table-cell">' + (diskPct || 0).toFixed(0) + '%</td>'
          +   '<td class="px-4 py-3 text-gray-300 hidden lg:table-cell">' + esc(docker) + '</td>'
          +   '<td class="px-4 py-3 text-gray-400 hidden xl:table-cell text-xs">' + timeAgo(s.lastSeen) + '</td>'
          +   '<td class="px-4 py-3">' + statusBadge + '</td>'
          + '</tr>';
      }).join('');
    }

    /* ----------------------- Modal / detail panel ----------------------- */

    /**
     * Open the detail modal for a given hostname and render its contents
     * including charts.
     * @param {string} hostname
     */
    window.openModal = function (hostname) {
      var s = allServers.find(function (x) { return x.hostname === hostname; });
      if (!s) return;

      document.getElementById('modalTitle').textContent = s.hostname;
      document.getElementById('modalSubtitle').textContent = s.os + ' · ' + s.ip;
      document.getElementById('detailModal').classList.remove('hidden');

      var cpuPct = s.cpu ? s.cpu.usage : 0;
      var ramPct = s.memory ? s.memory.percent : 0;
      var diskPct = s.disk ? s.disk.percent : 0;
      var memUsed = s.memory ? s.memory.used : 0;
      var memTotal = s.memory ? s.memory.total : 0;
      var diskUsed = s.disk ? s.disk.used : 0;
      var diskTotal = s.disk ? s.disk.total : 0;

      var body = ''
        /* --- Usage bars --- */
        + '<div class="space-y-4">'
        +   usageBar(cpuPct, 'CPU Usage')
        +   usageBar(ramPct, 'Memory Usage (' + fmtBytes(memUsed) + ' / ' + fmtBytes(memTotal) + ')')
        +   usageBar(diskPct, 'Disk Usage (' + (diskUsed || 0) + ' / ' + (diskTotal || 0) + ' GB)')
        + '</div>'

        /* --- Metric grid --- */
        + '<div class="grid grid-cols-2 gap-3">'
        +   metricCard('Network RX', fmtBytes(s.network ? s.network.rx : 0), 'M4 16l4-4 4 4 4-4 4 4')
        +   metricCard('Network TX', fmtBytes(s.network ? s.network.tx : 0), 'M4 8l4 4 4-4 4 4 4-4')
        +   metricCard('Docker Containers', (s.docker ? s.docker.containers : 0) + ' total · ' + (s.docker ? s.docker.running : 0) + ' running', 'M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7')
        +   metricCard('Uptime', fmtUptime(s.uptime), 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')
        +   metricCard('First Seen', fmtDate(s.firstSeen), 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')
        +   metricCard('Last Seen', fmtDate(s.lastSeen), 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')
        + '</div>'

        /* --- Charts --- */
        + '<div class="grid grid-cols-1 gap-4">'
        +   '<div class="bg-gray-800/50 border border-gray-700 rounded-xl p-4">'
        +     '<h3 class="text-sm font-medium text-white mb-3">CPU History</h3>'
        +     '<div style="height:180px"><canvas id="cpuChart"></canvas></div>'
        +   '</div>'
        +   '<div class="bg-gray-800/50 border border-gray-700 rounded-xl p-4">'
        +     '<h3 class="text-sm font-medium text-white mb-3">RAM History</h3>'
        +     '<div style="height:180px"><canvas id="ramChart"></canvas></div>'
        +   '</div>'
        + '</div>'

        /* --- JSON payload --- */
        + '<div class="bg-gray-800/50 border border-gray-700 rounded-xl p-4">'
        +   '<h3 class="text-sm font-medium text-white mb-3">JSON Payload</h3>'
        +   '<pre class="text-xs text-gray-400 overflow-x-auto bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto"><code>' + esc(JSON.stringify(s, null, 2)) + '</code></pre>'
        + '</div>';

      document.getElementById('modalBody').innerHTML = body;

      // Build charts after DOM is updated.
      requestAnimationFrame(function () { buildCharts(s); });
    };

    /**
     * Produce a small metric card HTML string.
     * @param {string} label
     * @param {string} value
     * @param {string} iconPath
     * @returns {string}
     */
    function metricCard(label, value, iconPath) {
      return ''
        + '<div class="bg-gray-800/50 border border-gray-700 rounded-xl p-4">'
        +   '<div class="flex items-start gap-3">'
        +     '<div class="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">'
        +       '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="' + iconPath + '"/></svg>'
        +     '</div>'
        +     '<div class="min-w-0">'
        +       '<p class="text-xs text-gray-500 mb-0.5">' + esc(label) + '</p>'
        +       '<p class="text-sm text-white font-medium break-words">' + esc(value) + '</p>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    /**
     * Close the detail modal and destroy any charts it contained.
     */
    window.closeModal = function () {
      document.getElementById('detailModal').classList.add('hidden');
      // Destroy charts to free canvas / memory.
      Object.keys(charts).forEach(function (k) {
        if (charts[k].cpu) { charts[k].cpu.destroy(); }
        if (charts[k].ram) { charts[k].ram.destroy(); }
      });
      charts = {};
    };

    /**
     * Build CPU and RAM history charts inside the modal.
     * @param {Object} s - Server record.
     */
    function buildCharts(s) {
      var labels = s.history.map(function (h) {
        return new Date(h.t).toLocaleTimeString();
      });
      var cpuData = s.history.map(function (h) { return h.cpu; });
      var ramData = s.history.map(function (h) { return h.memPct; });

      var cpuCtx = document.getElementById('cpuChart');
      var ramCtx = document.getElementById('ramChart');
      if (!cpuCtx || !ramCtx) return;

      var baseOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280', maxTicksLimit: 6 }, grid: { color: '#1f2937' } },
          y: { min: 0, max: 100, ticks: { color: '#6b7280', callback: function (v) { return v + '%'; } }, grid: { color: '#1f2937' } },
        },
        elements: { point: { radius: 0, hoverRadius: 4 } },
      };

      charts.cpu = new Chart(cpuCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'CPU %',
            data: cpuData,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          }],
        },
        options: baseOpts,
      });

      charts.ram = new Chart(ramCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'RAM %',
            data: ramData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          }],
        },
        options: baseOpts,
      });
    }

    /* ----------------------- Event listeners ----------------------- */

    document.getElementById('searchBox').addEventListener('input', function (e) {
      currentSearch = e.target.value;
      renderTable();
    });

    document.getElementById('sortBy').addEventListener('change', function (e) {
      currentSort = e.target.value;
      renderTable();
    });

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentFilter = btn.getAttribute('data-filter');
        // Update active styles.
        document.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.remove('bg-brand-600', 'text-white');
          b.classList.add('text-gray-400');
        });
        btn.classList.add('bg-brand-600', 'text-white');
        btn.classList.remove('text-gray-400');
        renderTable();
      });
    });

    // Close modal on Escape.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    // Salin token agent ke clipboard.
    var copyBtn = document.getElementById('copyToken');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var token = document.getElementById('agentToken').textContent;
        var done = function () {
          copyBtn.textContent = 'Tersalin!';
          setTimeout(function () { copyBtn.textContent = 'Salin'; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(token).then(done).catch(done);
        } else {
          done();
        }
      });
    }

    /* ----------------------- Init ----------------------- */

    fetchData();
    setInterval(fetchData, 3000); // refresh every 3 seconds
  })();
  </script>
</body>
</html>`;

module.exports = DASHBOARD_HTML;
