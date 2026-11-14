/*
 * AURA-CREW — configuration
 *
 * ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
 *
 * Every threshold the app uses lives in this file. Each indicator has:
 *   green  : [min, max] range treated as "within reference range"
 *   yellow : [min, max] wider range treated as "monitor"
 *   anything outside `yellow` is shown as "attention" (red)
 *   input  : plausibility limits for the check-in form (not health thresholds)
 *   optional        : may be left blank in the check-in
 *   derived         : computed from a daily input (e.g. 7-day exercise totals)
 *   carryForwardDays: for periodic measurements, the latest value is used for
 *                     status for up to this many days
 *   signed          : show a "+" sign for positive values
 *   levels          : names for each value of a self-rated scale
 *   derived.agg     : 'sum' (default) or 'avg' over the window;
 *   derived.type    : 'pctChange' = % change versus the value `days` earlier;
 *                     'baseline'  = performance of the recent tests versus the
 *                     astronaut's own baseline (see `cognitive`)
 *   refText         : custom wording for the reference shown next to a value
 *   redText         : custom wording for the "attention" limit (flight-surgeon trigger)
 *
 * These values are decision-support placeholders, not clinical criteria.
 */
// ASSUMPTION - daily energy intake target, to be reviewed against NASA HRP sources.
// Real targets are set per crew member by the mission nutrition team.
var AURA_CALORIE_TARGET = 2700; // kcal/day

window.AURA_CONFIG = {
  // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
  indicators: {
    systolic: {
      label: 'Systolic blood pressure',
      short: 'Systolic BP',
      unit: 'mmHg',
      decimals: 0,
      green: [90, 129],
      yellow: [85, 139],
      input: { min: 60, max: 250, step: 1 }
    },
    diastolic: {
      label: 'Diastolic blood pressure',
      short: 'Diastolic BP',
      unit: 'mmHg',
      decimals: 0,
      green: [60, 84],
      yellow: [55, 89],
      input: { min: 30, max: 150, step: 1 }
    },
    heartRate: {
      label: 'Resting heart rate',
      short: 'Heart rate',
      unit: 'bpm',
      decimals: 0,
      green: [50, 100],
      yellow: [45, 110],
      input: { min: 25, max: 220, step: 1 }
    },
    glucose: {
      label: 'Blood glucose (fasting)',
      short: 'Glucose',
      unit: 'mg/dL',
      decimals: 0,
      green: [70, 99],
      yellow: [60, 125],
      input: { min: 20, max: 600, step: 1 }
    },
    temperature: {
      label: 'Body temperature',
      short: 'Temperature',
      unit: '°C',
      decimals: 1,
      green: [36.1, 37.4],
      yellow: [35.5, 37.9],
      input: { min: 32, max: 43, step: 0.1 }
    },
    sleep: {
      label: 'Sleep duration',
      short: 'Sleep',
      unit: 'h',
      decimals: 1,
      green: [7, 9],
      yellow: [6, 10.5],
      input: { min: 0, max: 24, step: 0.1 }
    },
    mood: {
      label: 'Self-rated mood',
      short: 'Mood',
      unit: '/5',
      decimals: 0,
      green: [4, 5],
      yellow: [3, 5],
      input: { min: 1, max: 5, step: 1 }
    },

    // --- Respiratory ---
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    spo2: {
      label: 'Blood oxygen saturation (SpO₂)',
      short: 'SpO₂',
      unit: '%',
      decimals: 0,
      green: [95, 100],
      yellow: [92, 100],
      input: { min: 50, max: 100, step: 1 }
    },
    respRate: {
      label: 'Respiratory rate (at rest)',
      short: 'Respiratory rate',
      unit: '/min',
      decimals: 0,
      green: [12, 20],
      yellow: [10, 24],
      input: { min: 4, max: 60, step: 1 }
    },
    cabinCO2: {
      // ~3300 ppm ≈ 2.5 mmHg, ~5300 ppm ≈ 4 mmHg CO₂ partial pressure at sea-level cabin pressure
      label: 'Cabin CO₂',
      short: 'Cabin CO₂',
      unit: 'ppm',
      decimals: 0,
      green: [0, 3300],
      yellow: [0, 5300],
      optional: true,
      input: { min: 200, max: 20000, step: 10 }
    },

    // --- Urinary / renal ---
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    fluidIntake: {
      label: 'Fluid intake today',
      short: 'Fluid intake',
      unit: 'L',
      decimals: 1,
      green: [2, 5],
      yellow: [1.5, 6],
      input: { min: 0, max: 10, step: 0.1 }
    },
    urineColor: {
      label: 'Urine color (1 = pale, 5 = dark)',
      short: 'Urine color',
      unit: '/5',
      decimals: 0,
      green: [1, 2],
      yellow: [1, 3],
      levels: { 1: 'Pale', 2: 'Light yellow', 3: 'Yellow', 4: 'Dark yellow', 5: 'Amber' },
      input: { min: 1, max: 5, step: 1 }
    },

    // --- Nervous system self-checks (not diagnoses) ---
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    // Severe dizziness (3) or a noticeable vision change (2) is outside `yellow`, so it shows red.
    dizziness: {
      label: 'Dizziness / balance problems',
      short: 'Dizziness',
      unit: '/3',
      decimals: 0,
      green: [0, 0],
      yellow: [0, 2],
      levels: { 0: 'None', 1: 'Mild', 2: 'Moderate', 3: 'Severe' },
      input: { min: 0, max: 3, step: 1 }
    },
    visionChange: {
      label: 'Vision change',
      short: 'Vision change',
      unit: '/2',
      decimals: 0,
      green: [0, 0],
      yellow: [0, 1],
      levels: { 0: 'None', 1: 'Slight', 2: 'Noticeable' },
      input: { min: 0, max: 2, step: 1 }
    },

    // --- Cognitive check: 1-minute reaction self-test (inspired by the ISS PVT)
    //     plus a 1-minute working-memory digit test. Raw results are charted;
    //     status compares them with the astronaut's OWN baseline (below). ---
    reactionMedian: {
      label: 'Reaction time (median)',
      short: 'Reaction time',
      unit: 'ms',
      decimals: 0,
      inputOnly: true,
      optional: true,
      input: { min: 100, max: 3000, step: 1 }
    },
    memAccuracy: {
      label: 'Working memory accuracy',
      short: 'Memory accuracy',
      unit: '%',
      decimals: 0,
      inputOnly: true,
      optional: true,
      input: { min: 0, max: 100, step: 1 }
    },
    memSpan: {
      label: 'Longest correct digit sequence',
      short: 'Longest sequence',
      unit: 'digits',
      decimals: 0,
      inputOnly: true,
      optional: true,
      input: { min: 0, max: 20, step: 1 }
    },
    // ASSUMPTION - personal-baseline thresholds, to be reviewed against NASA HRP sources.
    // Value = % change of the average of the last 3 tests versus the average of the
    // first 3 completed tests (negative = below baseline). A drop of more than 15%
    // is "monitor", more than 30% is "attention".
    perfReaction: {
      label: 'Reaction speed vs own baseline',
      short: 'Reaction vs baseline',
      unit: '%',
      decimals: 0,
      signed: true,
      green: [-15, 100],
      yellow: [-30, 100],
      refText: 'within 15% of baseline',
      redText: 'reaction speed more than 30% below your baseline',
      // Reaction time: lower is better, so a slower time counts as a drop.
      derived: { type: 'baseline', from: ['reactionMedian'], better: 'lower' },
      input: { min: -100, max: 100, step: 1 }
    },
    perfMemory: {
      label: 'Working memory vs own baseline',
      short: 'Memory vs baseline',
      unit: '%',
      decimals: 0,
      signed: true,
      green: [-15, 100],
      yellow: [-30, 100],
      refText: 'within 15% of baseline',
      redText: 'working memory more than 30% below your baseline',
      // Uses the larger drop of accuracy and longest correct sequence.
      derived: { type: 'baseline', from: ['memAccuracy', 'memSpan'], better: 'higher' },
      input: { min: -100, max: 100, step: 1 }
    },
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    lapses: {
      label: 'Attention lapses (> 500 ms)',
      short: 'Lapses',
      unit: 'lapses',
      decimals: 0,
      green: [0, 1],
      yellow: [0, 3],
      optional: true,
      input: { min: 0, max: 60, step: 1 }
    },

    // --- Exercise countermeasures (daily inputs, no thresholds of their own) ---
    resistiveMin: {
      label: 'Resistive exercise today',
      short: 'Resistive today',
      unit: 'min',
      decimals: 0,
      inputOnly: true,
      input: { min: 0, max: 300, step: 1 }
    },
    aerobicMin: {
      label: 'Aerobic exercise today',
      short: 'Aerobic today',
      unit: 'min',
      decimals: 0,
      inputOnly: true,
      input: { min: 0, max: 300, step: 1 }
    },

    // --- Exercise 7-day totals (derived; drive bones & muscle status) ---
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    resistive7d: {
      label: 'Resistive exercise, 7-day total',
      short: 'Resistive exercise (7 d)',
      unit: 'min',
      decimals: 0,
      green: [240, 2100],
      yellow: [150, 2100],
      derived: { from: 'resistiveMin', days: 7 },
      input: { min: 0, max: 2100, step: 1 }
    },
    aerobic7d: {
      label: 'Aerobic exercise, 7-day total',
      short: 'Aerobic exercise (7 d)',
      unit: 'min',
      decimals: 0,
      green: [180, 2100],
      yellow: [120, 2100],
      derived: { from: 'aerobicMin', days: 7 },
      input: { min: 0, max: 2100, step: 1 }
    },

    // --- Bone markers (optional, periodic, % change vs preflight baseline) ---
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    urinaryCalcium: {
      label: 'Urinary calcium change vs preflight',
      short: 'Urinary calcium',
      unit: '%',
      decimals: 0,
      signed: true,
      green: [-100, 20],
      yellow: [-100, 50],
      optional: true,
      carryForwardDays: 30,
      input: { min: -100, max: 500, step: 1 }
    },
    boneResorption: {
      label: 'Bone resorption marker change vs preflight',
      short: 'Bone resorption',
      unit: '%',
      decimals: 0,
      signed: true,
      green: [-100, 25],
      yellow: [-100, 60],
      optional: true,
      carryForwardDays: 30,
      input: { min: -100, max: 500, step: 1 }
    },

    // --- Metabolism: body mass and energy intake ---
    // Daily inputs (no thresholds of their own; charted in the metabolism panel)
    bodyMass: {
      label: 'Body mass',
      short: 'Body mass',
      unit: 'kg',
      decimals: 1,
      inputOnly: true,
      optional: true,
      input: { min: 30, max: 200, step: 0.1 }
    },
    calories: {
      label: 'Calorie intake today',
      short: 'Calories today',
      unit: 'kcal',
      decimals: 0,
      inputOnly: true,
      targetLine: AURA_CALORIE_TARGET,
      input: { min: 0, max: 8000, step: 10 }
    },
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    // Status: % change of body mass over 7 days. A drop of more than 3% is
    // "monitor", more than 5% is "attention". The change versus the first
    // recorded value is shown alongside for context.
    massChange7d: {
      label: 'Body mass change over 7 days',
      short: 'Body mass change (7 d)',
      unit: '%',
      decimals: 1,
      signed: true,
      green: [-3, 100],
      yellow: [-5, 100],
      redText: 'body mass down more than 5% in 7 days',
      derived: { from: 'bodyMass', type: 'pctChange', days: 7 },
      input: { min: -100, max: 100, step: 0.1 }
    },
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    // Status: 7-day average intake versus AURA_CALORIE_TARGET.
    // Within range 90–125% of target, monitor 80–90% or 125–140%, attention beyond.
    calories7d: {
      label: 'Calorie intake, 7-day average',
      short: 'Calorie intake (7-day avg)',
      unit: 'kcal',
      decimals: 0,
      green: [Math.round(AURA_CALORIE_TARGET * 0.9), Math.round(AURA_CALORIE_TARGET * 1.25)],
      yellow: [Math.round(AURA_CALORIE_TARGET * 0.8), Math.round(AURA_CALORIE_TARGET * 1.4)],
      target: AURA_CALORIE_TARGET,
      derived: { from: 'calories', days: 7, agg: 'avg' },
      input: { min: 0, max: 8000, step: 10 }
    }
  },

  // One-time profile (stored in this browser). Height is used only to show BMI
  // in the metabolism panel; it is not a daily indicator and does not affect status.
  profile: {
    height: { label: 'Height', unit: 'cm', input: { min: 120, max: 220, step: 1 } }
  },
  profileKey: 'aura-crew.profile.v1',

  // Order of indicators on the dashboard, in the score and on the check-in form.
  dashboardIndicators: [
    'mood', 'sleep', 'perfReaction', 'perfMemory', 'lapses', 'dizziness', 'visionChange',
    'systolic', 'diastolic', 'heartRate',
    'spo2', 'respRate', 'cabinCO2',
    'fluidIntake', 'urineColor', 'urinaryCalcium',
    'resistive7d', 'aerobic7d', 'boneResorption',
    'temperature',
    'glucose', 'massChange7d', 'calories7d'
  ],
  formFields: [
    'systolic', 'diastolic', 'heartRate', 'spo2', 'respRate', 'cabinCO2',
    'glucose', 'temperature', 'sleep', 'mood', 'dizziness', 'visionChange',
    'fluidIntake', 'urineColor', 'resistiveMin', 'aerobicMin',
    'urinaryCalcium', 'boneResorption', 'reactionMedian', 'lapses', 'memAccuracy', 'memSpan',
    'bodyMass', 'calories'
  ],

  // ASSUMPTION - trend-watch thresholds, to be reviewed against NASA HRP sources.
  // Early-warning signal only, not a diagnosis. For each listed indicator a
  // straight line is fitted to the recorded values of the last `days` days.
  // "Trend watch" is raised when the latest value is still within range but the
  // line moves in the `worse` direction by at least `step` over the window and
  // fits the data steadily (R² ≥ minR2). `name` (optional) is used in the
  // trend sentence. Arrows: a change below
  // step × flatFraction (or R² below arrowMinR2) is shown as steady (→).
  trendWatch: {
    days: 14,
    minPoints: 6,           // body mass is measured every other day: 7 readings in 14 days
    minR2: 0.6,
    arrowMinR2: 0.3,
    flatFraction: 0.5,
    indicators: {
      systolic: { worse: 'up', step: 8 },
      diastolic: { worse: 'up', step: 5 },
      heartRate: { worse: 'up', step: 6 },
      spo2: { worse: 'down', step: 1.5 },
      respRate: { worse: 'up', step: 2 },
      cabinCO2: { worse: 'up', step: 400 },
      glucose: { worse: 'up', step: 8 },
      temperature: { worse: 'up', step: 0.3 },
      sleep: { worse: 'down', step: 0.7 },
      mood: { worse: 'down', step: 0.8 },
      reactionMedian: { worse: 'up', step: 25 },
      perfReaction: { worse: 'down', step: 8, name: 'Reaction speed versus your baseline' },
      perfMemory: { worse: 'down', step: 8, name: 'Working memory versus your baseline' },
      memAccuracy: { worse: 'down', step: 10 },
      memSpan: { worse: 'down', step: 1 },
      lapses: { worse: 'up', step: 1.5 },
      fluidIntake: { worse: 'down', step: 0.3 },
      urinaryCalcium: { worse: 'up', step: 10 },
      boneResorption: { worse: 'up', step: 10 },
      resistive7d: { worse: 'down', step: 60 },
      aerobic7d: { worse: 'down', step: 45 },
      massChange7d: { worse: 'down', step: 1, name: 'Body mass' },
      calories7d: { worse: 'down', step: 150, name: 'Average calorie intake' }
    }
  },

  // ASSUMPTION - reaction self-test settings, to be reviewed against NASA HRP sources.
  // Inspired by the psychomotor vigilance test (PVT); not a validated clinical test.
  reactionTest: {
    durationSec: 60,
    minDelayMs: 2000,     // random wait before the circle lights up
    maxDelayMs: 6000,
    lapseMs: 500,         // a response slower than this counts as a lapse
    timeoutMs: 3000,      // no response after this is recorded as a lapse
    falseStartMs: 100,    // faster than this counts as a false start
    minResponses: 5       // fewer valid responses: result is not used
  },

  // ASSUMPTION - cognitive check settings, to be reviewed against NASA HRP sources.
  // A performance check compared with the astronaut's own baseline, not an IQ test
  // and not a validated clinical test.
  cognitive: {
    baselineTests: 3,     // baseline = average of the first 3 completed tests
    recentTests: 3,       // compared with the average of the last 3 tests
    carryForwardDays: 7,  // days a result still counts for status without a new test
    memory: {
      durationSec: 60,
      startLength: 3,     // digits in the first sequence
      minLength: 3,
      maxLength: 12,
      digitMs: 700,       // each digit is shown for this long
      gapMs: 250,         // blank gap between digits
      minTrials: 3        // fewer completed sequences: result is not used
    }
  },

  // ASSUMPTION - mapping of indicators to body systems is a simplified proxy,
  // to be reviewed against NASA HRP sources. A region's status is the worst
  // status among the indicators it depends on.
  regions: {
    nervous: {
      name: 'Nervous system',
      indicators: ['mood', 'sleep', 'perfReaction', 'perfMemory', 'lapses', 'dizziness', 'visionChange'],
      // Raw cognitive-check results, charted for context
      extraCharts: ['reactionMedian', 'memAccuracy', 'memSpan']
    },
    heart: {
      name: 'Cardiovascular',
      indicators: ['systolic', 'diastolic', 'heartRate']
    },
    respiratory: {
      name: 'Respiratory',
      indicators: ['spo2', 'respRate', 'cabinCO2']
    },
    renal: {
      name: 'Urinary & renal',
      // urinaryCalcium is shared with bones & muscle
      indicators: ['fluidIntake', 'urineColor', 'urinaryCalcium']
    },
    immune: {
      name: 'Immune system',
      indicators: ['temperature', 'sleep']
    },
    metabolism: {
      name: 'Metabolism',
      indicators: ['glucose', 'massChange7d', 'calories7d'],
      // Daily inputs charted in the panel for context (no status of their own)
      extraCharts: ['bodyMass', 'calories']
    },
    musculoskeletal: {
      name: 'Bones & muscle',
      // 7-day exercise countermeasure totals, plus optional periodic bone
      // markers when provided (latest value within carryForwardDays).
      indicators: ['resistive7d', 'aerobic7d', 'urinaryCalcium', 'boneResorption']
    }
  },

  statusText: {
    green: 'Within range',
    yellow: 'Monitor',
    red: 'Attention',
    unknown: 'No data'
  },

  // ASSUMPTION - illustrative what-if offsets added to the latest check-in,
  // to be reviewed against NASA HRP sources. They show how indicators MAY
  // shift; they are not predictions. Results are clamped to input limits.
  scenarios: {
    skipExercise: {
      label: 'Skip exercise',
      detail: '3 days without countermeasure exercise',
      hazard: 'gravity',
      deltas: { resistive7d: -165, aerobic7d: -105, urinaryCalcium: 10, massChange7d: -0.5, heartRate: 5, systolic: 4, glucose: 8, mood: -1 }
    },
    sleepDeficit: {
      label: 'Sleep deficit',
      detail: 'About 2.5 h less sleep than usual',
      hazard: 'environment',
      deltas: { sleep: -2.5, mood: -1, reactionMedian: 45, perfReaction: -14, perfMemory: -12, lapses: 2, heartRate: 5, glucose: 8, systolic: 4 }
    },
    radiationEvent: {
      label: 'Radiation event',
      detail: 'Solar particle event, crew sheltering in place',
      hazard: 'radiation',
      deltas: { sleep: -1.5, mood: -1, reactionMedian: 20, perfReaction: -6, perfMemory: -5, lapses: 1, heartRate: 4, temperature: 0.3, cabinCO2: 1200 }
    },
    evaDay: {
      label: 'Spacewalk day',
      detail: 'Long EVA in the suit, little to drink',
      hazard: 'environment',
      deltas: { heartRate: 10, respRate: 4, spo2: -2, fluidIntake: -0.8, urineColor: 1, dizziness: 1, sleep: -1, calories7d: -150 }
    }
  },

  // ASSUMPTION - simple daily indicator score, to be reviewed against NASA HRP sources.
  // Average of per-indicator points for the latest check-in (0–100).
  score: {
    points: { green: 100, yellow: 60, red: 20 }
  },

  storageKey: 'aura-crew.user-entries.v1'
};
