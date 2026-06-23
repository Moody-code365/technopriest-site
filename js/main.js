/* ============================================================
   technopriest.net — main.js
   1) terminal intro animation
   2) projects — live from GitHub via Cloudflare Worker
   ============================================================ */

/* ---------- 1) TERMINAL INTRO ---------- */
(function () {
  var term = document.getElementById('term');
  var P = '<span class="prompt">moody<span class="path">@technopriest:~$</span></span> ';

  var seq = [
    {
      cmd: 'whoami',
      out: [
        '<span class="out"><span class="hl">Filipp</span> · 24 · Almaty, KZ</span>',
        '<span class="out">sysadmin by night — building toward DevOps by doing</span>'
      ]
    },
    {
      cmd: 'cat path.log',
      out: [
        '<span class="out"><span class="hl">web dev (freelance)</span>  →  <span class="hl">device repair</span>  →  <span class="accent">sysadmin</span></span>',
        '<span class="out">night ops: WireGuard VPNs · Zabbix · workstation provisioning</span>',
        '<span class="out">learn stack: <span class="wip">Docker</span> · <span class="wip">Python</span> · <span class="wip">Proxmox</span> · <span class="wip">self-hosting</span></span>'
      ]
    },
    {
      cmd: 'systemctl status lab.service',
      out: [
        '<span class="out"><span class="ok">●</span> lab.service — home-lab bootstrap</span>',
        '<span class="out">   machine-spirit: <span class="wip">awakening</span></span>',
        '<span class="out">   nodes: 3 acquired · provisioning pending</span>',
        '<span class="out">   goal: <span class="accent">real-world DevOps, not tutorial-land</span></span>',
        '<span class="cmt"># <span class="omni">Omnissiah blesses this session.</span> Proceed with purpose.</span>'
      ]
    }
  ];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cursorLine() {
    return '<span class="line">' + P + '<span class="cursor"></span></span>';
  }

  if (reduce) {
    var h = '';
    seq.forEach(function (s) {
      h += '<span class="line">' + P + '<span class="cmd">' + s.cmd + '</span></span>';
      s.out.forEach(function (o) { h += '<span class="line">' + o + '</span>'; });
    });
    h += cursorLine();
    term.innerHTML = h;
    return;
  }

  var built = '';
  var si = 0;

  function typeCmd(text, done) {
    var i = 0;
    var ls = '<span class="line">' + P + '<span class="cmd">';
    (function tick() {
      term.innerHTML = built + ls + text.slice(0, i) + '<span class="cursor"></span></span></span>';
      if (i < text.length) {
        i++;
        setTimeout(tick, 32 + Math.random() * 38);
      } else {
        built += ls + text + '</span></span>';
        done();
      }
    })();
  }

  function printOut(lines, done) {
    var k = 0;
    (function next() {
      if (k < lines.length) {
        built += '<span class="line">' + lines[k] + '</span>';
        term.innerHTML = built + cursorLine();
        k++;
        setTimeout(next, 120);
      } else {
        done();
      }
    })();
  }

  function runStep() {
    if (si >= seq.length) { term.innerHTML = built + cursorLine(); return; }
    var step = seq[si++];
    typeCmd(step.cmd, function () {
      setTimeout(function () {
        printOut(step.out, function () {
          setTimeout(runStep, 340);
        });
      }, 160);
    });
  }

  setTimeout(runStep, 400);
})();


/* ---------- 2) PROJECTS (live GitHub feed) ----------
   Paste your deployed Worker URL into PROJECTS_ENDPOINT below.
   Until it's set/reachable the section shows an honest state —
   it never invents repos. */
(function () {
  var PROJECTS_ENDPOINT = ""; // e.g. "https://technopriest-projects.<you>.workers.dev"

  var grid = document.getElementById('proj-grid');
  if (!grid) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setState(state, text) {
    grid.innerHTML = '<div class="proj-status" data-state="' + esc(state) + '">' + esc(text) + '</div>';
    grid.setAttribute('aria-busy', 'false');
  }

  function chip(t) { return '<span class="pchip">' + esc(t) + '</span>'; }

  function card(p) {
    var chips = [];
    if (p.language) chips.push(p.language);
    (p.topics || []).forEach(function (t) { if (chips.length < 3) chips.push(t); });

    var badge = p.badge
      ? '<span class="proj-badge ' + esc(p.badge) + '">' + esc(p.badge_label || p.badge) + '</span>'
      : '';
    var stars = (p.stars && p.stars > 0)
      ? '<span class="proj-stars">' + String.fromCharCode(9733) + ' ' + esc(p.stars) + '</span>'
      : '';

    return '' +
      '<a class="proj-card" href="' + esc(p.url || '#') + '" target="_blank" rel="noopener">' +
        '<div class="proj-top">' +
          '<span class="proj-name">' + esc(p.name) + '</span>' + badge +
        '</div>' +
        '<div class="proj-desc">' + esc(p.description || 'No description yet.') + '</div>' +
        '<div class="proj-foot">' +
          '<div class="proj-chips">' + chips.map(chip).join('') + '</div>' +
          '<span class="proj-link">' + esc(p.link_label || 'github \u2197') + stars + '</span>' +
        '</div>' +
      '</a>';
  }

  function render(projects) {
    if (!projects || !projects.length) {
      setState('empty', 'no public projects to show yet.');
      return;
    }
    grid.innerHTML = projects.map(card).join('');
    grid.setAttribute('aria-busy', 'false');
  }

  if (!PROJECTS_ENDPOINT) {
    setState('offline', 'projects feed not wired yet — set PROJECTS_ENDPOINT in js/main.js.');
    return;
  }

  fetch(PROJECTS_ENDPOINT, { headers: { 'Accept': 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { render(data && data.projects ? data.projects : data); })
    .catch(function () { setState('offline', 'github feed unreachable — projects offline.'); });
})();
