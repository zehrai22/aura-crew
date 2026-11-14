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
 *
 * These values are decision-support placeholders, not clinical criteria.
 */
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

    // --- Alertness: 1-minute reaction self-test (inspired by the ISS PVT) ---
    // ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources
    reactionMedian: {
      label: 'Reaction time (median)',
      short: 'Reaction time',
      unit: 'ms',
      decimals: 0,
      green: [100, 320],
      yellow: [100, 400],
      optional: true,
      input: { min: 100, max: 3000, step: 1 }
    },
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
      short: 'Resistive 7 d',
      unit: 'min',
      decimals: 0,
      green: [240, 2100],
      yellow: [150, 2100],
      derived: { from: 'resistiveMin', days: 7 },
      input: { min: 0, max: 2100, step: 1 }
    },
    aerobic7d: {
      label: 'Aerobic exercise, 7-day total',
      short: 'Aerobic 7 d',
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
    }
  },

  // Order of indicators on the dashboard, in the score and on the check-in form.
  dashboardIndicators: [
    'systolic', 'diastolic', 'heartRate', 'glucose', 'temperature', 'sleep', 'mood',
    'reactionMedian', 'lapses', 'resistive7d', 'aerobic7d', 'urinaryCalcium', 'boneResorption'
  ],
  formFields: [
    'systolic', 'diastolic', 'heartRate', 'glucose', 'temperature', 'sleep', 'mood',
    'resistiveMin', 'aerobicMin', 'urinaryCalcium', 'boneResorption', 'reactionMedian', 'lapses'
  ],

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

  // ASSUMPTION - mapping of indicators to body systems is a simplified proxy,
  // to be reviewed against NASA HRP sources. A region's status is the worst
  // status among the indicators it depends on.
  regions: {
    brain: {
      name: 'Brain & mind',
      indicators: ['mood', 'sleep', 'reactionMedian', 'lapses']
    },
    heart: {
      name: 'Heart & cardiovascular',
      indicators: ['systolic', 'diastolic', 'heartRate']
    },
    immune: {
      name: 'Immune system',
      indicators: ['temperature', 'sleep']
    },
    metabolism: {
      name: 'Metabolism',
      indicators: ['glucose', 'temperature']
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
      deltas: { resistive7d: -165, aerobic7d: -105, heartRate: 5, systolic: 4, glucose: 8, mood: -1 }
    },
    sleepDeficit: {
      label: 'Sleep deficit',
      detail: 'About 2.5 h less sleep than usual',
      hazard: 'environment',
      deltas: { sleep: -2.5, mood: -1, reactionMedian: 45, lapses: 2, heartRate: 5, glucose: 8, systolic: 4 }
    },
    radiationEvent: {
      label: 'Radiation event',
      detail: 'Solar particle event, crew sheltering in place',
      hazard: 'radiation',
      deltas: { sleep: -1.5, mood: -1, reactionMedian: 20, lapses: 1, heartRate: 4, temperature: 0.3 }
    }
  },

  // ASSUMPTION - simple daily indicator score, to be reviewed against NASA HRP sources.
  // Average of per-indicator points for the latest check-in (0–100).
  score: {
    points: { green: 100, yellow: 60, red: 20 }
  },

  storageKey: 'aura-crew.user-entries.v1'
};
