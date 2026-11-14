/*
 * AURA-CREW — application logic (vanilla JS, no dependencies)
 * Indicators and decision support only. No diagnosis.
 */
(function () {
  'use strict';

  var CFG = window.AURA_CONFIG;
  var SYNTHETIC = window.AURA_SYNTHETIC_HISTORY || [];
  var IND = CFG.indicators;
  var REGIONS = CFG.regions;
  var RANK = { unknown: -1, green: 0, yellow: 1, red: 2 };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var INDICATOR_KEYS = CFG.dashboardIndicators;
  var FORM_FIELDS = CFG.formFields;

  /* ------------------------------------------------------------------ *
   * Storage
   * ------------------------------------------------------------------ */
  function loadUserEntries() {
    try {
      var raw = localStorage.getItem(CFG.storageKey);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveUserEntries() {
    try { localStorage.setItem(CFG.storageKey, JSON.stringify(userEntries)); } catch (e) { /* storage unavailable: keep in memory */ }
  }
  var userEntries = loadUserEntries();

  /** Merged history: one entry per date, user entries replace synthetic ones. */
  function getHistory() {
    var byDate = {};
    SYNTHETIC.forEach(function (e) { byDate[e.date] = e; });
    userEntries.slice().sort(function (a, b) { return a.ts - b.ts; })
      .forEach(function (e) { byDate[e.date] = e; });
    return enrich(Object.keys(byDate).sort().map(function (d) { return byDate[d]; }));
  }

  /**
   * Returns copies of the entries with derived indicators filled in:
   *  - `derived` indicators (7-day exercise totals) are summed over the window
   *  - `carryForwardDays` indicators (periodic bone markers) reuse the latest
   *    measured value for status; `_asof[key]` records when it was measured.
   * Stored entries are never modified.
   */
  function enrich(raw) {
    var lastSeen = {};
    var out = raw.map(function (r) {
      var e = {};
      Object.keys(r).forEach(function (k) { e[k] = r[k]; });
      e._asof = {};
      return e;
    });
    out.forEach(function (e, i) {
      Object.keys(IND).forEach(function (k) {
        var spec = IND[k];
        if (spec.derived) {
          // Only report a total once the history covers the whole window,
          // otherwise early partial sums would look like missed exercise.
          if (dayDiff(out[0].date, e.date) < spec.derived.days - 1) { e[k] = null; return; }
          var sum = 0, count = 0;
          for (var j = i; j >= 0 && dayDiff(out[j].date, e.date) < spec.derived.days; j--) {
            var v = raw[j][spec.derived.from];
            if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
          }
          e[k] = count ? sum : null;
        } else if (spec.carryForwardDays) {
          if (typeof e[k] === 'number' && !isNaN(e[k])) {
            lastSeen[k] = { value: e[k], date: e.date };
          } else if (lastSeen[k] && dayDiff(lastSeen[k].date, e.date) <= spec.carryForwardDays) {
            e[k] = lastSeen[k].value;
            e._asof[k] = lastSeen[k].date;
          }
        }
      });
    });
    return out;
  }

  /** True when the value shown for `k` was actually recorded on this entry's date. */
  function measuredOn(e, k) {
    return e && e[k] != null && !isNaN(e[k]) && !(e._asof && e._asof[k]);
  }

  /* ------------------------------------------------------------------ *
   * Evaluation (thresholds come from config.js)
   * ------------------------------------------------------------------ */
  function inRange(v, r) { return v >= r[0] && v <= r[1]; }

  function evaluate(key, value) {
    var spec = IND[key];
    if (!spec || value === null || value === undefined || isNaN(value)) return 'unknown';
    if (inRange(value, spec.green)) return 'green';
    if (inRange(value, spec.yellow)) return 'yellow';
    return 'red';
  }

  function worst(statuses) {
    return statuses.reduce(function (acc, s) { return RANK[s] > RANK[acc] ? s : acc; }, 'unknown');
  }

  function regionStatus(regionKey, entry) {
    if (!entry) return 'unknown';
    return worst(REGIONS[regionKey].indicators.map(function (k) { return evaluate(k, entry[k]); }));
  }

  function overallStatus(entry) {
    return worst(Object.keys(REGIONS).map(function (k) { return regionStatus(k, entry); }));
  }

  /* ------------------------------------------------------------------ *
   * Formatting helpers
   * ------------------------------------------------------------------ */
  function fmt(key, v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var str = Number(v).toFixed(IND[key].decimals);
    return IND[key].signed && v > 0 ? '+' + str : str;
  }
  function fmtRange(key, r) { return fmt(key, r[0]) + '–' + fmt(key, r[1]); }
  /** Reference text for the "within range" band, using ≥ / ≤ for open-ended ranges. */
  function fmtRef(key) {
    var spec = IND[key], g = spec.green, lim = spec.input;
    if (g[1] >= lim.max) return '≥ ' + fmt(key, g[0]);
    if (g[0] <= lim.min) return '≤ ' + fmt(key, g[1]);
    return fmtRange(key, g);
  }
  function withUnit(key, v) {
    var u = IND[key].unit;
    return fmt(key, v) + (u === '%' ? '%' : ' ' + u);
  }
  /** Small context note for a reading: today's minutes, when a marker was measured, or "not measured". */
  function readingNote(entry, k) {
    var spec = IND[k];
    if (!entry) return '';
    if (spec.derived) {
      var today = entry[spec.derived.from];
      if (entry[k] == null) return 'Needs ' + spec.derived.days + ' days of logs';
      return 'Today ' + (today == null ? '—' : today) + ' min';
    }
    if (entry._asof && entry._asof[k]) return 'Measured ' + shortDate(entry._asof[k]);
    if (spec.optional && (entry[k] == null || isNaN(entry[k]))) return 'Optional · not measured';
    return '';
  }
  function fmtDate(iso) {
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function todayIso() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function svg(tag, attrs, children) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  /* ------------------------------------------------------------------ *
   * Body figure (2D SVG)
   * ------------------------------------------------------------------ */
  // Left half of the silhouette (viewer's left), as cubic segments from the neck
  // down the outside of the arm, back up, down the torso and leg to the crotch.
  // The right half is generated by mirroring around x = 150.
  var BODY_START = [141, 90];
  var BODY_LEFT = [
    ['L', 140, 114],
    [126, 118, 108, 118, 98, 128],
    [88, 138, 86, 160, 85, 185],
    [83, 220, 78, 250, 74, 285],
    [72, 300, 68, 312, 70, 322],
    [74, 332, 86, 330, 87, 318],
    [89, 300, 92, 286, 96, 262],
    [100, 238, 104, 212, 106, 190],
    [108, 178, 110, 170, 112, 166],
    [114, 200, 112, 230, 114, 252],
    [110, 270, 106, 290, 108, 310],
    [110, 360, 114, 410, 116, 440],
    [116, 480, 114, 520, 116, 556],
    [112, 570, 104, 578, 106, 584],
    ['L', 140, 584],
    [142, 570, 140, 560, 140, 550],
    [142, 510, 144, 470, 144, 440],
    [146, 400, 148, 360, 150, 330]
  ];

  function buildBodyPath() {
    var mx = function (x) { return 300 - x; };
    var pts = [BODY_START];
    var d = 'M' + BODY_START.join(' ');
    BODY_LEFT.forEach(function (s) {
      if (s[0] === 'L') { d += ' L' + s[1] + ' ' + s[2]; pts.push([s[1], s[2]]); }
      else { d += ' C' + s.join(' '); pts.push([s[4], s[5]]); }
    });
    // Mirror: walk segments backwards, swapping control points.
    for (var i = BODY_LEFT.length - 1; i >= 0; i--) {
      var s = BODY_LEFT[i], p0 = pts[i];
      if (s[0] === 'L') d += ' L' + mx(p0[0]) + ' ' + p0[1];
      else d += ' C' + [mx(s[2]), s[3], mx(s[0]), s[1], mx(p0[0]), p0[1]].join(' ');
    }
    return d;
  }

  function mirrorPath(fn) { return fn(function (x) { return x; }) + ' ' + fn(function (x) { return 300 - x; }); }

  var DETAIL_PATHS = [
    // clavicles
    mirrorPath(function (m) { return 'M' + m(146) + ' 121 Q' + m(125) + ' 122 ' + m(104) + ' 130'; }),
    // ribs
    [142, 156, 170, 184, 198].map(function (y) {
      return mirrorPath(function (m) { return 'M' + m(147) + ' ' + y + ' C' + m(136) + ' ' + (y - 3) + ' ' + m(122) + ' ' + (y + 3) + ' ' + m(119) + ' ' + (y + 14); });
    }).join(' '),
    // pelvis
    'M112 298 C125 290 140 300 150 314 C160 300 175 290 188 298',
    // knees
    'M124 440 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M164 440 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
    // face guide
    'M150 40 L150 76 M136 56 L164 56'
  ];

  // Visual geometry for each clickable region. `side` places the callout label.
  var REGION_GEOMETRY = {
    brain: {
      short: 'Brain · Mind', hotspot: [150, 46], side: 'right', labelY: 40,
      zone: function (g) {
        g.appendChild(svg('ellipse', { class: 'zone', cx: 150, cy: 50, rx: 20, ry: 22 }));
        g.appendChild(svg('path', { class: 'zone-line', style: 'stroke-width:1;opacity:.5',
          d: 'M150 30 L150 70 M136 44 Q143 48 136 54 M164 44 Q157 48 164 54 M138 62 Q144 60 146 66 M162 62 Q156 60 154 66' }));
      }
    },
    heart: {
      short: 'Cardio', hotspot: [160, 172], side: 'right', labelY: 140,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone',
          d: 'M160 188 C149 180 143 172 145 165 C147 158 156 158 160 165 C164 158 173 158 175 165 C177 172 171 180 160 188 Z' }));
      }
    },
    immune: {
      short: 'Immune', hotspot: [180, 226], side: 'right', labelY: 262,
      zone: function (g) {
        g.appendChild(svg('ellipse', { class: 'zone', cx: 180, cy: 226, rx: 7, ry: 11 }));
        [[140, 104], [160, 104], [117, 172], [183, 172], [132, 318], [168, 318]].forEach(function (p) {
          g.appendChild(svg('circle', { class: 'zone', cx: p[0], cy: p[1], r: 2.6 }));
        });
      }
    },
    metabolism: {
      short: 'Metabolism', hotspot: [134, 229], side: 'left', labelY: 236,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone',
          d: 'M119 220 C126 211 148 211 154 219 C152 231 139 243 125 242 C118 238 115 228 119 220 Z' }));
        g.appendChild(svg('path', { class: 'zone', d: 'M150 248 C156 244 166 244 170 248 C166 252 156 252 150 248 Z' }));
      }
    },
    musculoskeletal: {
      short: 'Bone · Muscle', hotspot: [130, 380], side: 'left', labelY: 396,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone-line',
          d: 'M128 322 L132 430 M172 322 L168 430 M130 452 L129 546 M170 452 L171 546 M96 142 L91 205 M204 142 L209 205 M88 220 L80 282 M212 220 L220 282' }));
      }
    }
  };

  var regionNodes = {};

  function renderBodyFigure() {
    var root = document.getElementById('body-svg');
    root.innerHTML = '';

    var defs = svg('defs', null, [
      svg('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, [
        svg('feGaussianBlur', { stdDeviation: '2.2', result: 'b' }),
        svg('feMerge', null, [svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })])
      ]),
      svg('radialGradient', { id: 'halo', cx: '50%', cy: '45%', r: '55%' }, [
        svg('stop', { offset: '0%', 'stop-color': '#3de8ff', 'stop-opacity': '.14' }),
        svg('stop', { offset: '100%', 'stop-color': '#3de8ff', 'stop-opacity': '0' })
      ])
    ]);
    root.appendChild(defs);

    // Holographic base: halo + platform rings
    root.appendChild(svg('ellipse', { cx: 150, cy: 300, rx: 170, ry: 300, fill: 'url(#halo)' }));
    root.appendChild(svg('ellipse', { cx: 150, cy: 590, rx: 70, ry: 9, class: 'body-detail', style: 'opacity:.5' }));
    root.appendChild(svg('ellipse', { cx: 150, cy: 590, rx: 100, ry: 13, class: 'body-detail dashed' }));

    var body = svg('g', { class: 'glow' }, [
      svg('ellipse', { class: 'body-outline', cx: 150, cy: 54, rx: 28, ry: 37 }),
      svg('path', { class: 'body-outline', d: buildBodyPath() })
    ]);
    root.appendChild(body);

    var details = svg('g');
    DETAIL_PATHS.forEach(function (d) { details.appendChild(svg('path', { class: 'body-detail', d: d })); });
    details.appendChild(svg('path', { class: 'body-detail dashed', d: 'M150 116 L150 300' }));
    root.appendChild(details);

    // Regions
    Object.keys(REGION_GEOMETRY).forEach(function (key) {
      var geo = REGION_GEOMETRY[key];
      var g = svg('g', {
        class: 'region', 'data-region': key, 'data-status': 'unknown',
        tabindex: '0', role: 'button', 'aria-label': REGIONS[key].name
      });
      geo.zone(g);

      var hx = geo.hotspot[0], hy = geo.hotspot[1], ly = geo.labelY;
      var right = geo.side === 'right';
      var boxX = right ? 232 : -62, boxW = 122;
      var elbowX = right ? 218 : 82;
      var edgeX = right ? boxX : boxX + boxW;
      g.appendChild(svg('polyline', { class: 'leader', points: [hx, hy, elbowX, ly, edgeX, ly].join(' ') }));
      g.appendChild(svg('circle', { class: 'pulse', cx: hx, cy: hy, r: 6 }));
      g.appendChild(svg('circle', { class: 'hotspot glow', cx: hx, cy: hy, r: 4.5 }));

      g.appendChild(svg('rect', { class: 'label-box', x: boxX, y: ly - 18, width: boxW, height: 36, rx: 6 }));
      g.appendChild(svg('text', { class: 'label-name', x: boxX + 9, y: ly - 3, text: geo.short }));
      var st = svg('text', { class: 'label-status', x: boxX + 9, y: ly + 11, text: '—' });
      g.appendChild(st);

      g.appendChild(svg('title', { text: REGIONS[key].name }));
      g.addEventListener('click', function () { openRegion(key, g); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openRegion(key, g); }
      });
      root.appendChild(g);
      regionNodes[key] = { group: g, statusText: st };
    });
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  var OVERALL_COPY = {
    green: 'All tracked indicators are within the configured reference ranges.',
    yellow: 'Some indicators are outside the reference range. Keep monitoring and review the flagged systems.',
    red: 'One or more indicators need attention. Review the flagged systems and consider contacting your flight surgeon.',
    unknown: 'No check-in data yet. Record a daily check-in to see indicator status.'
  };

  /* ------------------------------------------------------------------ *
   * What-if scenarios, score and streak
   * ------------------------------------------------------------------ */
  var SCENARIOS = CFG.scenarios || {};
  var activeScenarios = {};

  function simulating() { return Object.keys(activeScenarios).some(function (k) { return activeScenarios[k]; }); }

  function applyScenarios(entry) {
    if (!entry || !simulating()) return entry;
    var sim = {};
    Object.keys(entry).forEach(function (k) { sim[k] = entry[k]; });
    Object.keys(activeScenarios).forEach(function (sk) {
      if (!activeScenarios[sk]) return;
      var deltas = SCENARIOS[sk].deltas;
      Object.keys(deltas).forEach(function (k) { if (sim[k] != null) sim[k] += deltas[k]; });
    });
    INDICATOR_KEYS.forEach(function (k) {
      if (sim[k] == null) return;
      var lim = IND[k].input, f = Math.pow(10, IND[k].decimals);
      sim[k] = Math.round(Math.max(lim.min, Math.min(lim.max, sim[k])) * f) / f;
    });
    sim.simulated = true;
    return sim;
  }

  /** The entry the dashboard shows: the latest check-in, with any what-if offsets applied. */
  function currentEntry(history) { return applyScenarios(history[history.length - 1] || null); }

  function indicatorScore(entry) {
    if (!entry) return null;
    var pts = CFG.score.points, total = 0, n = 0;
    INDICATOR_KEYS.forEach(function (k) {
      var st = evaluate(k, entry[k]);
      if (st === 'unknown') return;
      total += pts[st]; n++;
    });
    return n ? Math.round(total / n) : null;
  }

  function dayDiff(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }

  /** Consecutive check-in days ending today (or yesterday, if today is not logged yet). */
  function streak(history) {
    if (!history.length) return { days: 0, synthetic: false };
    var last = history[history.length - 1];
    if (dayDiff(last.date, todayIso()) > 1) return { days: 0, synthetic: false };
    var days = 1, synthetic = last.source === 'synthetic';
    for (var i = history.length - 1; i > 0; i--) {
      if (dayDiff(history[i - 1].date, history[i].date) !== 1) break;
      days++;
      if (history[i - 1].source === 'synthetic') synthetic = true;
    }
    return { days: days, synthetic: synthetic };
  }

  function renderScenarios() {
    var box = document.getElementById('whatif');
    box.innerHTML = '';
    Object.keys(SCENARIOS).forEach(function (sk) {
      var sc = SCENARIOS[sk];
      var on = !!activeScenarios[sk];
      var deltas = Object.keys(sc.deltas).map(function (k) {
        var d = sc.deltas[k];
        return IND[k].short + ' ' + (d > 0 ? '+' : '') + d;
      }).join(' · ');
      var btn = el('button', { type: 'button', class: 'whatif-toggle', 'aria-pressed': String(on), title: deltas }, [
        el('span', { class: 'switch', 'aria-hidden': 'true' }),
        el('span', { class: 'wt-text' }, [
          el('strong', { text: sc.label }),
          el('span', { text: sc.detail }),
          CONTENT.hazards[sc.hazard] ? el('span', { class: 'wt-hazard', text: 'Hazard · ' + CONTENT.hazards[sc.hazard].short }) : null
        ])
      ]);
      btn.addEventListener('click', function () {
        activeScenarios[sk] = !activeScenarios[sk];
        renderScenarios();
        render();
      });
      box.appendChild(btn);
    });
    document.getElementById('whatif-reset').hidden = !simulating();
  }

  function render() {
    var history = getHistory();
    var latest = currentEntry(history);
    var previous = history[history.length - 2] || null;
    var overall = overallStatus(latest);
    var sim = simulating();
    document.body.classList.toggle('simulating', sim);
    document.getElementById('sim-banner').hidden = !sim;

    // Synthetic badge
    var hasSynthetic = history.some(function (e) { return e.source === 'synthetic'; });
    document.getElementById('synthetic-badge').hidden = !hasSynthetic;

    // Body figure regions
    Object.keys(regionNodes).forEach(function (key) {
      var s = regionStatus(key, latest);
      regionNodes[key].group.setAttribute('data-status', s);
      regionNodes[key].group.setAttribute('aria-label', REGIONS[key].name + ': ' + CFG.statusText[s]);
      regionNodes[key].statusText.textContent = CFG.statusText[s];
    });

    // Overall
    var chip = document.getElementById('overall-chip');
    chip.setAttribute('data-status', overall);
    chip.textContent = 'Overall · ' + CFG.statusText[overall];
    var card = document.getElementById('overall-card');
    card.setAttribute('data-status', overall);
    document.getElementById('overall-label').textContent = CFG.statusText[overall];
    document.getElementById('overall-text').textContent = OVERALL_COPY[overall];
    document.getElementById('latest-date').textContent = latest
      ? 'Latest · ' + fmtDate(latest.date) + (latest.source === 'synthetic' ? ' · synthetic' : ' · your entry') + (sim ? ' · simulated' : '')
      : '—';

    // Score + streak
    var score = indicatorScore(latest);
    var recentScores = history.slice(-7).map(indicatorScore).filter(function (v) { return v != null; });
    var avg = recentScores.length ? Math.round(recentScores.reduce(function (a, b) { return a + b; }, 0) / recentScores.length) : null;
    document.getElementById('score-value').textContent = score == null ? '—' : score;
    document.getElementById('gauge-arc').style.strokeDasharray = (score || 0) + ' 100';
    document.getElementById('score-gauge').setAttribute('aria-label', 'Indicator score ' + (score == null ? 'not available' : score + ' out of 100'));
    document.getElementById('stat-score').textContent = score == null ? '—' : score + ' / 100';
    document.getElementById('stat-score-sub').textContent = avg == null ? '' : (sim ? 'Simulated · 7-day avg ' + avg + ' recorded' : '7-day avg ' + avg);
    var stk = streak(history);
    document.getElementById('stat-streak').textContent = stk.days + (stk.days === 1 ? ' day' : ' days');
    document.getElementById('stat-streak-sub').textContent = stk.days === 0 ? 'Check in today to start' : (stk.synthetic ? 'Includes synthetic days' : 'Keep it going');
    var userCount = history.filter(function (e) { return e.source === 'user'; }).length;
    document.getElementById('log-count').textContent = history.length + ' days logged · ' + userCount + ' yours';

    // System list
    var list = document.getElementById('system-list');
    list.innerHTML = '';
    Object.keys(REGIONS).forEach(function (key) {
      var s = regionStatus(key, latest);
      var btn = el('button', { type: 'button', 'data-status': s }, [
        el('span', { class: 'dot' }),
        el('span', { class: 'name', text: REGIONS[key].name }),
        el('span', { class: 'st', text: CFG.statusText[s] })
      ]);
      btn.addEventListener('click', function () { openRegion(key, btn); });
      list.appendChild(el('li', null, [btn]));
    });

    // Latest readings
    var readings = document.getElementById('readings');
    readings.innerHTML = '';
    INDICATOR_KEYS.forEach(function (key) {
      var spec = IND[key];
      var v = latest ? latest[key] : null;
      var s = evaluate(key, v);
      var deltaText = readingNote(latest, key);
      if (!deltaText && previous && v != null && previous[key] != null) {
        var diff = v - previous[key];
        var arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '■';
        deltaText = arrow + ' ' + (diff > 0 ? '+' : '') + diff.toFixed(spec.decimals) + ' vs prev';
      }
      var valNode = el('span', { class: 'r-val', text: fmt(key, v) });
      valNode.appendChild(el('small', { text: spec.unit }));
      readings.appendChild(el('li', { 'data-status': s, title: CFG.statusText[s] }, [
        el('span', { class: 'r-name', text: spec.label }),
        valNode,
        el('span', { class: 'r-ref', text: 'Ref ' + fmtRef(key) }),
        el('span', { class: 'r-delta', text: deltaText })
      ]));
    });

    renderHazards(latest);
    if (openKey) renderDrawer(openKey);
  }

  /* ------------------------------------------------------------------ *
   * Hazards section
   * ------------------------------------------------------------------ */
  var HAZARD_ICONS = {
    radiation: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M12 3a9 9 0 0 1 7.8 4.5L14.6 10.5 M4.2 7.5A9 9 0 0 1 12 3v6 M7.5 19.8A9 9 0 0 0 16.5 19.8L13.5 14.6 M10.5 14.6L7.5 19.8',
    isolation: 'M12 4a8 8 0 1 0 0.01 0Z M12 9a2.2 2.2 0 1 0 0.01 0Z M8.5 16.5c.8-1.8 2-2.6 3.5-2.6s2.7.8 3.5 2.6',
    distance: 'M5 18a2 2 0 1 0 0.01 0Z M19 6a2 2 0 1 0 0.01 0Z M6.5 16.5L17.5 7.5 M3 6h4 M17 18h4',
    gravity: 'M12 3v14 M7 12l5 5 5-5 M5 21h14',
    environment: 'M4 8h16v10H4Z M8 8V5h8v3 M8 13h.01 M12 13h.01 M16 13h.01'
  };

  function renderHazards(latest) {
    var grid = document.getElementById('hazard-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(CONTENT.hazards).forEach(function (id) {
      var hz = CONTENT.hazards[id];
      var icon = svg('svg', { viewBox: '0 0 24 24', class: 'hazard-icon', 'aria-hidden': 'true' }, [svg('path', { d: HAZARD_ICONS[id] || '' })]);

      var inds = el('ul', { class: 'hz-indicators' });
      (hz.indicators || []).forEach(function (k) {
        var v = latest ? latest[k] : null;
        var st = evaluate(k, v);
        inds.appendChild(el('li', { 'data-status': st, title: CFG.statusText[st] }, [
          el('span', { class: 'dot' }),
          el('span', { text: IND[k].short }),
          el('span', { class: 'hz-val', text: withUnit(k, v) })
        ]));
      });

      var systems = el('div', { class: 'hz-systems' });
      Object.keys(REGIONS).forEach(function (rk) {
        var rc = CONTENT.regions[rk];
        if (!rc || !rc.hazards.some(function (h) { return h.id === id; })) return;
        var st = regionStatus(rk, latest);
        var b = el('button', { type: 'button', class: 'hz-system', 'data-status': st }, [
          el('span', { class: 'dot' }), el('span', { text: REGIONS[rk].name })
        ]);
        b.addEventListener('click', function () { openRegion(rk, b); });
        systems.appendChild(b);
      });

      grid.appendChild(el('article', { class: 'hazard-card', id: 'hazard-' + id, tabindex: '-1' }, [
        el('header', null, [icon, el('h3', { text: hz.name })]),
        el('p', { class: 'hz-summary', text: hz.summary }),
        el('p', { class: 'hz-effect', text: hz.effect }),
        el('p', { class: 'hz-label', text: 'May affect these indicators' }),
        inds,
        el('p', { class: 'hz-label', text: 'Related body systems' }),
        systems
      ]));
    });
  }

  function focusHazard(id) {
    var card = document.getElementById('hazard-' + id);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
  }

  /* ------------------------------------------------------------------ *
   * Region drawer
   * ------------------------------------------------------------------ */
  var openKey = null;
  var lastTrigger = null;
  var drawer = document.getElementById('drawer');
  var backdrop = document.getElementById('drawer-backdrop');

  var CONTENT = window.AURA_CONTENT || { regions: {}, hazards: {} };
  var DISCLAIMER = 'Decision support only, confirm with your medical officer.';

  function section(title, children) {
    return el('section', null, [el('h3', { text: title })].concat(children));
  }

  function renderDrawer(key) {
    var history = getHistory();
    var latest = currentEntry(history);
    var region = REGIONS[key];
    var content = CONTENT.regions[key] || {};
    var s = regionStatus(key, latest);
    document.getElementById('drawer-title').textContent = region.name;
    var body = document.getElementById('drawer-body');
    var scroll = body.scrollTop;
    body.innerHTML = '';

    // Status line
    body.appendChild(el('section', { class: 'drawer-status' }, [
      el('span', { class: 'status-chip', 'data-status': s, text: CFG.statusText[s] }),
      el('span', { class: 'meta', text: latest ? 'Latest check-in · ' + fmtDate(latest.date) + (latest.simulated ? ' · simulated' : '') : 'No check-in yet' })
    ]));
    if (latest && latest.simulated) {
      body.appendChild(el('p', { class: 'sim-note', text: 'What-if simulation is on. Status and values below include illustrative offsets; the trend chart shows recorded data only.' }));
    }

    // Red: flight surgeon note
    if (s === 'red') {
      body.appendChild(el('div', { class: 'alert', role: 'alert' }, [
        el('strong', { text: 'Contact your flight surgeon.' }),
        el('span', { text: ' One or more indicators for this system are outside the monitor range. Share the readings below with the medical team.' })
      ]));
    }

    // Indicators used
    var ul = el('ul', { class: 'readings' });
    region.indicators.forEach(function (k) {
      var v = latest ? latest[k] : null;
      var st = evaluate(k, v);
      var valNode = el('span', { class: 'r-val', text: fmt(k, v) });
      valNode.appendChild(el('small', { text: IND[k].unit }));
      ul.appendChild(el('li', { 'data-status': st }, [
        el('span', { class: 'r-name', text: IND[k].label }),
        valNode,
        el('span', { class: 'r-ref', text: 'Ref ' + fmtRef(k) + ' · ' + CFG.statusText[st] }),
        el('span', { class: 'r-delta', text: readingNote(latest, k) })
      ]));
    });
    body.appendChild(section('Indicators used', [ul]));

    // Alertness: reaction self-test (brain & mind)
    if (content.alertness) {
      var alertStatus = worst(['reactionMedian', 'lapses'].map(function (k) { return evaluate(k, latest ? latest[k] : null); }));
      var testBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Run 1-minute reaction test' });
      testBtn.addEventListener('click', function () { openReactionTest(testBtn); });
      body.appendChild(section('Alertness', [
        el('p', { class: 'alertness-note' + (alertStatus === 'yellow' || alertStatus === 'red' ? ' warn' : ''), text: content.alertness }),
        el('p', { class: 'meta', text: 'Tap when the circle lights up. Records median reaction time and lapses (responses over ' + CFG.reactionTest.lapseMs + ' ms) into the check-in form.' }),
        testBtn
      ]));
    }

    // What it does
    if (content.what) body.appendChild(section('What this system does', [el('p', { text: content.what })]));

    // What research shows
    if (content.research) {
      var rl = el('ul', { class: 'research' });
      content.research.forEach(function (t) { rl.appendChild(el('li', { text: t })); });
      body.appendChild(section('What research shows', [rl]));
    }

    // Why spaceflight affects it
    if (content.hazards) {
      var hl = el('ul', { class: 'hazard-list' });
      content.hazards.forEach(function (h) {
        var hz = CONTENT.hazards[h.id] || { name: h.id };
        hl.appendChild(el('li', null, [
          el('a', { class: 'hazard-chip', href: '#hazard-' + h.id, 'data-hazard': h.id, text: hz.name }),
          el('p', { text: h.why })
        ]));
      });
      var src = el('p', { class: 'source' });
      src.appendChild(document.createTextNode('Based on NASA HRP: '));
      src.appendChild(el('a', { href: CONTENT.hazardsUrl, target: '_blank', rel: 'noopener', text: '5 Hazards of Human Spaceflight' }));
      body.appendChild(section('Why spaceflight may affect it', [hl, src]));
    }

    // 30-day trend
    var recent = history.slice(-30);
    var charts = region.indicators.map(function (k) { return trendChart(k, recent); });
    body.appendChild(section('30-day trend', charts.concat([dataTable(region.indicators, recent)])));

    // How to measure it in space
    if (content.measure) {
      var ol = el('ol', { class: 'steps' });
      content.measure.forEach(function (t) { ol.appendChild(el('li', { text: t })); });
      body.appendChild(section('How to measure it in space', [ol]));
    }

    // Recommended actions
    if (content.actions) {
      var acts = content.actions[s] || content.actions.green;
      var al = el('ul', { class: 'actions' });
      acts.forEach(function (t) {
        al.appendChild(el('li', null, [
          el('span', { text: t + ' ' }),
          el('em', { class: 'disclaimer', text: DISCLAIMER })
        ]));
      });
      var actionKids = [al];
      if (s === 'red') {
        actionKids.unshift(el('p', { class: 'alert alert-inline', text: 'Contact your flight surgeon. ' + DISCLAIMER }));
      }
      body.appendChild(section('Recommended actions', actionKids));
    }

    body.scrollTop = scroll;
  }

  /* ------------------------------------------------------------------ *
   * Trend chart (inline SVG, one small chart per indicator)
   * ------------------------------------------------------------------ */
  function trendChart(key, entries) {
    var spec = IND[key];
    var W = 460, H = 132, L = 40, R = 12, T = 12, B = 24;
    // Only values recorded on that day (bone markers are not carried forward on the chart).
    var pts = [];
    entries.forEach(function (e, i) { if (measuredOn(e, key)) pts.push({ e: e, i: i }); });
    var wrap = el('figure', { class: 'chart' });
    var cap = el('figcaption', null, [
      el('span', { text: spec.label }),
      el('span', { class: 'meta', text: spec.unit + ' · ' + pts.length + (pts.length === 1 ? ' reading' : ' readings') })
    ]);
    wrap.appendChild(cap);
    if (!pts.length) { wrap.appendChild(el('p', { class: 'meta', text: spec.optional ? 'Not measured in this period (optional).' : 'No data yet.' })); return wrap; }

    // Y domain from the data plus any band edges that are not open-ended.
    var lim = spec.input;
    var inner = [spec.green[0], spec.green[1], spec.yellow[0], spec.yellow[1]].filter(function (b) { return b > lim.min && b < lim.max; });
    var vals = pts.map(function (p) { return p.e[key]; });
    var lo = Math.min.apply(null, vals.concat(inner));
    var hi = Math.max.apply(null, vals.concat(inner));
    var padY = (hi - lo) * 0.12 || 1;
    lo -= padY; hi += padY;
    var span = Math.max(1, entries.length - 1);
    var x = function (i) { return entries.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / span; };
    var y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo); };
    var clampY = function (v) { return Math.max(T, Math.min(H - B, y(v))); };
    var last = pts[pts.length - 1];

    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg', role: 'img',
      'aria-label': spec.label + ', ' + pts.length + ' readings in the last ' + entries.length + ' days. Latest ' + withUnit(key, last.e[key]) +
        ', reference ' + fmtRef(key) + '.' });

    // Reference bands: yellow (monitor) under green (within range)
    root.appendChild(svg('rect', { class: 'band band-yellow', x: L, width: W - L - R,
      y: clampY(spec.yellow[1]), height: clampY(spec.yellow[0]) - clampY(spec.yellow[1]) }));
    root.appendChild(svg('rect', { class: 'band band-green', x: L, width: W - L - R,
      y: clampY(spec.green[1]), height: clampY(spec.green[0]) - clampY(spec.green[1]) }));

    // Y labels at the interior green bounds, X labels at the ends of the window
    [spec.green[0], spec.green[1]].forEach(function (v) {
      if (v <= lim.min || v >= lim.max) return;
      root.appendChild(svg('line', { class: 'gridline', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      root.appendChild(svg('text', { class: 'axis', x: L - 6, y: y(v) + 3, 'text-anchor': 'end', text: fmt(key, v) }));
    });
    root.appendChild(svg('text', { class: 'axis', x: L, y: H - 6, text: shortDate(entries[0].date) }));
    root.appendChild(svg('text', { class: 'axis', x: W - R, y: H - 6, 'text-anchor': 'end', text: shortDate(entries[entries.length - 1].date) }));

    // Line
    var d = pts.map(function (p, n) { return (n ? 'L' : 'M') + x(p.i).toFixed(1) + ' ' + y(p.e[key]).toFixed(1); }).join(' ');
    root.appendChild(svg('path', { class: 'trend-line', d: d }));

    // Markers: out-of-range days, user entries, sparse series, and the latest point
    var sparse = pts.length <= 8;
    pts.forEach(function (p) {
      var st = evaluate(key, p.e[key]);
      var isLast = p === last;
      if (st === 'green' && !isLast && !sparse && p.e.source !== 'user') return;
      root.appendChild(svg('circle', { class: 'marker' + (p.e.source === 'user' ? ' user' : ''), 'data-status': st,
        cx: x(p.i), cy: y(p.e[key]), r: isLast ? 5 : 4 }));
    });

    // Hover layer: snaps to the nearest recorded point
    var cross = svg('line', { class: 'crosshair', y1: T, y2: H - B, x1: 0, x2: 0, visibility: 'hidden' });
    var dot = svg('circle', { class: 'hover-dot', r: 5, visibility: 'hidden' });
    root.appendChild(cross);
    root.appendChild(dot);
    var hit = svg('rect', { x: L - 6, y: 0, width: W - L - R + 12, height: H, fill: 'transparent' });
    root.appendChild(hit);
    var tip = el('div', { class: 'chart-tip', hidden: '' });

    function show(ev) {
      var rect = root.getBoundingClientRect();
      var px = (ev.clientX - rect.left) * W / rect.width;
      var best = pts[0];
      pts.forEach(function (p) { if (Math.abs(x(p.i) - px) < Math.abs(x(best.i) - px)) best = p; });
      var e = best.e, st = evaluate(key, e[key]);
      cross.setAttribute('x1', x(best.i)); cross.setAttribute('x2', x(best.i)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(best.i)); dot.setAttribute('cy', y(e[key])); dot.setAttribute('data-status', st); dot.setAttribute('visibility', 'visible');
      tip.innerHTML = '';
      tip.appendChild(el('strong', { text: withUnit(key, e[key]) }));
      tip.appendChild(el('span', { text: fmtDate(e.date) + (e.source === 'synthetic' ? ' · synthetic' : ' · your entry') }));
      tip.appendChild(el('span', { class: 'tip-status', 'data-status': st, text: CFG.statusText[st] }));
      tip.hidden = false;
      var left = x(best.i) / W * rect.width;
      tip.style.left = Math.max(60, Math.min(rect.width - 60, left)) + 'px';
    }
    function hide() { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);

    var holder = el('div', { class: 'chart-holder' }, [root, tip]);
    wrap.appendChild(holder);
    return wrap;
  }

  function shortDate(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function dataTable(keys, entries) {
    var table = el('table', { class: 'data-table' });
    var head = el('tr', null, [el('th', { scope: 'col', text: 'Date' })]);
    keys.forEach(function (k) { head.appendChild(el('th', { scope: 'col', text: IND[k].short + ' (' + IND[k].unit + ')' })); });
    table.appendChild(el('thead', null, [head]));
    var tb = el('tbody');
    entries.slice().reverse().forEach(function (e) {
      var tr = el('tr', null, [el('th', { scope: 'row', text: shortDate(e.date) + (e.source === 'user' ? ' •' : '') })]);
      keys.forEach(function (k) {
        var m = measuredOn(e, k);
        tr.appendChild(el('td', { 'data-status': m ? evaluate(k, e[k]) : 'unknown', text: m ? fmt(k, e[k]) : '—' }));
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    return el('details', { class: 'table-view' }, [
      el('summary', { text: 'Show data table' }),
      el('div', { class: 'table-scroll' }, [table]),
      el('p', { class: 'meta', text: '• = your entry. Other rows are synthetic demo data. Exercise columns are 7-day totals; bone markers appear only on days they were measured.' })
    ]);
  }

  function openRegion(key, trigger) {
    openKey = key;
    lastTrigger = trigger || null;
    Object.keys(regionNodes).forEach(function (k) {
      regionNodes[k].group.classList.toggle('active', k === key);
    });
    renderDrawer(key);
    backdrop.hidden = false;
    requestAnimationFrame(function () {
      backdrop.classList.add('open');
      drawer.classList.add('open');
    });
    drawer.setAttribute('aria-hidden', 'false');
    document.getElementById('drawer-close').focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!openKey) return;
    openKey = null;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    Object.keys(regionNodes).forEach(function (k) { regionNodes[k].group.classList.remove('active'); });
    setTimeout(function () { if (!openKey) backdrop.hidden = true; }, 320);
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
  }

  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-body').addEventListener('click', function (ev) {
    var chip = ev.target.closest && ev.target.closest('a.hazard-chip');
    if (!chip) return;
    ev.preventDefault();
    lastTrigger = null;
    closeDrawer();
    setTimeout(function () { focusHazard(chip.getAttribute('data-hazard')); }, 200);
  });
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (typeof closeReactionTest === 'function' && closeReactionTest()) return;
    closeDrawer();
  });

  /* ------------------------------------------------------------------ *
   * Check-in form
   * ------------------------------------------------------------------ */
  var form = document.getElementById('checkin-form');
  var formError = document.getElementById('form-error');

  function setupForm() {
    FORM_FIELDS.forEach(function (k) {
      var input = form.elements[k];
      if (!input || input.type !== 'number') return;
      var lim = IND[k].input;
      input.min = lim.min; input.max = lim.max; input.step = lim.step;
    });
    form.elements.date.value = todayIso();
    form.elements.date.max = todayIso();
    // Pre-fill required fields with the latest values as a convenient starting point.
    // Optional, periodic fields (bone markers, reaction test) start blank.
    var history = getHistory();
    var latest = history[history.length - 1];
    if (latest) {
      FORM_FIELDS.forEach(function (k) {
        if (IND[k].optional) return;
        if (k === 'mood') {
          var r = form.querySelector('input[name="mood"][value="' + latest.mood + '"]');
          if (r) r.checked = true;
        } else if (latest[k] != null) {
          form.elements[k].value = fmt(k, latest[k]);
        }
      });
    }
    ['resistiveMin', 'aerobicMin', 'date'].forEach(function (k) {
      form.elements[k].addEventListener('input', updateExerciseNote);
    });
    updateExerciseNote();
    updateReactionSummary();
  }

  /** Live 7-day totals for the form: the 6 days before the chosen date plus today's inputs. */
  function updateExerciseNote() {
    var date = form.elements.date.value;
    var note = document.getElementById('exercise-7d');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { note.textContent = ''; return; }
    var history = getHistory();
    var parts = ['resistive7d', 'aerobic7d'].map(function (k) {
      var spec = IND[k], from = spec.derived.from, sum = 0;
      history.forEach(function (e) {
        var dd = dayDiff(e.date, date);
        if (dd > 0 && dd < spec.derived.days && typeof e[from] === 'number') sum += e[from];
      });
      var today = parseFloat(form.elements[from].value);
      if (!isNaN(today)) sum += today;
      var st = evaluate(k, sum);
      return { text: (k === 'resistive7d' ? 'Resistive ' : 'Aerobic ') + sum + ' min', st: st };
    });
    note.innerHTML = '';
    note.appendChild(document.createTextNode('7-day totals incl. this entry: '));
    parts.forEach(function (p, i) {
      if (i) note.appendChild(document.createTextNode(' · '));
      var span = el('span', { class: 'inline-status', 'data-status': p.st, title: CFG.statusText[p.st] }, [el('span', { class: 'dot' })]);
      span.appendChild(document.createTextNode(p.text));
      note.appendChild(span);
    });
  }

  function updateReactionSummary() {
    var med = form.elements.reactionMedian.value, lap = form.elements.lapses.value;
    var summary = document.getElementById('rt-summary');
    var has = med !== '' && lap !== '';
    summary.innerHTML = '';
    if (!has) {
      summary.textContent = 'Not tested yet';
    } else {
      ['reactionMedian', 'lapses'].forEach(function (k, i) {
        var v = parseFloat(form.elements[k].value);
        if (i) summary.appendChild(document.createTextNode(' · '));
        var span = el('span', { class: 'inline-status', 'data-status': evaluate(k, v) }, [el('span', { class: 'dot' })]);
        span.appendChild(document.createTextNode(k === 'reactionMedian' ? 'Median ' + v + ' ms' : v + (v === 1 ? ' lapse' : ' lapses')));
        summary.appendChild(span);
      });
    }
    document.getElementById('rt-clear').hidden = !has;
  }

  document.getElementById('rt-clear').addEventListener('click', function () {
    form.elements.reactionMedian.value = '';
    form.elements.lapses.value = '';
    updateReactionSummary();
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var errors = [];
    var entry = { source: 'user', ts: Date.now() };
    form.querySelectorAll('input.invalid').forEach(function (i) { i.classList.remove('invalid'); });

    var date = form.elements.date.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push('Choose a date.'); form.elements.date.classList.add('invalid'); }
    entry.date = date;

    FORM_FIELDS.forEach(function (k) {
      var spec = IND[k], lim = spec.input;
      var input = k === 'mood' ? null : form.elements[k];
      var raw = k === 'mood'
        ? (form.querySelector('input[name="mood"]:checked') || {}).value
        : input.value;
      var v = parseFloat(raw);
      var blank = raw === undefined || raw === '' || isNaN(v);
      if (blank && spec.optional) return;
      if (blank) {
        errors.push(spec.short + ' is required.');
        if (input) input.classList.add('invalid');
        return;
      }
      if (v < lim.min || v > lim.max) {
        errors.push(spec.short + ' must be between ' + lim.min + ' and ' + lim.max + ' ' + spec.unit + '.');
        if (input) input.classList.add('invalid');
        return;
      }
      entry[k] = spec.decimals ? Math.round(v * 10) / 10 : Math.round(v);
    });
    if (!errors.length && entry.diastolic >= entry.systolic) {
      errors.push('Diastolic should be lower than systolic. Please re-check the reading.');
      form.elements.diastolic.classList.add('invalid');
    }

    if (errors.length) {
      formError.textContent = errors.join(' ');
      formError.hidden = false;
      return;
    }
    formError.hidden = true;
    userEntries.push(entry);
    saveUserEntries();
    render();
    updateExerciseNote();
    toast('Check-in recorded for ' + fmtDate(entry.date) + ' · overall: ' + CFG.statusText[overallStatus(getHistory().slice(-1)[0])]);
  });

  /* ------------------------------------------------------------------ *
   * Reaction self-test (inspired by the psychomotor vigilance test)
   * Not a validated clinical test.
   * ------------------------------------------------------------------ */
  var RT = CFG.reactionTest;
  var rtOverlay = document.getElementById('rt-overlay');
  var rtTarget = document.getElementById('rt-target');
  var rtFeedback = document.getElementById('rt-feedback');
  var rt = null;            // state of the running test
  var rtResult = null;      // last completed result
  var rtTrigger = null;

  function rtShow(step) {
    ['rt-intro', 'rt-run', 'rt-result'].forEach(function (id) { document.getElementById(id).hidden = id !== step; });
  }

  function openReactionTest(trigger) {
    rtTrigger = trigger || null;
    rtResult = null;
    rtShow('rt-intro');
    rtOverlay.hidden = false;
    requestAnimationFrame(function () { rtOverlay.classList.add('open'); });
    document.getElementById('rt-start').focus({ preventScroll: true });
  }

  function closeReactionTest() {
    if (rtOverlay.hidden) return false;
    stopTest();
    rtOverlay.classList.remove('open');
    rtOverlay.hidden = true;
    if (rtTrigger && rtTrigger.focus) rtTrigger.focus({ preventScroll: true });
    return true;
  }

  function startTest() {
    rt = { trials: [], falseStarts: 0, lit: false, litAt: 0, trialId: 0, timers: [], endAt: performance.now() + RT.durationSec * 1000 };
    rtShow('rt-run');
    rtTarget.classList.remove('lit');
    rtFeedback.textContent = 'Wait…';
    rtTarget.focus({ preventScroll: true });
    tickProgress();
    scheduleNext();
  }

  function stopTest() {
    if (!rt) return;
    rt.timers.forEach(clearTimeout);
    cancelAnimationFrame(rt.raf);
    rt = null;
    rtTarget.classList.remove('lit');
  }

  function tickProgress() {
    if (!rt) return;
    var left = Math.max(0, rt.endAt - performance.now());
    document.getElementById('rt-bar').style.width = (100 - left / (RT.durationSec * 10)) + '%';
    document.getElementById('rt-status').textContent = 'Time left ' + Math.ceil(left / 1000) + ' s · ' + rt.trials.length + ' responses';
    rt.raf = requestAnimationFrame(tickProgress);
  }

  function scheduleNext() {
    var delay = RT.minDelayMs + Math.random() * (RT.maxDelayMs - RT.minDelayMs);
    var now = performance.now();
    if (now + delay >= rt.endAt) {
      rt.timers.push(setTimeout(finishTest, Math.max(0, rt.endAt - now)));
      return;
    }
    rt.timers.push(setTimeout(function () {
      if (!rt) return;
      var id = ++rt.trialId;
      rt.lit = true;
      rt.litAt = performance.now();
      rtTarget.classList.add('lit');
      rtFeedback.textContent = 'Tap!';
      rt.timers.push(setTimeout(function () {
        if (!rt || !rt.lit || rt.trialId !== id) return;
        rt.timers = [];
        rt.lit = false;
        rt.trials.push(RT.timeoutMs);           // no response: recorded as a lapse
        rtTarget.classList.remove('lit');
        rtFeedback.textContent = 'Missed';
        scheduleNext();
      }, RT.timeoutMs));
    }, delay));
  }

  function respond() {
    if (!rt) return;
    var now = performance.now();
    if (!rt.lit) {
      rt.falseStarts++;
      rtFeedback.textContent = 'Too early';
      return;
    }
    var ms = Math.round(now - rt.litAt);
    rt.lit = false;
    rt.timers.forEach(clearTimeout);      // cancel this light's no-response timeout
    rt.timers = [];
    rtTarget.classList.remove('lit');
    if (ms < RT.falseStartMs) {
      rt.falseStarts++;
      rtFeedback.textContent = 'Too early';
    } else {
      rt.trials.push(ms);
      rtFeedback.textContent = ms + ' ms';
    }
    scheduleNext();
  }

  function median(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
  }

  function finishTest() {
    if (!rt) return;
    var trials = rt.trials, falseStarts = rt.falseStarts;
    stopTest();
    var enough = trials.length >= RT.minResponses;
    rtResult = enough ? {
      reactionMedian: median(trials),
      lapses: trials.filter(function (t) { return t > RT.lapseMs; }).length
    } : null;

    var stats = document.getElementById('rt-stats');
    stats.innerHTML = '';
    function stat(label, value, st) {
      stats.appendChild(el('div', { class: 'stat', 'data-status': st || 'unknown' }, [
        el('span', { class: 'stat-label', text: label }),
        el('span', { class: 'stat-val', text: value })
      ]));
    }
    var medStatus = rtResult ? evaluate('reactionMedian', rtResult.reactionMedian) : 'unknown';
    var lapStatus = rtResult ? evaluate('lapses', rtResult.lapses) : 'unknown';
    stat('Median reaction', rtResult ? rtResult.reactionMedian + ' ms' : '—', medStatus);
    stat('Lapses > ' + RT.lapseMs + ' ms', rtResult ? String(rtResult.lapses) : '—', lapStatus);
    stat('Responses', String(trials.length));
    stat('False starts', String(falseStarts));

    var advice = document.getElementById('rt-advice');
    var alert = worst([medStatus, lapStatus]);
    if (!enough) {
      advice.className = 'alertness-note';
      advice.textContent = 'Not enough responses (' + trials.length + ' of ' + RT.minResponses + ' needed) to give a result. Try again when you can focus for a full minute.';
    } else if (alert === 'yellow' || alert === 'red') {
      advice.className = 'alertness-note warn';
      advice.textContent = (CONTENT.regions.brain && CONTENT.regions.brain.alertness) || '';
    } else {
      advice.className = 'alertness-note';
      advice.textContent = 'Within the reference range. Compare with your own trend over the coming days.';
    }
    document.getElementById('rt-use').disabled = !enough;
    rtShow('rt-result');
    document.getElementById(enough ? 'rt-use' : 'rt-again').focus({ preventScroll: true });
  }

  rtTarget.addEventListener('pointerdown', function (ev) { ev.preventDefault(); respond(); });
  rtTarget.addEventListener('click', function (ev) { ev.preventDefault(); });
  document.addEventListener('keydown', function (ev) {
    if (!rt || (ev.key !== ' ' && ev.key !== 'Enter')) return;
    ev.preventDefault();
    if (!ev.repeat) respond();
  });
  document.getElementById('rt-start').addEventListener('click', startTest);
  document.getElementById('rt-again').addEventListener('click', startTest);
  document.getElementById('rt-close').addEventListener('click', closeReactionTest);
  document.getElementById('rt-open').addEventListener('click', function (ev) { openReactionTest(ev.currentTarget); });
  rtOverlay.addEventListener('click', function (ev) { if (ev.target === rtOverlay) closeReactionTest(); });
  document.getElementById('rt-use').addEventListener('click', function () {
    if (!rtResult) return;
    form.elements.reactionMedian.value = rtResult.reactionMedian;
    form.elements.lapses.value = rtResult.lapses;
    updateReactionSummary();
    rtTrigger = openKey ? document.getElementById('drawer-close') : document.getElementById('rt-open');
    closeReactionTest();
    toast('Reaction results added to the check-in form. Record the check-in to save them.');
  });

  document.getElementById('clear-user').addEventListener('click', function () {
    if (!userEntries.length) { toast('No entries of yours to clear.'); return; }
    if (!window.confirm('Remove all ' + userEntries.length + ' of your check-ins from this browser?')) return;
    userEntries = [];
    saveUserEntries();
    render();
    toast('Your entries were cleared. Showing synthetic demo data.');
  });

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  document.getElementById('whatif-reset').addEventListener('click', function () {
    activeScenarios = {};
    renderScenarios();
    render();
  });

  renderBodyFigure();
  setupForm();
  renderScenarios();
  render();

  // Exposed for debugging / later stages.
  window.AURA = { getHistory: getHistory, indicatorScore: indicatorScore, streak: streak, evaluate: evaluate, regionStatus: regionStatus, overallStatus: overallStatus };
})();
