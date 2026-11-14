/*
 * AURA-CREW — SYNTHETIC DEMO DATA
 *
 * !!! SYNTHETIC — NOT REAL ASTRONAUT OR PATIENT DATA !!!
 *
 * 30 days of made-up daily check-ins, generated deterministically from a
 * fixed seed so the demo looks the same every time. Dates are placed relative
 * to "today" so the history always ends on the current day.
 * Every entry carries `source: 'synthetic'` and the UI shows a
 * "Synthetic demo data" badge while any synthetic entry is in the history.
 */
(function () {
  'use strict';

  // Small seeded PRNG (mulberry32) so the synthetic data is reproducible.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(2026);
  // Roughly bell-shaped noise in [-1.5, 1.5]
  function noise() { return rand() + rand() + rand() - 1.5; }
  function round(v, d) { var f = Math.pow(10, d || 0); return Math.round(v * f) / f; }
  function isoLocal(d) {
    var z = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - z).toISOString().slice(0, 10);
  }

  var DAYS = 30;
  var today = new Date();
  today.setHours(12, 0, 0, 0);
  var history = [];

  for (var i = DAYS - 1; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var t = (DAYS - 1 - i) / (DAYS - 1);          // 0 → 1 over the month
    var late = Math.max(0, (t - 0.7) / 0.3);       // ramps up over the last ~9 days

    history.push({
      date: isoLocal(d),
      source: 'synthetic',
      systolic: Math.round(117 + 13 * late + noise() * 5),
      diastolic: Math.round(76 + 8 * late + noise() * 3),
      heartRate: Math.round(64 + 6 * late + noise() * 4),
      glucose: Math.round(88 + noise() * 7),
      temperature: round(36.7 + noise() * 0.2, 1),
      sleep: round(7.6 - 1.1 * late + noise() * 0.5, 1),
      mood: Math.max(1, Math.min(5, Math.round(4.3 - 1.2 * late + noise() * 0.6)))
    });
  }

  // A few scripted events so the trend charts have something to show.
  var mid = history[14];
  mid.sleep = 5.4; mid.mood = 3;                   // one short-sleep night mid-month
  var hot = history[9];
  hot.temperature = 37.6;                          // one mildly elevated temperature reading

  // Pin the latest synthetic day so the demo opens in a known state:
  // cardiovascular + brain/mind "monitor", everything else "within range".
  var last = history[history.length - 1];
  last.systolic = 134; last.diastolic = 86; last.heartRate = 74;
  last.glucose = 92; last.temperature = 36.8; last.sleep = 7.2; last.mood = 3;

  window.AURA_SYNTHETIC_HISTORY = history;
})();
