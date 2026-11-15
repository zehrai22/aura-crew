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
    var tests = {};
    var out = raw.map(function (r) {
      var e = {};
      Object.keys(r).forEach(function (k) { e[k] = r[k]; });
      e._asof = {};
      return e;
    });
    out.forEach(function (e, i) {
      Object.keys(IND).forEach(function (k) {
        var spec = IND[k];
        if (spec.derived && spec.derived.type === 'baseline') {
          var vals = spec.derived.from.map(function (f) { return raw[i][f]; });
          var has = vals.every(function (v) { return typeof v === 'number' && !isNaN(v); });
          tests[k] = tests[k] || [];
          if (has) tests[k].push(vals);
          e._tests = e._tests || {};
          e._tests[k] = tests[k].length;
          if (has && tests[k].length >= CFG.cognitive.baselineTests) {
            e[k] = perfVsBaseline(tests[k], spec.derived);
            lastSeen[k] = { value: e[k], date: e.date };
          } else if (!has && lastSeen[k] && dayDiff(lastSeen[k].date, e.date) <= CFG.cognitive.carryForwardDays) {
            e[k] = lastSeen[k].value;            // no test today: reuse the latest comparison
            e._asof[k] = lastSeen[k].date;
          } else {
            e[k] = null;
          }
        } else if (spec.derived && spec.derived.type === 'pctChange') {
          e[k] = pctChange(raw, out, i, spec.derived);
          if (e[k] == null && lastSeen[k] && dayDiff(lastSeen[k].date, e.date) < spec.derived.days) {
            e[k] = lastSeen[k].value;            // not measured today: reuse the latest change
            e._asof[k] = lastSeen[k].date;
          } else if (e[k] != null) {
            lastSeen[k] = { value: e[k], date: e.date };
          }
        } else if (spec.derived) {
          // Only report a value once the history covers the whole window,
          // otherwise early partial sums would look like missed exercise.
          if (dayDiff(out[0].date, e.date) < spec.derived.days - 1) { e[k] = null; return; }
          var sum = 0, count = 0;
          for (var j = i; j >= 0 && dayDiff(out[j].date, e.date) < spec.derived.days; j--) {
            var v = raw[j][spec.derived.from];
            if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
          }
          e[k] = !count ? null : spec.derived.agg === 'avg' ? Math.round(sum / count) : sum;
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

  /**
   * % change of `from` on entry i versus the most recent measurement at least
   * `days` (and at most 2 × `days`) earlier. Null when entry i has no measurement.
   */
  function pctChange(raw, out, i, d) {
    var now = raw[i][d.from];
    if (typeof now !== 'number' || isNaN(now)) return null;
    for (var j = i - 1; j >= 0; j--) {
      var gap = dayDiff(out[j].date, out[i].date);
      if (gap > d.days * 2) break;
      var ref = raw[j][d.from];
      if (gap >= d.days && typeof ref === 'number' && ref > 0) return Math.round((now - ref) / ref * 1000) / 10;
    }
    return null;
  }

  /**
   * Performance of the last `recentTests` tests versus the astronaut's own
   * baseline (average of the first `baselineTests` tests), in %.
   * Negative = below baseline. For several metrics the largest drop is used.
   * `tests` is a list of [metric1, metric2, ...] in chronological order.
   */
  function perfVsBaseline(tests, d) {
    var C = CFG.cognitive;
    if (tests.length < C.baselineTests) return null;
    function avg(list, m) { return list.reduce(function (a, t) { return a + t[m]; }, 0) / list.length; }
    var base = tests.slice(0, C.baselineTests), recent = tests.slice(-C.recentTests);
    var changes = d.from.map(function (f, m) {
      var b = avg(base, m), r = avg(recent, m);
      if (!b) return 0;
      var pct = (r - b) / b * 100;
      return d.better === 'lower' ? -pct : pct;
    });
    return Math.round(Math.min.apply(null, changes));
  }

  /** First recorded body mass and the latest change versus it (for context only). */
  function massBaseline(history, entry) {
    var first = null, latest = null;
    history.forEach(function (e) {
      if (typeof e.bodyMass !== 'number') return;
      if (!first) first = e;
      if (!entry || e.date <= entry.date) latest = e;
    });
    if (!first || !latest) return null;
    return { first: first, latest: latest, pct: Math.round((latest.bodyMass - first.bodyMass) / first.bodyMass * 1000) / 10 };
  }

  /* ------------------------------------------------------------------ *
   * Profile (one-time height, used only for BMI)
   * ------------------------------------------------------------------ */
  function loadProfile() {
    try {
      var p = JSON.parse(localStorage.getItem(CFG.profileKey) || 'null');
      if (p && typeof p.height === 'number') return { height: p.height, source: 'user' };
    } catch (e) { /* ignore */ }
    var syn = window.AURA_SYNTHETIC_PROFILE;
    return syn ? { height: syn.height, source: 'synthetic' } : { height: null, source: null };
  }
  function saveProfile(height) {
    try { localStorage.setItem(CFG.profileKey, JSON.stringify({ height: height })); } catch (e) { /* ignore */ }
  }
  var profile = loadProfile();

  function bmiFor(massKg) {
    if (!profile.height || typeof massKg !== 'number') return null;
    var m = profile.height / 100;
    return Math.round(massKg / (m * m) * 10) / 10;
  }

  /* ------------------------------------------------------------------ *
   * Trend watch: 14-day linear trend per indicator (early-warning only)
   * ------------------------------------------------------------------ */
  var TW = CFG.trendWatch;

  /** Least-squares line through the recorded values of the last TW.days days. */
  function trendFor(history, k) {
    var rule = TW.indicators[k];
    if (!rule || !history.length) return null;
    var lastDate = history[history.length - 1].date;
    var pts = [];
    history.forEach(function (e) {
      var age = dayDiff(e.date, lastDate);
      if (age < TW.days && measuredOn(e, k)) pts.push({ x: TW.days - 1 - age, y: e[k] });
    });
    if (pts.length < TW.minPoints) return null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    pts.forEach(function (p) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y; });
    var vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cxy = sxy - sx * sy / n;
    if (vx <= 0) return null;
    var slope = cxy / vx;
    var r2 = vy > 0 ? (cxy * cxy) / (vx * vy) : 0;
    var change = slope * (TW.days - 1);
    var moving = Math.abs(change) >= rule.step * TW.flatFraction && r2 >= TW.arrowMinR2;
    var dir = !moving ? 'flat' : change > 0 ? 'up' : 'down';
    return {
      k: k, slope: slope, r2: r2, change: change, n: n, dir: dir,
      unfavorable: dir === rule.worse && Math.abs(change) >= rule.step && r2 >= TW.minR2,
      strength: Math.abs(change) / rule.step * r2
    };
  }

  /**
   * Trends for all indicators, from recorded history. `watch` is set when the
   * trend is unfavorable while the shown (latest) value is still within range.
   */
  function computeTrends(history, shown) {
    var out = {};
    Object.keys(TW.indicators).forEach(function (k) {
      var t = trendFor(history, k);
      if (!t) return;
      t.watch = t.unfavorable && shown && evaluate(k, shown[k]) === 'green';
      out[k] = t;
    });
    return out;
  }

  function regionTrendWatch(regionKey, trends) {
    return REGIONS[regionKey].indicators.filter(function (k) { return trends[k] && trends[k].watch; });
  }

  var ARROWS = { up: '↗', down: '↘', flat: '→' };
  function trendSentence(t) {
    return (TW.indicators[t.k].name || IND[t.k].label) + ' has been ' + (t.dir === 'up' ? 'rising' : 'falling') + ' for ' + TW.days + ' days.';
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
    if (!spec || !spec.green || value === null || value === undefined || isNaN(value)) return 'unknown';
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
    if (spec.refText) return spec.refText;
    if (!g) return spec.targetLine ? 'target ' + spec.targetLine + ' ' + spec.unit : 'no reference range';
    if (g[0] === g[1]) return fmt(key, g[0]) + (spec.levels && spec.levels[g[0]] ? ' (' + spec.levels[g[0]] + ')' : '');
    if (g[1] >= lim.max) return '≥ ' + fmt(key, g[0]);
    if (g[0] <= lim.min) return '≤ ' + fmt(key, g[1]);
    return fmtRange(key, g);
  }
  function withUnit(key, v) {
    var u = IND[key].unit;
    return fmt(key, v) + (u === '%' || u.charAt(0) === '/' ? u : ' ' + u);
  }
  /** Small context note for a reading: today's minutes, when a marker was measured, or "not measured". */
  function readingNote(entry, k) {
    var spec = IND[k];
    if (!entry) return '';
    if (spec.derived && spec.derived.type === 'baseline') {
      var n = entry._tests ? entry._tests[k] || 0 : 0;
      if (entry[k] == null) return n < CFG.cognitive.baselineTests ? 'Baseline: ' + n + ' of ' + CFG.cognitive.baselineTests + ' tests' : 'No recent test';
      var raw = spec.derived.from.map(function (f) { return entry[f]; });
      var latestText = k === 'perfReaction' ? (raw[0] != null ? 'Latest ' + raw[0] + ' ms' : '')
        : (raw[1] != null ? 'Latest ' + raw[1] + ' digits · ' + raw[0] + '%' : '');
      if (entry._asof && entry._asof[k]) return 'Tested ' + shortDate(entry._asof[k]);
      return latestText || 'Last 3 vs first 3 tests';
    }
    if (spec.derived && spec.derived.type === 'pctChange') {
      var mb = massBaseline(getHistory(), entry);
      if (entry[k] == null) return mb ? 'Needs 2 readings 7+ days apart' : 'Not measured yet';
      return mb ? withUnit('bodyMass', mb.latest.bodyMass) + ' · ' + fmt(k, mb.pct) + '% vs first' : '';
    }
    if (spec.derived) {
      var today = entry[spec.derived.from];
      if (entry[k] == null) return 'Needs ' + spec.derived.days + ' days of logs';
      if (spec.target) return 'Target ' + spec.target + ' ' + spec.unit + ' · today ' + (today == null ? '—' : today);
      return 'Today ' + (today == null ? '—' : today) + ' ' + IND[spec.derived.from].unit;
    }
    if (entry._asof && entry._asof[k]) return 'Measured ' + shortDate(entry._asof[k]);
    if (spec.levels && entry[k] != null && spec.levels[entry[k]]) return spec.levels[entry[k]];
    if (spec.optional && (entry[k] == null || isNaN(entry[k]))) return 'Not measured';
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
  // Visual geometry for each clickable region. `side` places the callout label.
  // Regions are drawn in this order, so later ones sit on top (heart over lungs).
  var REGION_GEOMETRY = {
    respiratory: {
      short: 'Respiratory', hotspot: [131, 168], side: 'left', labelY: 150,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone',
          d: 'M146 136 C134 134 122 146 120 166 C118 186 122 202 132 206 C140 208 146 200 146 188 Z M154 136 C166 134 178 146 180 166 C182 186 178 202 168 206 C160 208 154 200 154 188 Z' }));
        g.appendChild(svg('path', { class: 'zone-line', style: 'stroke-width:1.4',
          d: 'M150 108 L150 132 M150 132 L142 142 M150 132 L158 142' }));
      }
    },
    nervous: {
      short: 'Nervous', hotspot: [150, 46], side: 'right', labelY: 40,
      zone: function (g) {
        g.appendChild(svg('ellipse', { class: 'zone', cx: 150, cy: 50, rx: 20, ry: 22 }));
        g.appendChild(svg('path', { class: 'zone-line', style: 'stroke-width:1;opacity:.5',
          d: 'M150 30 L150 70 M136 44 Q143 48 136 54 M164 44 Q157 48 164 54 M138 62 Q144 60 146 66 M162 62 Q156 60 154 66' }));
        // spinal cord + nerves to the limbs
        g.appendChild(svg('path', { class: 'zone-line', style: 'stroke-width:1;opacity:.45',
          d: 'M150 92 L150 300 M150 300 L136 420 M150 300 L164 420 M150 126 L104 150 M150 126 L196 150' }));
      }
    },
    heart: {
      short: 'Cardio', hotspot: [160, 172], side: 'right', labelY: 130,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone',
          d: 'M160 188 C149 180 143 172 145 165 C147 158 156 158 160 165 C164 158 173 158 175 165 C177 172 171 180 160 188 Z' }));
      }
    },
    immune: {
      short: 'Immune', hotspot: [181, 226], side: 'right', labelY: 220,
      zone: function (g) {
        g.appendChild(svg('ellipse', { class: 'zone', cx: 181, cy: 226, rx: 6, ry: 10 }));
        [[140, 104], [160, 104], [116, 172], [184, 172], [128, 322], [172, 322]].forEach(function (p) {
          g.appendChild(svg('circle', { class: 'zone', cx: p[0], cy: p[1], r: 2.6 }));
        });
      }
    },
    metabolism: {
      short: 'Metabolism', hotspot: [134, 227], side: 'left', labelY: 240,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone',
          d: 'M119 218 C126 209 148 209 154 217 C152 229 139 241 125 240 C118 236 115 226 119 218 Z' }));
        g.appendChild(svg('path', { class: 'zone', d: 'M152 238 C158 234 168 234 172 238 C168 242 158 242 152 238 Z' }));
      }
    },
    renal: {
      short: 'Urinary', hotspot: [150, 301], side: 'right', labelY: 318,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone',
          d: 'M134 256 C128 256 126 264 127 270 C128 278 134 282 139 278 C142 275 140 270 139 266 C138 261 140 256 134 256 Z M166 256 C172 256 174 264 173 270 C172 278 166 282 161 278 C158 275 160 270 161 266 C162 261 160 256 166 256 Z' }));
        g.appendChild(svg('path', { class: 'zone-line', style: 'stroke-width:1.2', d: 'M138 276 Q142 290 146 296 M162 276 Q158 290 154 296' }));
        g.appendChild(svg('ellipse', { class: 'zone', cx: 150, cy: 301, rx: 9, ry: 6 }));
      }
    },
    musculoskeletal: {
      short: 'Bone · Muscle', hotspot: [130, 380], side: 'left', labelY: 400,
      zone: function (g) {
        g.appendChild(svg('path', { class: 'zone-line',
          d: 'M128 326 L132 430 M172 326 L168 430 M130 452 L129 546 M170 452 L171 546 M96 142 L91 205 M204 142 L209 205 M88 220 L80 282 M212 220 L220 282' }));
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

      // "Trend watch" badge on the label's top edge (shown when a trend is flagged)
      var tb = svg('g', { class: 'trend-badge', visibility: 'hidden' }, [
        svg('rect', { x: boxX + boxW - 50, y: ly - 25, width: 46, height: 13, rx: 6.5 }),
        svg('text', { x: boxX + boxW - 27, y: ly - 15.6, 'text-anchor': 'middle', text: '◇ TREND' })
      ]);
      g.appendChild(tb);

      g.appendChild(svg('title', { text: REGIONS[key].name }));
      g.addEventListener('click', function () { openRegion(key, g); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openRegion(key, g); }
      });
      root.appendChild(g);
      regionNodes[key] = { group: g, statusText: st, trend: tb };
    });
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  var OVERALL_COPY = {
    green: 'All indicators are within range.',
    yellow: 'Some indicators need monitoring.',
    red: 'An indicator needs attention. Consider contacting your flight surgeon.',
    unknown: 'Record a check-in to see your status.'
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
      var btn = el('button', { type: 'button', class: 'whatif-toggle', 'aria-pressed': String(on) }, [
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

  var currentTrends = {};

  function render() {
    var history = getHistory();
    var latest = currentEntry(history);
    var previous = history[history.length - 2] || null;
    var overall = overallStatus(latest);
    currentTrends = computeTrends(history, latest);
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
      var tw = regionTrendWatch(key, currentTrends);
      regionNodes[key].trend.setAttribute('visibility', tw.length ? 'visible' : 'hidden');
      if (tw.length) regionNodes[key].group.setAttribute('aria-label', REGIONS[key].name + ': ' + CFG.statusText[s] + ', trend watch');
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
      ? 'Latest · ' + fmtDate(latest.date) + (latest.source === 'user' ? ' · your entry' : '')
      : '—';

    // Score + streak
    var score = indicatorScore(latest);
    var recentScores = history.slice(-7).map(indicatorScore).filter(function (v) { return v != null; });
    var avg = recentScores.length ? Math.round(recentScores.reduce(function (a, b) { return a + b; }, 0) / recentScores.length) : null;
    document.getElementById('score-value').textContent = score == null ? '—' : score;
    document.getElementById('gauge-arc').style.strokeDasharray = (score || 0) + ' 100';
    document.getElementById('score-gauge').setAttribute('aria-label', 'Indicator score ' + (score == null ? 'not available' : score + ' out of 100'));
    document.getElementById('stat-score').textContent = score == null ? '—' : score + ' / 100';
    document.getElementById('stat-score-sub').textContent = avg == null ? '' : '7-day avg ' + avg;
    var stk = streak(history);
    document.getElementById('stat-streak').textContent = stk.days + (stk.days === 1 ? ' day' : ' days');
    document.getElementById('stat-streak-sub').textContent = stk.days === 0 ? 'Check in today to start' : 'Consecutive days';
    var userCount = history.filter(function (e) { return e.source === 'user'; }).length;
    document.getElementById('log-count').textContent = history.length + ' days logged · ' + userCount + ' yours';

    renderTrendsTab(history, latest, previous);
    document.getElementById('sim-badge').hidden = !sim;

    renderVitals(history, latest);
    renderPlan(latest);
    renderHazards();
    applyHazardFocus();
    if (openKey) renderDrawer(openKey);
  }

  /** " · 14 d ↗" (plus "Trend watch") after an indicator's reference. */
  function trendTag(k) {
    var t = currentTrends[k];
    if (!t) return null;
    var words = { up: 'rising', down: 'falling', flat: 'steady' }[t.dir];
    return el('span', { class: 'r-trend' + (t.watch ? ' watch' : ''),
      title: TW.days + '-day trend: ' + words },
      [document.createTextNode(' · ' + TW.days + ' d ' + ARROWS[t.dir] + (t.watch ? ' Trend watch' : ''))]);
  }

  /* ------------------------------------------------------------------ *
   * Trends tab: system selector, one chart at a time, latest indicators,
   * score & streak (rendered in render()), trend-watch list
   * ------------------------------------------------------------------ */
  var trendSystem = null;
  var trendChartKey = null;
  var VITAL_KEYS = {};
  CFG.vitals.forEach(function (t) { t.keys.forEach(function (k) { VITAL_KEYS[k] = true; }); });

  function renderTrendsTab(history, latest, previous) {
    var regionKeys = Object.keys(REGIONS);
    if (!trendSystem) {
      // Start on the most severe system.
      trendSystem = regionKeys.slice().sort(function (a, b) { return RANK[regionStatus(b, latest)] - RANK[regionStatus(a, latest)]; })[0];
    }
    var region = REGIONS[trendSystem];

    // System selector (status dot + text label + trend-watch badge)
    var list = document.getElementById('system-list');
    list.innerHTML = '';
    regionKeys.forEach(function (key) {
      var st = regionStatus(key, latest);
      var tw = regionTrendWatch(key, currentTrends);
      var btn = el('button', { type: 'button', class: 'sys-chip', 'data-status': st, 'aria-pressed': String(key === trendSystem),
        'aria-label': REGIONS[key].name + ', ' + CFG.statusText[st] + (tw.length ? ', trend watch' : '') }, [
        el('span', { class: 'dot' }),
        el('span', { class: 'name', text: REGIONS[key].name }),
        el('span', { class: 'st', text: CFG.statusText[st] }),
        tw.length ? el('span', { class: 'tw-badge', text: '◇ Trend' }) : null
      ]);
      btn.addEventListener('click', function () { trendSystem = key; trendChartKey = null; renderTrendsTab(getHistory(), currentEntry(getHistory()), null); });
      list.appendChild(btn);
    });
    var active = list.querySelector('[aria-pressed="true"]');
    if (active) list.scrollLeft = Math.max(0, active.offsetLeft - list.offsetLeft - 8);

    // Chart: indicator chips + one chart + data table + link to the full panel
    var view = document.getElementById('trend-view');
    view.innerHTML = '';
    var recent = history.slice(-30);
    var chartKeys = region.indicators.concat(region.extraCharts || []);
    if (!trendChartKey || chartKeys.indexOf(trendChartKey) < 0) trendChartKey = focusIndicator(trendSystem, latest, history);
    var chips = el('div', { class: 'chart-chips', role: 'group', 'aria-label': 'Choose indicator' });
    var box = el('div', { class: 'trend-chart' });
    function draw() {
      box.innerHTML = '';
      box.appendChild(trendChart(trendChartKey, recent));
      [].forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', String(c.dataset.k === trendChartKey)); });
    }
    chartKeys.forEach(function (k) {
      var c = el('button', { type: 'button', class: 'chart-chip', 'data-k': k, 'data-status': latest ? evaluate(k, latest[k]) : 'unknown', text: IND[k].short });
      c.addEventListener('click', function () { trendChartKey = k; draw(); });
      chips.appendChild(c);
    });
    var open = el('button', { type: 'button', class: 'link-btn open-panel', text: 'Open ' + region.name + ' panel →' });
    open.addEventListener('click', function () { openRegion(trendSystem, open); });
    view.appendChild(chips);
    view.appendChild(box);
    view.appendChild(el('div', { class: 'trend-foot' }, [dataTable(chartKeys, recent), open]));
    draw();

    // Latest indicators for this system (vital signs are on the Overview strip, not repeated)
    var readings = document.getElementById('readings');
    readings.innerHTML = '';
    var keys = region.indicators.filter(function (k) { return !VITAL_KEYS[k]; });
    var skipped = region.indicators.filter(function (k) { return VITAL_KEYS[k]; });
    if (skipped.length) readings.appendChild(el('li', { class: 'r-note', text: joinAnd(skipped.map(function (k) { return IND[k].short; })) + ': see the Vital signs strip on Overview.' }));
    keys.forEach(function (key) {
      var spec = IND[key];
      var v = latest ? latest[key] : null;
      var st = evaluate(key, v);
      var deltaText = readingNote(latest, key);
      if (!deltaText && previous && v != null && previous[key] != null) {
        var diff = v - previous[key];
        deltaText = (diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : '■ ') + diff.toFixed(spec.decimals) + ' vs prev';
      }
      var valNode = el('span', { class: 'r-val', text: fmt(key, v) });
      valNode.appendChild(el('small', { text: spec.unit }));
      readings.appendChild(el('li', { 'data-status': st, title: CFG.statusText[st], class: currentTrends[key] && currentTrends[key].watch ? 'trend-watch' : '' }, [
        el('span', { class: 'r-name', text: spec.label }), valNode,
        el('span', { class: 'r-ref' }, [document.createTextNode('Ref ' + fmtRef(key)), trendTag(key)]),
        el('span', { class: 'r-delta', text: deltaText })
      ]));
    });

    // Trend watch list (all systems)
    var tw = document.getElementById('tw-list');
    tw.innerHTML = '';
    var watches = Object.keys(currentTrends).map(function (k) { return currentTrends[k]; })
      .filter(function (t) { return t.watch; }).sort(function (a, b) { return b.strength - a.strength; });
    if (!watches.length) tw.appendChild(el('li', { class: 'meta', text: 'No trend-watch signals right now.' }));
    watches.forEach(function (t) {
      var rk = regionKeys.filter(function (r) { return REGIONS[r].indicators.indexOf(t.k) >= 0; })[0];
      var b = el('button', { type: 'button', class: 'tw-item' }, [
        el('span', { class: 'tw-badge', text: '◇ ' + REGIONS[rk].name }),
        el('span', { text: trendSentence(t) })
      ]);
      b.addEventListener('click', function () { trendSystem = rk; trendChartKey = t.k; renderTrendsTab(getHistory(), currentEntry(getHistory()), null); });
      tw.appendChild(el('li', null, [b]));
    });
  }

  /* ------------------------------------------------------------------ *
   * Tabs (top on desktop, bottom bar on phone). Last tab kept in localStorage.
   * ------------------------------------------------------------------ */
  var TAB_KEY = 'aura-crew.tab.v1';
  var TAB_IDS = ['overview', 'checkin', 'trends', 'about'];

  function activateTab(id, opts) {
    opts = opts || {};
    if (TAB_IDS.indexOf(id) < 0) id = 'overview';
    TAB_IDS.forEach(function (t) {
      var btn = document.getElementById('tabbtn-' + t), panel = document.getElementById('tab-' + t);
      var on = t === id;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    });
    document.body.setAttribute('data-tab', id);
    try { localStorage.setItem(TAB_KEY, id); } catch (e) { /* storage unavailable */ }
    if (opts.focus) document.getElementById('tabbtn-' + id).focus();
    if (opts.scroll !== false) window.scrollTo(0, 0);
  }

  function setupTabs() {
    TAB_IDS.forEach(function (t, i) {
      var btn = document.getElementById('tabbtn-' + t);
      btn.addEventListener('click', function () { activateTab(t); });
      btn.addEventListener('keydown', function (ev) {
        var next = null;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = TAB_IDS[(i + 1) % TAB_IDS.length];
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = TAB_IDS[(i + TAB_IDS.length - 1) % TAB_IDS.length];
        else if (ev.key === 'Home') next = TAB_IDS[0];
        else if (ev.key === 'End') next = TAB_IDS[TAB_IDS.length - 1];
        if (next) { ev.preventDefault(); activateTab(next, { focus: true }); }
      });
    });
    var saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (e) { saved = null; }
    activateTab(saved || 'overview', { scroll: false });
    document.getElementById('sim-badge').addEventListener('click', function () { activateTab('about'); });
    document.getElementById('rt-open-2').addEventListener('click', function (ev) { openReactionTest(ev.currentTarget); });
  }

  /* ------------------------------------------------------------------ *
   * Vital signs strip
   * ------------------------------------------------------------------ */
  var VITAL_WORDS = { green: 'stable', yellow: 'monitor', red: 'attention', unknown: 'no data' };

  /** Small 7-day sparkline of recorded values (two lines for blood pressure). */
  function sparkline(keys, history) {
    var W = 100, H = 30, P = 3;
    if (!history.length) return null;
    var lastDate = history[history.length - 1].date, days = CFG.vitalsSparkDays;
    var series = keys.map(function (k) {
      return history.filter(function (e) { return dayDiff(e.date, lastDate) < days && measuredOn(e, k); })
        .map(function (e) { return { x: days - 1 - dayDiff(e.date, lastDate), y: e[k] }; });
    });
    var all = [].concat.apply([], series.map(function (sr) { return sr.map(function (p) { return p.y; }); }));
    if (all.length < 2) return null;
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (keys.length === 1) { var g = IND[keys[0]].green; lo = Math.min(lo, g[0]); hi = Math.max(hi, g[1]); }
    if (hi === lo) { hi += 1; lo -= 1; }
    var x = function (v) { return P + v * (W - 2 * P) / (days - 1); };
    var y = function (v) { return H - P - (v - lo) * (H - 2 * P) / (hi - lo); };
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'spark', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (keys.length === 1) {
      var gr = IND[keys[0]].green;
      root.appendChild(svg('rect', { class: 'spark-band', x: 0, width: W, y: y(gr[1]), height: Math.max(0, y(gr[0]) - y(gr[1])) }));
    }
    series.forEach(function (sr, i) {
      if (!sr.length) return;
      root.appendChild(svg('path', { class: 'spark-line' + (i ? ' secondary' : ''), 'vector-effect': 'non-scaling-stroke',
        d: sr.map(function (p, n) { return (n ? 'L' : 'M') + x(p.x).toFixed(1) + ' ' + y(p.y).toFixed(1); }).join(' ') }));
      var lastP = sr[sr.length - 1];
      root.appendChild(svg('circle', { class: 'spark-dot', 'data-status': evaluate(keys[i], lastP.y), cx: x(lastP.x), cy: y(lastP.y), r: 2.2, 'vector-effect': 'non-scaling-stroke' }));
    });
    return root;
  }

  function renderVitals(history, latest) {
    var row = document.getElementById('vitals-row');
    row.innerHTML = '';
    var sim = !!(latest && latest.simulated);
    var statuses = [], reds = [];
    CFG.vitals.forEach(function (t) {
      var vals = t.keys.map(function (k) { return latest ? latest[k] : null; });
      var st = worst(t.keys.map(function (k, i) { return evaluate(k, vals[i]); }));
      statuses.push(st);
      t.keys.forEach(function (k, i) { if (evaluate(k, vals[i]) === 'red') reds.push(indicatorPhrase(k, vals[i])); });
      var unit = IND[t.keys[0]].unit;
      var valueText = vals.every(function (v) { return v == null; }) ? '—' : t.keys.map(function (k, i) { return fmt(k, vals[i]); }).join('/');
      var spark = sparkline(t.keys, history);
      var tile = el('button', { type: 'button', class: 'vital', 'data-status': st,
        'aria-label': t.label + ': ' + valueText + ' ' + unit + ', ' + CFG.statusText[st] + '. Opens the ' + REGIONS[t.region].name + ' panel.' }, [
        el('span', { class: 'vital-label', text: t.label }),
        el('span', { class: 'vital-value' }, [document.createTextNode(valueText), el('small', { text: unit })]),
        el('span', { class: 'vital-status' }, [el('span', { class: 'dot' }), document.createTextNode(CFG.statusText[st])]),
        spark || el('span', { class: 'spark-empty', text: 'Not enough data for 7 days' }),
        el('span', { class: 'vital-sub', text: 'Ref ' + t.keys.map(fmtRef).join(' / ') })
      ]);
      tile.addEventListener('click', function () { openRegion(t.region, tile); });
      row.appendChild(tile);
    });
    var overall = worst(statuses);
    var chip = document.getElementById('vitals-chip');
    chip.setAttribute('data-status', overall);
    chip.textContent = 'Vital signs: ' + VITAL_WORDS[overall];
    document.getElementById('vitals-date').textContent = latest ? fmtDate(latest.date) + ' · ' + CFG.vitalsSparkDays + '-day trend' : '';
    var alertBox = document.getElementById('vitals-alert');
    alertBox.hidden = overall !== 'red';
    alertBox.innerHTML = '';
    if (overall === 'red') {
      alertBox.appendChild(el('strong', { text: 'Contact your flight surgeon. ' }));
      alertBox.appendChild(document.createTextNode(joinAnd(reds) + (reds.length === 1 ? ' is' : ' are') + ' outside the monitor range.'));
    }
  }

  /* ------------------------------------------------------------------ *
   * Today's action plan (main decision-support card)
   * ------------------------------------------------------------------ */
  var PLAN_SIZE = 3;
  var PLAN_GROUPS = (window.AURA_CONTENT && window.AURA_CONTENT.plan && window.AURA_CONTENT.plan.groups) || {};

  /** "Sleep 4.5 h", "SpO₂ 91%", "Dizziness 3 (Severe)", "2 lapses" */
  function indicatorPhrase(k, v, lower) {
    var spec = IND[k], name = spec.short;
    if (spec.unit.toLowerCase() === name.toLowerCase()) return withUnit(k, v);
    if (lower && /^[A-Z][a-z]+(\s|$)/.test(name)) name = name.charAt(0).toLowerCase() + name.slice(1);
    return name + ' ' + withUnit(k, v) + (spec.levels && spec.levels[v] ? ' (' + spec.levels[v] + ')' : '');
  }

  function joinAnd(items) {
    if (items.length < 2) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function nextCheckInText(latest) {
    var today = todayIso();
    if (!latest || dayDiff(latest.date, today) > 0) return 'Next suggested check-in: today, at your usual time.';
    var p = today.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + 1);
    return 'Next suggested check-in: tomorrow morning (' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ').';
  }

  /**
   * Builds the ranked plan from the entry shown on the dashboard.
   * Each action group (e.g. "rest" = sleep + mood) appears once, under the most
   * severe body system that uses one of its flagged indicators.
   */
  function buildPlan(entry) {
    var order = Object.keys(REGIONS);
    var systems = order.map(function (rk) { return { key: rk, st: regionStatus(rk, entry) }; })
      .filter(function (x) { return x.st === 'red' || x.st === 'yellow'; })
      .sort(function (a, b) { return (RANK[b.st] - RANK[a.st]) || (order.indexOf(a.key) - order.indexOf(b.key)); });

    var items = [];
    Object.keys(PLAN_GROUPS).forEach(function (gk) {
      var g = PLAN_GROUPS[gk];
      var flags = g.indicators
        .map(function (k) { return { k: k, st: evaluate(k, entry[k]) }; })
        .filter(function (f) { return f.st === 'yellow' || f.st === 'red'; })
        .sort(function (a, b) { return RANK[b.st] - RANK[a.st]; });
      if (!flags.length) return;
      var sys = null;
      systems.some(function (x) {
        if (flags.some(function (f) { return REGIONS[x.key].indicators.indexOf(f.k) >= 0; })) { sys = x; return true; }
        return false;
      });
      if (!sys) return;
      var st = flags[0].st;
      items.push({
        group: gk, st: st, sys: sys, flags: flags,
        text: g.actions[st] || g.actions.yellow,
        reason: joinAnd(flags.map(function (f, i) { return indicatorPhrase(f.k, entry[f.k], i > 0); })) + ' ' + g.reason + '.'
      });
    });
    items.sort(function (a, b) {
      return (RANK[b.st] - RANK[a.st]) || (systems.indexOf(a.sys) - systems.indexOf(b.sys)) ||
        (b.flags.length - a.flags.length);
    });

    // Red indicators, each once, with the systems they belong to.
    var reds = [];
    INDICATOR_KEYS.forEach(function (k) {
      if (evaluate(k, entry[k]) !== 'red') return;
      reds.push(indicatorPhrase(k, entry[k], reds.length > 0));
    });
    return { items: items.slice(0, PLAN_SIZE), total: items.length, reds: reds, systems: systems };
  }

  function renderPlan(latest) {
    var body = document.getElementById('plan-body');
    var sim = !!(latest && latest.simulated);
    document.getElementById('plan-meta').textContent = latest ? 'From ' + fmtDate(latest.date) + ' check-in' : '';
    body.innerHTML = '';

    if (!latest) {
      body.appendChild(el('p', { class: 'meta', text: 'Record a daily check-in to get today\'s action plan.' }));
      return;
    }
    var plan = buildPlan(latest);


    if (plan.reds.length) {
      var shown = plan.reds.slice(0, 3);
      var more = plan.reds.length - shown.length;
      body.appendChild(el('div', { class: 'plan-banner', role: 'alert' }, [
        el('span', { class: 'dot' }),
        el('div', null, [
          el('strong', { text: 'Contact your flight surgeon' }),
          el('span', { text: 'Outside the monitor range: ' + joinAnd(shown) + (more > 0 ? ' and ' + more + ' more' : '') + '.' })
        ])
      ]));
    }

    if (!plan.items.length) {
      body.appendChild(el('div', { class: 'plan-ok' }, [
        el('span', { class: 'dot' }),
        el('div', null, [
          el('strong', { text: 'No action needed today. Keep your routine.' }),
          el('span', { text: nextCheckInText(latest) })
        ])
      ]));
      renderPlanTrend(body, latest);
      return;
    }

    var ol = el('ol', { class: 'plan-list' });
    plan.items.forEach(function (it) {
      var sysName = REGIONS[it.sys.key].name;
      var btn = el('button', { type: 'button', class: 'plan-item', 'data-status': it.st,
        'aria-label': it.text + ' ' + sysName + ', ' + CFG.statusText[it.st] + '. ' + it.reason + ' Opens the ' + sysName + ' panel.' }, [
        el('span', { class: 'plan-action', text: it.text }),
        el('span', { class: 'plan-why' }, [
          el('span', { class: 'dot', title: CFG.statusText[it.st] }),
          el('span', { class: 'plan-sys', text: sysName }),
          el('span', { text: it.reason })
        ])
      ]);
      btn.addEventListener('click', function () { openRegion(it.sys.key, btn); });
      ol.appendChild(el('li', null, [btn]));
    });
    body.appendChild(ol);
    if (plan.total > plan.items.length) {
      body.appendChild(el('p', { class: 'meta plan-more', text: (plan.total - plan.items.length) + ' more ' +
        (plan.total - plan.items.length === 1 ? 'item' : 'items') + ' in the body-system panels.' }));
    }
    renderPlanTrend(body, latest);
  }

  /** One extra "trend watch" line: the strongest unfavorable trend that is still within range. */
  function renderPlanTrend(body, latest) {
    var watches = Object.keys(currentTrends).map(function (k) { return currentTrends[k]; })
      .filter(function (t) { return t.watch; })
      .sort(function (a, b) { return b.strength - a.strength; });
    if (!watches.length) return;
    var t = watches[0];
    var rk = Object.keys(REGIONS).filter(function (r) { return REGIONS[r].indicators.indexOf(t.k) >= 0; })[0];
    var advice = (CONTENT.trendAdvice && CONTENT.trendAdvice[t.k]) || 'Consider reviewing your routine';
    var text = trendSentence(t) + ' ' + advice + ', and mention it at your next medical check.';
    var btn = el('button', { type: 'button', class: 'plan-item plan-trend', 'aria-label': 'Trend watch. ' + text }, [
      el('span', { class: 'plan-action', text: text }),
      el('span', { class: 'plan-why' }, [
        el('span', { class: 'tw-badge', text: '◇ Trend watch' }),
        el('span', { class: 'plan-sys', text: REGIONS[rk].name }),
        el('span', { text: 'Latest ' + indicatorPhrase(t.k, latest[t.k], true) + ' is still in range.' })
      ])
    ]);
    btn.addEventListener('click', function () { openRegion(rk, btn); });
    body.appendChild(btn);
    if (watches.length > 1) {
      body.appendChild(el('p', { class: 'meta plan-more', text: (watches.length - 1) + ' more trend-watch ' +
        (watches.length === 2 ? 'signal' : 'signals') + ' on the Trends tab.' }));
    }
  }

  /* ------------------------------------------------------------------ *
   * Hazards section
   * ------------------------------------------------------------------ */
  var hazardFocus = null;

  /** Compact legend: one small tag per NASA HRP hazard. Selecting a tag highlights the systems it may affect. */
  function renderHazards() {
    var box = document.getElementById('hz-legend');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('span', { class: 'hz-tags-label', text: 'Possible contributing hazards' }));
    Object.keys(CONTENT.hazards).forEach(function (id) {
      var hz = CONTENT.hazards[id];
      var mayAffect = joinAnd(hz.indicators.slice(0, 3).map(function (k) { return (/^[A-Z][a-z]+(\s|$)/.test(IND[k].short) ? IND[k].short.charAt(0).toLowerCase() + IND[k].short.slice(1) : IND[k].short); }));
      var btn = el('button', { type: 'button', class: 'hz-tag', 'data-hazard': id, 'aria-pressed': String(hazardFocus === id),
        title: hz.summary + ' May affect ' + mayAffect + '.', text: hz.short });
      btn.addEventListener('click', function () {
        hazardFocus = hazardFocus === id ? null : id;
        renderHazards();
        applyHazardFocus();
      });
      box.appendChild(btn);
    });
    var src = el('a', { class: 'hz-source', href: CONTENT.hazardsUrl, target: '_blank', rel: 'noopener', text: 'NASA HRP' });
    box.appendChild(src);
  }

  function applyHazardFocus() {
    Object.keys(regionNodes).forEach(function (rk) {
      var c = CONTENT.regions[rk];
      var related = !hazardFocus || (c && c.hazards && c.hazards.indexOf(hazardFocus) >= 0);
      regionNodes[rk].group.classList.toggle('dimmed', !related);
    });
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

  /** Fill {key.hi} / {key.lo} / {key.loAbs} with the red ("attention") limits from config.js. */
  function fillLimits(text) {
    return text.replace(/\{(\w+)\.(hi|lo|loAbs)\}/g, function (m, k, which) {
      var spec = IND[k];
      if (!spec || !spec.yellow) return m;
      var v = which === 'hi' ? spec.yellow[1] : spec.yellow[0];
      if (which === 'loAbs') v = Math.abs(v);
      return String(Number(Number(v).toFixed(spec.decimals)));   // 5.0 -> 5, 37.9 stays
    });
  }

  /** One line, max ~12 words: what the current reading means for this system. */
  function statusSummary(key, latest, s) {
    if (!latest) return 'No check-in yet.';
    var flags = REGIONS[key].indicators
      .map(function (k) { return { k: k, st: evaluate(k, latest[k]) }; })
      .filter(function (f) { return f.st === 'yellow' || f.st === 'red'; })
      .sort(function (a, b) { return RANK[b.st] - RANK[a.st]; });
    if (!flags.length) {
      var tw = regionTrendWatch(key, currentTrends);
      if (tw.length) return 'All within range; trend watch on ' + ((TW.indicators[tw[0]].name || IND[tw[0]].short).toLowerCase()) + '.';
      return s === 'unknown' ? 'No readings for this system yet.' : 'All indicators are within range.';
    }
    var first = indicatorPhrase(flags[0].k, latest[flags[0].k]);
    var more = flags.length > 1 ? ' and ' + (flags.length - 1) + ' more' : '';
    var verb = flags.length > 1 ? ' need' : ' needs';
    return first + more + verb + (s === 'red' ? ' attention.' : ' monitoring.');
  }

  /** The indicator charted first: red, then yellow, then trend watch, then the first with data. */
  function focusIndicator(key, latest, history) {
    var keys = REGIONS[key].indicators;
    var pick = null;
    ['red', 'yellow'].some(function (st) {
      pick = keys.filter(function (k) { return latest && evaluate(k, latest[k]) === st; })[0] || null;
      return !!pick;
    });
    if (!pick) pick = regionTrendWatch(key, currentTrends)[0] || null;
    if (!pick) pick = keys.filter(function (k) { return history.some(function (e) { return measuredOn(e, k); }); })[0] || keys[0];
    return pick;
  }

  /** Up to 2 actions: indicator-specific plan actions for flagged indicators first, then the system's own. */
  function nowActions(key, latest, s, content) {
    var out = [];
    if (latest) {
      Object.keys(PLAN_GROUPS).map(function (gk) {
        var g = PLAN_GROUPS[gk];
        var flags = g.indicators.filter(function (k) { return REGIONS[key].indicators.indexOf(k) >= 0; })
          .map(function (k) { return evaluate(k, latest[k]); })
          .filter(function (st) { return st === 'yellow' || st === 'red'; });
        var pos = Math.min.apply(null, g.indicators.map(function (k) { var i = REGIONS[key].indicators.indexOf(k); return i < 0 ? 99 : i; }));
        return { g: g, st: worst(flags), pos: pos };
      }).filter(function (x) { return x.st === 'yellow' || x.st === 'red'; })
        .sort(function (a, b) { return (RANK[b.st] - RANK[a.st]) || (a.pos - b.pos); })
        .forEach(function (x) { var t = x.g.actions[x.st]; if (t && out.indexOf(t) < 0) out.push(t); });
    }
    var own = (content.now && (content.now[s] || content.now.green)) || [];
    own.forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    return out.slice(0, 2);
  }

  function hazardTags(ids) {
    return el('div', { class: 'hz-tags' }, [el('span', { class: 'hz-tags-label', text: 'Possible contributing hazards' })].concat(
      ids.map(function (id) {
        var hz = CONTENT.hazards[id] || { short: id };
        return el('span', { class: 'hz-tag', 'data-hazard': id, title: hz.summary || hz.name, text: hz.short });
      })));
  }

  var drawerChartKey = null;

  function renderDrawer(key) {
    var history = getHistory();
    var latest = currentEntry(history);
    var region = REGIONS[key];
    var content = CONTENT.regions[key] || {};
    var s = regionStatus(key, latest);
    document.getElementById('drawer-title').textContent = region.name;
    var body = document.getElementById('drawer-body');
    var prevMore = body.querySelector('details.more');
    var keepOpen = !!(prevMore && prevMore.open && body.dataset.region === key);
    body.dataset.region = key;
    body.innerHTML = '';

    // 1. Status chip + one-line summary
    body.appendChild(el('section', { class: 'p-status' }, [
      el('span', { class: 'status-chip', 'data-status': s, text: CFG.statusText[s] }),
      el('span', { class: 'p-summary', text: statusSummary(key, latest, s) })
    ]));

    // 2. What to do now
    var al = el('ol', { class: 'now-list' });
    nowActions(key, latest, s, content).forEach(function (t) { al.appendChild(el('li', { text: t })); });
    body.appendChild(section('What to do now', [al]));

    // 3. Contact your flight surgeon if
    var tl = el('ul', { class: 'triggers' });
    (content.contactIf || []).slice(0, 2).forEach(function (t) { tl.appendChild(el('li', { text: fillLimits(t) })); });
    body.appendChild(el('section', { class: 'p-contact' + (s === 'red' ? ' is-red' : '') }, [
      el('h3', { text: s === 'red' ? 'Contact your flight surgeon now. Also if:' : 'Contact your flight surgeon if:' }), tl
    ]));

    // 4. Trend chart: one indicator at a time, switchable
    var recent = history.slice(-30);
    var chartKeys = region.indicators.concat(region.extraCharts || []);
    if (!drawerChartKey || chartKeys.indexOf(drawerChartKey) < 0) drawerChartKey = focusIndicator(key, latest, history);
    var chartBox = el('div', { class: 'p-chart' });
    var chips = el('div', { class: 'chart-chips', role: 'tablist', 'aria-label': 'Choose indicator' });
    function showChart() {
      chartBox.innerHTML = '';
      chartBox.appendChild(trendChart(drawerChartKey, recent));
      [].forEach.call(chips.children, function (c) {
        var on = c.dataset.k === drawerChartKey;
        c.setAttribute('aria-selected', String(on));
        if (on) chips.scrollLeft = Math.max(0, c.offsetLeft - chips.offsetLeft - 8);   // keep the active chip visible
      });
    }
    chartKeys.forEach(function (k) {
      var st = latest ? evaluate(k, latest[k]) : 'unknown';
      var c = el('button', { type: 'button', role: 'tab', class: 'chart-chip', 'data-k': k, 'data-status': st, text: IND[k].short });
      c.addEventListener('click', function () { drawerChartKey = k; showChart(); });
      chips.appendChild(c);
    });
    body.appendChild(el('section', { class: 'p-trend' }, [el('h3', { text: '30-day trend' }), chips, chartBox]));
    showChart();

    // 5. More details (closed by default)
    var more = [el('summary', { text: 'More details' })];
    if (content.what) more.push(el('h4', { text: 'What this system does' }), el('p', { text: content.what }));
    if (content.research) more.push(el('h4', { text: 'Research shows' }), el('p', { text: content.research }));
    if (content.measure) more.push(el('h4', { text: 'How to measure' }), el('p', { text: content.measure }));
    if (content.performance) {
      var testBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Run cognitive check' });
      testBtn.addEventListener('click', function () { openReactionTest(testBtn); });
      more.push(testBtn);
    }
    // Notes: cognitive check, trend watch, BMI
    var notes = [];
    if (content.performance && latest) {
      var perfStatus = worst(['perfReaction', 'perfMemory'].map(function (k) { return evaluate(k, latest[k]); }));
      if (perfStatus === 'yellow' || perfStatus === 'red') { var pn = el('p'); performanceNote(pn, perfStatus, false); notes.push(pn); }
      var lapStatus = evaluate('lapses', latest.lapses);
      if (lapStatus === 'yellow' || lapStatus === 'red') notes.push(el('p', { class: 'alertness-note warn', text: content.alertness }));
    }
    regionTrendWatch(key, currentTrends).forEach(function (k) {
      notes.push(el('p', { class: 'tw-note', text: '◇ Trend watch: ' + trendSentence(currentTrends[k]) }));
    });
    if (key === 'metabolism') {
      var mb = massBaseline(history, latest);
      var bmi = mb ? bmiFor(mb.latest.bodyMass) : null;
      notes.push(el('p', { class: 'meta', text: bmi ? 'BMI ' + bmi + (profile.source === 'synthetic' ? ' (demo height).' : '.') : 'Add your height in the profile to see BMI.' }));
    }
    if (notes.length) more.push(el('h4', { text: 'Notes' })), more.push.apply(more, notes);
    // All readings
    var ul = el('ul', { class: 'readings compact' });
    region.indicators.forEach(function (k) {
      var v = latest ? latest[k] : null;
      var st = evaluate(k, v);
      var valNode = el('span', { class: 'r-val', text: fmt(k, v) });
      valNode.appendChild(el('small', { text: IND[k].unit }));
      ul.appendChild(el('li', { 'data-status': st }, [
        el('span', { class: 'r-name', text: IND[k].short }), valNode,
        el('span', { class: 'r-ref' }, [document.createTextNode('Ref ' + fmtRef(k)), trendTag(k)]),
        el('span', { class: 'r-delta', text: readingNote(latest, k) })
      ]));
    });
    more.push(el('h4', { text: 'All readings' }), ul);
    if (content.hazards) more.push(hazardTags(content.hazards));
    more.push(dataTable(chartKeys, recent));
    var details = el('details', { class: 'more' }, more);
    if (keepOpen) details.open = true;
    body.appendChild(details);

    body.appendChild(el('p', { class: 'panel-disclaimer', text: DISCLAIMER }));
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
    if (!pts.length) { wrap.appendChild(el('p', { class: 'meta', text: spec.optional ? 'Not measured yet.' : 'No data yet.' })); return wrap; }

    // Y domain from the data plus any band edges that are not open-ended.
    var lim = spec.input;
    var hasBands = !!spec.green;
    var inner = (hasBands ? [spec.green[0], spec.green[1], spec.yellow[0], spec.yellow[1]] : [])
      .concat(spec.targetLine ? [spec.targetLine] : [])
      .filter(function (b) { return b > lim.min && b < lim.max; });
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
    if (hasBands) {
      root.appendChild(svg('rect', { class: 'band band-yellow', x: L, width: W - L - R,
        y: clampY(spec.yellow[1]), height: clampY(spec.yellow[0]) - clampY(spec.yellow[1]) }));
      root.appendChild(svg('rect', { class: 'band band-green', x: L, width: W - L - R,
        y: clampY(spec.green[1]), height: clampY(spec.green[0]) - clampY(spec.green[1]) }));
    }
    if (spec.targetLine) {
      root.appendChild(svg('line', { class: 'target-line', x1: L, x2: W - R, y1: y(spec.targetLine), y2: y(spec.targetLine) }));
      root.appendChild(svg('text', { class: 'axis', x: W - R, y: y(spec.targetLine) - 4, 'text-anchor': 'end', text: 'target' }));
    }
    if (!hasBands) {
      // No reference range: label the data's own min and max instead.
      [Math.min.apply(null, vals), Math.max.apply(null, vals)].forEach(function (v) {
        root.appendChild(svg('text', { class: 'axis', x: L - 6, y: y(v) + 3, 'text-anchor': 'end', text: fmt(key, v) }));
      });
    }

    // Y labels at the interior green bounds, X labels at the ends of the window
    (hasBands ? [spec.green[0], spec.green[1]] : []).forEach(function (v) {
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
      if ((st === 'green' || st === 'unknown') && !isLast && !sparse && p.e.source !== 'user') return;
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
      tip.appendChild(el('strong', { text: withUnit(key, e[key]) + (spec.levels && spec.levels[e[key]] ? ' · ' + spec.levels[e[key]] : '') }));
      tip.appendChild(el('span', { text: fmtDate(e.date) + (e.source === 'user' ? ' · your entry' : '') }));
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
      el('p', { class: 'meta', text: '• = your entry.' })
    ]);
  }

  function openRegion(key, trigger) {
    if (openKey !== key) drawerChartKey = null;
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

  /** Self-rated scales (mood, dizziness, vision, urine color) are radio groups in the form. */
  function isScale(k) { return !!form.querySelector('input[type="radio"][name="' + k + '"]'); }

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
        if (isScale(k)) {
          var r = form.querySelector('input[name="' + k + '"][value="' + latest[k] + '"]');
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
    var acc = form.elements.memAccuracy.value, span = form.elements.memSpan.value;
    var summary = document.getElementById('rt-summary');
    var has = med !== '' && lap !== '';
    var hasMem = acc !== '' && span !== '';
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
    if (hasMem) {
      summary.appendChild(document.createTextNode(' · Memory ' + acc + '%, longest ' + span + ' digits'));
    }
    document.getElementById('rt-clear').hidden = !has && !hasMem;
  }

  function setupProfile() {
    var input = document.getElementById('profile-height');
    var note = document.getElementById('profile-note');
    var lim = CFG.profile.height.input;
    input.min = lim.min; input.max = lim.max; input.step = lim.step;
    function show() {
      input.value = profile.source === 'user' ? profile.height : '';
      input.placeholder = profile.source === 'synthetic' ? profile.height + ' (demo)' : 'cm';
      note.textContent = profile.source === 'user' ? 'Saved in this browser: ' + profile.height + ' cm.'
        : profile.source === 'synthetic' ? 'Demo height in use.' : 'Not set.';
    }
    document.getElementById('profile-save').addEventListener('click', function () {
      var v = parseFloat(input.value);
      if (isNaN(v) || v < lim.min || v > lim.max) { note.textContent = 'Enter a height between ' + lim.min + ' and ' + lim.max + ' cm.'; input.classList.add('invalid'); return; }
      input.classList.remove('invalid');
      saveProfile(Math.round(v));
      profile = loadProfile();
      show();
      render();
      toast('Height saved.');
    });
    show();
  }

  document.getElementById('rt-clear').addEventListener('click', function () {
    form.elements.reactionMedian.value = '';
    form.elements.lapses.value = '';
    form.elements.memAccuracy.value = '';
    form.elements.memSpan.value = '';
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
      var scale = isScale(k);
      var input = scale ? null : form.elements[k];
      var raw = scale
        ? (form.querySelector('input[name="' + k + '"]:checked') || {}).value
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
    activateTab('overview');
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

  var COG_STEPS = ['rt-intro', 'rt-run', 'rt-result', 'mem-intro', 'mem-run', 'cog-result'];
  function rtShow(step) {
    COG_STEPS.forEach(function (id) { document.getElementById(id).hidden = id !== step; });
  }

  /**
   * What a new test result would mean against the personal baseline:
   * recorded tests (excluding the form's date, which the new entry replaces) + this one.
   */
  function projectedPerf(k, newVals) {
    var spec = IND[k], d = spec.derived, date = form.elements.date.value;
    var tests = [];
    getHistory().forEach(function (e) {
      if (e.date === date) return;
      var vals = d.from.map(function (f) { return e[f]; });
      if (vals.every(function (v) { return typeof v === 'number' && !isNaN(v); })) tests.push(vals);
    });
    tests.push(d.from.map(function (f) { return newVals[f]; }));
    return { value: perfVsBaseline(tests, d), count: tests.length };
  }

  function perfText(k, p) {
    if (p.value == null) return 'Building baseline: ' + p.count + ' of ' + CFG.cognitive.baselineTests;
    return fmt(k, p.value) + '% vs baseline';
  }

  function statTile(box, label, value, st) {
    box.appendChild(el('div', { class: 'stat', 'data-status': st || 'unknown' }, [
      el('span', { class: 'stat-label', text: label }),
      el('span', { class: 'stat-val', text: value })
    ]));
  }

  /** Yellow/red performance note, or a neutral line when within the baseline range. */
  function performanceNote(node, status, building) {
    var perf = (CONTENT.regions.nervous && CONTENT.regions.nervous.performance) || {};
    if (status === 'red' || status === 'yellow') {
      node.className = 'alertness-note ' + (status === 'red' ? 'danger' : 'warn');
      node.textContent = perf[status];
    } else {
      node.className = 'alertness-note';
      node.textContent = building
        ? 'Your first ' + CFG.cognitive.baselineTests + ' checks set your personal baseline.'
        : 'Within 15% of your baseline.';
    }
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
    stopMem();
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
    var perf = rtResult ? projectedPerf('perfReaction', rtResult) : null;
    if (rtResult) rtResult.perf = perf;
    var perfStatus = perf ? evaluate('perfReaction', perf.value) : 'unknown';
    var lapStatus = rtResult ? evaluate('lapses', rtResult.lapses) : 'unknown';
    statTile(stats, 'Median reaction', rtResult ? rtResult.reactionMedian + ' ms' : '—');
    statTile(stats, 'Vs your baseline', perf ? perfText('perfReaction', perf) : '—', perfStatus);
    statTile(stats, 'Lapses > ' + RT.lapseMs + ' ms', rtResult ? String(rtResult.lapses) : '—', lapStatus);
    statTile(stats, 'Responses · false starts', trials.length + ' · ' + falseStarts);

    var advice = document.getElementById('rt-advice');
    if (!enough) {
      advice.className = 'alertness-note';
      advice.textContent = 'Not enough responses (' + trials.length + ' of ' + RT.minResponses + '). Try again when you can focus.';
    } else if (lapStatus === 'yellow' || lapStatus === 'red') {
      advice.className = 'alertness-note warn';
      advice.textContent = (CONTENT.regions.nervous && CONTENT.regions.nervous.alertness) || '';
    } else {
      performanceNote(advice, perfStatus, perf.value == null);
    }
    document.getElementById('rt-next').disabled = !enough;
    document.getElementById('rt-use').disabled = !enough;
    rtShow('rt-result');
    document.getElementById(enough ? 'rt-next' : 'rt-again').focus({ preventScroll: true });
  }

  /* ---- Part 2: working-memory digit test (1 minute) ---- */
  var MEM = CFG.cognitive.memory;
  var mem = null;
  var memResult = null;
  var memDisplay = document.getElementById('mem-display');
  var memForm = document.getElementById('mem-form');
  var memInput = document.getElementById('mem-input');
  var memFeedback = document.getElementById('mem-feedback');

  function startMem() {
    memResult = null;
    mem = { endAt: performance.now() + MEM.durationSec * 1000, length: MEM.startLength, trials: [], timers: [] };
    rtShow('mem-run');
    tickMem();
    nextSequence();
  }

  function stopMem() {
    if (!mem) return;
    mem.timers.forEach(clearTimeout);
    cancelAnimationFrame(mem.raf);
    mem = null;
  }

  function tickMem() {
    if (!mem) return;
    var left = Math.max(0, mem.endAt - performance.now());
    document.getElementById('mem-bar').style.width = (100 - left / (MEM.durationSec * 10)) + '%';
    document.getElementById('mem-status').textContent = 'Time left ' + Math.ceil(left / 1000) + ' s · ' + mem.trials.length + ' sequences · length ' + mem.length;
    mem.raf = requestAnimationFrame(tickMem);
  }

  function nextSequence() {
    if (!mem) return;
    if (performance.now() >= mem.endAt) { finishMem(); return; }
    var seq = '', prev = -1;
    for (var i = 0; i < mem.length; i++) {
      var dgt;
      do { dgt = Math.floor(Math.random() * 10); } while (dgt === prev);   // no immediate repeats
      seq += dgt; prev = dgt;
    }
    mem.seq = seq;
    memForm.hidden = true;
    memFeedback.textContent = 'Watch the digits…';
    memDisplay.textContent = '';
    var t = 0;
    seq.split('').forEach(function (ch) {
      mem.timers.push(setTimeout(function () { if (mem) memDisplay.textContent = ch; }, t));
      t += MEM.digitMs;
      mem.timers.push(setTimeout(function () { if (mem) memDisplay.textContent = ''; }, t));
      t += MEM.gapMs;
    });
    mem.timers.push(setTimeout(function () {
      if (!mem) return;
      memDisplay.textContent = '?';
      memFeedback.textContent = 'Type the ' + mem.length + ' digits in order, then press Enter.';
      memInput.value = '';
      memForm.hidden = false;
      memInput.focus({ preventScroll: true });
    }, t));
  }

  memForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!mem || memForm.hidden) return;
    var answer = memInput.value.replace(/\D/g, '');
    var correct = answer === mem.seq;
    mem.trials.push({ length: mem.length, correct: correct });
    memForm.hidden = true;
    memDisplay.textContent = correct ? '✓' : '✕';
    memFeedback.textContent = correct ? 'Correct.' : 'Not quite. It was ' + mem.seq.split('').join(' ') + '.';
    mem.length = correct ? Math.min(MEM.maxLength, mem.length + 1) : Math.max(MEM.minLength, mem.length - 1);
    mem.timers.push(setTimeout(nextSequence, correct ? 700 : 1400));
  });

  function finishMem() {
    if (!mem) return;
    var trials = mem.trials;
    stopMem();
    var enough = trials.length >= MEM.minTrials;
    var correct = trials.filter(function (t) { return t.correct; });
    memResult = enough ? {
      memAccuracy: Math.round(correct.length / trials.length * 100),
      memSpan: correct.reduce(function (m, t) { return Math.max(m, t.length); }, 0),
      sequences: trials.length
    } : null;
    showCogResult(trials.length);
  }

  /** Final screen: both parts, each compared with the personal baseline. */
  function showCogResult(memTrials) {
    var stats = document.getElementById('cog-stats');
    stats.innerHTML = '';
    var rPerf = rtResult && rtResult.perf;
    var mPerf = memResult ? projectedPerf('perfMemory', memResult) : null;
    if (memResult) memResult.perf = mPerf;
    var rSt = rPerf ? evaluate('perfReaction', rPerf.value) : 'unknown';
    var mSt = mPerf ? evaluate('perfMemory', mPerf.value) : 'unknown';
    statTile(stats, 'Reaction · median', rtResult ? rtResult.reactionMedian + ' ms' : '—');
    statTile(stats, 'Reaction vs baseline', rPerf ? perfText('perfReaction', rPerf) : '—', rSt);
    statTile(stats, 'Memory · accuracy · longest', memResult ? memResult.memAccuracy + '% · ' + memResult.memSpan + ' digits' : '—');
    statTile(stats, 'Memory vs baseline', mPerf ? perfText('perfMemory', mPerf) : '—', mSt);
    var note = document.getElementById('cog-advice');
    if (!memResult) {
      note.className = 'alertness-note';
      note.textContent = 'Not enough sequences (' + memTrials + ' of ' + MEM.minTrials + '). You can still add the reaction result.';
    } else {
      performanceNote(note, worst([rSt, mSt]), (rPerf && rPerf.value == null) || mPerf.value == null);
    }
    rtShow('cog-result');
    document.getElementById('cog-use').focus({ preventScroll: true });
  }

  function addCognitiveResults() {
    if (rtResult) {
      form.elements.reactionMedian.value = rtResult.reactionMedian;
      form.elements.lapses.value = rtResult.lapses;
    }
    if (memResult) {
      form.elements.memAccuracy.value = memResult.memAccuracy;
      form.elements.memSpan.value = memResult.memSpan;
    }
    updateReactionSummary();
    rtTrigger = openKey ? document.getElementById('drawer-close') : document.getElementById('rt-open');
    closeReactionTest();
    toast('Cognitive check added to the check-in form. Record the check-in to save it.');
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
  document.getElementById('rt-use').addEventListener('click', function () { memResult = null; addCognitiveResults(); });
  document.getElementById('rt-next').addEventListener('click', function () { rtShow('mem-intro'); document.getElementById('mem-start').focus({ preventScroll: true }); });
  document.getElementById('mem-start').addEventListener('click', startMem);
  document.getElementById('cog-use').addEventListener('click', addCognitiveResults);
  document.getElementById('cog-again').addEventListener('click', function () { rtResult = null; memResult = null; rtShow('rt-intro'); document.getElementById('rt-start').focus({ preventScroll: true }); });

  document.getElementById('clear-user').addEventListener('click', function () {
    if (!userEntries.length) { toast('No entries of yours to clear.'); return; }
    if (!window.confirm('Remove all ' + userEntries.length + ' of your check-ins from this browser?')) return;
    userEntries = [];
    saveUserEntries();
    render();
    toast('Your entries were cleared.');
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
  setupTabs();
  setupForm();
  setupProfile();
  renderScenarios();
  render();

  // Exposed for debugging / later stages.
  window.AURA = { getHistory: getHistory, computeTrends: computeTrends, bmiFor: bmiFor, indicatorScore: indicatorScore, streak: streak, evaluate: evaluate, regionStatus: regionStatus, overallStatus: overallStatus };
})();
