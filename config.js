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
    }
  },

  // ASSUMPTION - mapping of indicators to body systems is a simplified proxy,
  // to be reviewed against NASA HRP sources. A region's status is the worst
  // status among the indicators it depends on.
  regions: {
    brain: {
      name: 'Brain & mind',
      indicators: ['mood', 'sleep']
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
      // Proxy only: resting heart rate drift can reflect physical
      // deconditioning; sleep supports recovery. No direct bone/muscle
      // indicator is collected in the daily check-in.
      indicators: ['heartRate', 'sleep']
    }
  },

  statusText: {
    green: 'Within range',
    yellow: 'Monitor',
    red: 'Attention',
    unknown: 'No data'
  },

  storageKey: 'aura-crew.user-entries.v1'
};
