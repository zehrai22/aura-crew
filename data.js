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

/*
 * AURA-CREW — educational content (not synthetic data)
 *
 * Hazards follow NASA HRP's "5 Hazards of Human Spaceflight".
 * Wording is deliberately cautious ("may affect"): these are possible
 * influences, not certain cause and effect.
 */
window.AURA_CONTENT = {
  hazardsUrl: 'https://www.nasa.gov/hrp/hazards/',

  hazards: {
    radiation: { name: 'Space radiation', short: 'Radiation' },
    isolation: { name: 'Isolation and confinement', short: 'Isolation' },
    distance: { name: 'Distance from Earth', short: 'Distance' },
    gravity: { name: 'Gravity fields', short: 'Gravity' },
    environment: { name: 'Hostile and closed environments', short: 'Closed environment' }
  },

  regions: {
    brain: {
      what: 'The brain coordinates attention, memory, emotion and the sleep–wake cycle. Daily mood and sleep are simple indicators of how well the mind is coping with mission demands.',
      hazards: [
        { id: 'isolation', why: 'Long periods with a small crew, away from family and friends, may affect mood, motivation and team dynamics.' },
        { id: 'environment', why: 'Noise, artificial light, shifted schedules and elevated CO₂ may affect sleep quality.' },
        { id: 'distance', why: 'Communication delays and limited real-time support from Earth may add stress.' },
        { id: 'radiation', why: 'Radiation exposure over long missions may affect the central nervous system; this is an active research area.' }
      ],
      measure: [
        'Sleep: log hours from your sleep-tracking wearable or sleep diary right after waking. Note wake-ups and naps.',
        'Mood: rate yourself 1–5 at the same time every day, before high-workload tasks. Be honest; the trend matters more than any single score.',
        'In microgravity, sleep in a secured sleeping bag with eye mask and earplugs so readings reflect your normal routine.'
      ],
      actions: {
        green: [
          'Keep a consistent sleep window aligned with the mission timeline.',
          'Protect some personal time and private contact with family or friends this week.'
        ],
        yellow: [
          'Protect a 7–9 hour sleep window tonight: dim lights early, limit screens, use eye mask and earplugs.',
          'Talk with a crewmate you trust or request a private conference with crew support.',
          'Re-check mood and sleep for the next 2–3 days to see whether the trend continues.'
        ],
        red: [
          'Where mission rules allow, defer non-essential high-workload or high-risk tasks until you have been reviewed.',
          'Reach out to crew behavioral health support today.',
          'Tell your commander or a crewmate how you are doing so they can support you.'
        ]
      }
    },

    heart: {
      what: 'The heart and blood vessels move oxygen and nutrients around the body and keep blood pressure stable when you change position or exert yourself.',
      hazards: [
        { id: 'gravity', why: 'Without gravity, body fluids shift toward the head and the heart works less; this may lead to cardiovascular deconditioning and dizziness when returning to gravity.' },
        { id: 'radiation', why: 'Radiation may affect blood vessel health over long missions; this is still being studied.' },
        { id: 'isolation', why: 'Stress and high workload in confinement may raise heart rate and blood pressure.' },
        { id: 'environment', why: 'Cabin CO₂ levels and temperature may affect heart rate and how you feel during exertion.' }
      ],
      measure: [
        'Rest quietly for 5 minutes first. Avoid caffeine and exercise for 30 minutes before measuring.',
        'In microgravity, anchor yourself with foot or thigh restraints and support your arm so the cuff stays at heart level.',
        'Use the cuff on a bare upper arm. Take two readings one minute apart and log the average, at the same time each day.',
        'Resting heart rate: read it from the cuff or your wearable during the same rest period.'
      ],
      actions: {
        green: [
          'Continue your scheduled aerobic and resistance exercise.',
          'Keep following your hydration plan.'
        ],
        yellow: [
          'Repeat the blood pressure measurement later today after 5 minutes of rest.',
          'Review recent caffeine, sodium intake and workload, and note anything unusual.',
          'Keep your exercise protocol, but avoid sudden maximal efforts until the trend is clearer.'
        ],
        red: [
          'Repeat the reading now, following the measurement steps, to confirm it.',
          'Rest and avoid strenuous activity until your medical officer has reviewed the readings.',
          'Note any symptoms such as headache, chest discomfort or dizziness to share with the medical team.'
        ]
      }
    },

    immune: {
      what: 'The immune system defends the body against infection and helps repair tissue. Body temperature and sleep are simple daily signals of how it may be coping.',
      hazards: [
        { id: 'environment', why: 'In a closed habitat with shared air and surfaces, microbes may spread more easily between crew.' },
        { id: 'gravity', why: 'Changes in immune regulation have been observed in flight and may be linked to microgravity.' },
        { id: 'isolation', why: 'Stress and disrupted sleep may dampen immune responses.' },
        { id: 'radiation', why: 'Radiation may affect immune cells over time.' },
        { id: 'distance', why: 'Far from Earth, medical supplies and treatment options are limited, so early indicators matter more.' }
      ],
      measure: [
        'Temperature: use the same thermometer at the same body site (oral, ear or forehead) every morning, before exercise and hot drinks.',
        'Sleep: log hours from your wearable or sleep diary after waking.',
        'Write down any symptoms such as sore throat, rash, cold sores or unusual fatigue for your medical officer.'
      ],
      actions: {
        green: [
          'Keep up hand hygiene and the scheduled surface-cleaning routine.',
          'Keep a regular sleep schedule.'
        ],
        yellow: [
          'Re-check your temperature in 4–6 hours using the same method.',
          'Prioritize rest and hydration today.',
          'Report any new symptoms to your medical officer.'
        ],
        red: [
          'Follow the crew health protocol for limiting close contact until you have been reviewed.',
          'Re-check temperature with the same method to confirm the reading.',
          'Rest, hydrate and keep a written log of symptoms and their timing.'
        ]
      }
    },

    metabolism: {
      what: 'Metabolism turns food into energy and keeps blood sugar and body temperature within a stable range.',
      hazards: [
        { id: 'gravity', why: 'Reduced physical loading and muscle use in microgravity may change how the body handles blood sugar.' },
        { id: 'environment', why: 'A packaged food system with limited fresh food may affect nutrition and energy balance.' },
        { id: 'isolation', why: 'Stress and disrupted sleep may affect appetite and glucose regulation.' },
        { id: 'radiation', why: 'Radiation may affect cellular metabolism; this is still being studied.' }
      ],
      measure: [
        'Measure fasting glucose in the morning, before food or coffee.',
        'Clean and dry the fingertip, use a fresh strip and lancet, and capture the drop carefully. In microgravity, droplets cling to the skin, so touch the strip directly to the drop.',
        'Measure temperature at the same time and with the same method each day.'
      ],
      actions: {
        green: [
          'Keep following the mission diet plan and meal timing.',
          'Keep your exercise schedule, which also supports blood sugar regulation.'
        ],
        yellow: [
          'Re-measure fasting glucose tomorrow morning before eating.',
          'Log meals and snacks for the next 2–3 days to share with your medical officer.',
          'Review meal timing around exercise and sleep.'
        ],
        red: [
          'Re-check now with a fresh strip, following the measurement steps.',
          'Note any symptoms such as shakiness, sweating, thirst or confusion, and tell a crewmate.',
          'Keep your logged readings and meals ready for the medical team.'
        ]
      }
    },

    musculoskeletal: {
      what: 'Bones support the body and store minerals; muscles provide strength and posture. Without weight-bearing activity, both can lose mass. AURA-CREW uses resting heart rate and sleep as proxy indicators, because the daily check-in has no direct bone or muscle measure.',
      hazards: [
        { id: 'gravity', why: 'Microgravity removes most loading from bones and muscles; without countermeasures, bone density and muscle strength may decline over weeks to months.' },
        { id: 'environment', why: 'Limited space and equipment may make it harder to complete a full exercise program.' },
        { id: 'distance', why: 'Far from Earth there is no rehabilitation facility, so maintaining strength in flight matters more.' },
        { id: 'radiation', why: 'Radiation may affect bone cells; this is still being studied.' }
      ],
      measure: [
        'Resting heart rate: measure on waking, before getting out of your sleeping bag, using your wearable or cuff.',
        'Log each exercise session (resistance and aerobic) and whether it was completed in full.',
        'Bone density and muscle strength are assessed by your medical team on their own schedule; AURA-CREW does not measure them.'
      ],
      actions: {
        green: [
          'Complete your daily resistance and aerobic exercise protocol.',
          'Keep a regular sleep schedule to support recovery.'
        ],
        yellow: [
          'Do not skip resistance sessions; they are the main countermeasure for bone and muscle loss.',
          'Prioritize sleep for recovery tonight.',
          'Check resting heart rate again tomorrow morning to see the trend.'
        ],
        red: [
          'Hold strenuous exercise until your medical officer has reviewed the readings.',
          'Note any pain, injury or unusual fatigue.',
          'Keep logging resting heart rate and sleep daily.'
        ]
      }
    }
  }
};
