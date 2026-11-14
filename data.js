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
  // see the "Pinned latest day" lines below for the other indicators.
  var last = history[history.length - 1];
  last.systolic = 134; last.diastolic = 86; last.heartRate = 74;
  last.glucose = 92; last.temperature = 36.8; last.sleep = 7.2; last.mood = 3;

  // ---- Stage 6 indicators (SYNTHETIC) -------------------------------------
  // A separate seeded generator keeps the earlier synthetic values unchanged.
  var rand2 = mulberry32(2027);
  function noise2() { return rand2() + rand2() + rand2() - 1.5; }
  history.forEach(function (e, idx) {
    var t = idx / (DAYS - 1);
    var late = Math.max(0, (t - 0.7) / 0.3);
    var restDay = idx % 7 === 3;                       // one lighter day per week
    e.resistiveMin = restDay ? 0 : Math.max(0, Math.round(55 - 10 * late + noise2() * 6));
    e.aerobicMin = restDay ? 20 : Math.max(0, Math.round(36 - 6 * late + noise2() * 5));
    e.reactionMedian = Math.round(262 + 38 * late + noise2() * 12);
    e.lapses = late > 0.5 ? Math.round(late * 2 + rand2() * 0.8) : (rand2() < 0.15 ? 1 : 0);
  });
  // The short-sleep night mid-month shows up as slower reactions.
  mid.reactionMedian = 352; mid.lapses = 3;
  // Bone markers are periodic samples (not daily): % change vs preflight baseline.
  // Values drift upward over the month, as reported in spaceflight research.
  history[3].urinaryCalcium = 12; history[3].boneResorption = 18;
  history[17].urinaryCalcium = 24; history[17].boneResorption = 31;
  history[DAYS - 2].urinaryCalcium = 27; history[DAYS - 2].boneResorption = 36;
  // Pinned latest day.
  last.resistiveMin = 45; last.aerobicMin = 30; last.reactionMedian = 312; last.lapses = 2;

  // ---- Stage 6b indicators (SYNTHETIC) ------------------------------------
  // Another separate seeded generator, so all earlier synthetic values stay unchanged.
  var rand3 = mulberry32(2028);
  function noise3() { return rand3() + rand3() + rand3() - 1.5; }
  history.forEach(function (e, idx) {
    var t = idx / (DAYS - 1);
    var late = Math.max(0, (t - 0.7) / 0.3);
    e.spo2 = Math.min(100, Math.round(97.6 + noise3() * 0.8));
    e.respRate = Math.round(14 + noise3() * 1.5);
    e.cabinCO2 = Math.round((2500 + 500 * late + noise3() * 250) / 10) * 10;   // ppm, logged from the cabin display
    e.fluidIntake = Math.round((2.5 - 0.35 * late + noise3() * 0.25) * 10) / 10;
    e.urineColor = e.fluidIntake < 2.2 ? 3 : 2;
    e.dizziness = 0;
    e.visionChange = 0;
  });
  history[1].dizziness = 1;                          // a mild episode early in the window
  history[22].visionChange = 1;                      // one "slight" vision-change report
  mid.cabinCO2 = 3800;                               // CO₂ spike on the short-sleep night
  history[6].cabinCO2 = undefined;                   // CO₂ is optional: a few days not logged
  history[19].cabinCO2 = undefined;
  // Pinned latest day.
  last.spo2 = 97; last.respRate = 15; last.cabinCO2 = 2900;
  last.fluidIntake = 2.1; last.urineColor = 3; last.dizziness = 0; last.visionChange = 0;

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

  // `indicators` lists daily check-in indicators each hazard MAY affect.
  // These are possible influences, not certain cause and effect.
  hazards: {
    radiation: {
      name: 'Space radiation', short: 'Radiation',
      summary: 'Beyond the protection of Earth\'s atmosphere and magnetic field, crews receive higher doses of radiation, including from solar particle events.',
      effect: 'Over long missions, radiation may affect the central nervous system, immune cells and blood vessels. Most effects build slowly and are not visible day to day.',
      indicators: ['mood', 'sleep', 'reactionMedian', 'visionChange', 'temperature', 'systolic', 'diastolic', 'boneResorption']
    },
    isolation: {
      name: 'Isolation and confinement', short: 'Isolation',
      summary: 'Crews live and work in a small space with the same few people for months, far from family and friends.',
      effect: 'Isolation and workload may affect mood, sleep and team dynamics, and stress may show up in heart rate, blood pressure and glucose.',
      indicators: ['mood', 'sleep', 'reactionMedian', 'lapses', 'heartRate', 'systolic', 'diastolic', 'glucose']
    },
    distance: {
      name: 'Distance from Earth', short: 'Distance',
      summary: 'The farther from Earth, the longer the communication delay and the less real-time support, medical care and resupply.',
      effect: 'Greater autonomy may add stress that affects mood and sleep. Limited care options make early self-monitoring more important, including for conditions such as kidney stones that would be hard to treat far from Earth.',
      indicators: ['mood', 'sleep', 'lapses', 'fluidIntake', 'urinaryCalcium']
    },
    gravity: {
      name: 'Gravity fields', short: 'Gravity',
      summary: 'Crews move between gravity fields: weightlessness in flight, partial gravity on the Moon or Mars, and full gravity on return to Earth.',
      effect: 'Gravity transitions may affect balance and coordination, and the headward fluid shift may be linked to changes in the eye. Unloading may raise urinary calcium (with a higher kidney stone risk) and bone resorption markers, and may lead to bone and muscle loss, which exercise reduces but does not fully prevent.',
      indicators: ['dizziness', 'visionChange', 'systolic', 'diastolic', 'heartRate', 'glucose', 'urinaryCalcium', 'urineColor', 'resistive7d', 'aerobic7d', 'boneResorption']
    },
    environment: {
      name: 'Hostile and closed environments', short: 'Closed environment',
      summary: 'The spacecraft and spacesuit are closed systems. Oxygen, CO₂, water, noise, lighting, temperature and microbes all need careful control.',
      effect: 'Elevated CO₂ or low oxygen may affect breathing, SpO₂ and alertness, especially during spacewalks. Noise and light may affect sleep and mood, limited water and space may affect hydration and exercise, and shared air may affect exposure to microbes.',
      indicators: ['spo2', 'respRate', 'cabinCO2', 'sleep', 'mood', 'reactionMedian', 'lapses', 'temperature', 'fluidIntake', 'resistive7d']
    }
  },

  regions: {
    nervous: {
      what: 'The nervous system (brain, spinal cord, nerves and the balance organs of the inner ear) coordinates attention, mood, sleep, balance and vision. Daily mood, sleep, a short reaction test and two self-checks for dizziness and vision are simple indicators of how it is coping.',
      selfCheck: 'Dizziness and vision items are self-checks only, not diagnoses. Severe dizziness (3) or a noticeable vision change (2) turns this system red.',
      hazards: [
        { id: 'gravity', why: 'Moving between gravity fields may affect the vestibular (balance) system, causing dizziness, motion sickness or coordination problems. The headward fluid shift may be linked to changes in the eye and brain.' },
        { id: 'isolation', why: 'Long periods with a small crew, away from family and friends, may affect mood, motivation and team dynamics.' },
        { id: 'environment', why: 'Noise, artificial light, shifted schedules and elevated CO₂ may affect sleep quality and alertness.' },
        { id: 'distance', why: 'Communication delays and limited real-time support from Earth may add stress.' },
        { id: 'radiation', why: 'Radiation exposure over long missions may affect the central nervous system; this is an active research area.' }
      ],
      measure: [
        'Sleep: log hours from your sleep-tracking wearable or sleep diary right after waking. Note wake-ups and naps.',
        'Mood: rate yourself 1–5 at the same time every day, before high-workload tasks. Be honest; the trend matters more than any single score.',
        'Alertness: run the 1-minute reaction self-test at the same time each day, in a quiet spot, before caffeine if possible. Brace yourself with a foot restraint and hold the device steady.',
        'Dizziness / balance: rate 0–3 for the past 24 hours, including motion sickness, spinning or trouble coordinating movements.',
        'Vision: cover one eye at a time and read the same text card at the same distance each day. Rate 0 (no change), 1 (slight) or 2 (noticeable blur or change).'
      ],
      alertness: 'Low alertness can signal fatigue; consider rest and contact your flight surgeon.',
      research: [
        'NASA lists altered sensorimotor and vestibular function, such as dizziness, motion sickness and coordination problems, among the risks of spaceflight.',
        'NASA also lists spaceflight-associated neuro-ocular syndrome (SANS): changes in eye and brain structure seen in some crew members on long missions.',
        'The reaction self-test is inspired by the psychomotor vigilance test (PVT). NASA\'s Reaction Self Test on the ISS used a brief 3-minute PVT to help astronauts track their alertness, and studies of ISS crews have reported slower psychomotor speed on days with 6 hours of sleep or less.',
        'The in-app test lasts 1 minute and is not a validated clinical test. Use it to watch your own trend over days, not as a single score.'
      ],
      actions: {
        green: [
          'Keep a consistent sleep window aligned with the mission timeline.',
          'Keep doing the daily vision and balance self-checks so changes are noticed early.'
        ],
        yellow: [
          'Protect a 7–9 hour sleep window tonight: dim lights early, limit screens, use eye mask and earplugs.',
          'If you notice dizziness, move your head slowly and avoid tasks that need fine coordination until it settles.',
          'Re-check mood, sleep, the reaction test and the self-checks over the next 2–3 days, and tell your medical officer about any vision change.'
        ],
        red: [
          'Where mission rules allow, stop tasks that need balance, fine coordination or clear vision until you have been reviewed.',
          'Report the symptom, when it started and what you were doing to your medical officer.',
          'Tell your commander or a crewmate so they can support you.'
        ]
      }
    },

    respiratory: {
      what: 'The lungs and airways bring oxygen into the blood and remove carbon dioxide. Blood oxygen saturation (SpO₂) and resting breathing rate are simple daily indicators, and cabin CO₂ describes the air you are breathing.',
      research: [
        'NASA lists hypoxia among the risks of spaceflight, including exposure to low oxygen and high CO₂ during spacewalks.',
        'Cabin CO₂ on spacecraft is usually higher than on Earth. Elevated CO₂ may be linked to headaches and reduced alertness in some crew members.'
      ],
      hazards: [
        { id: 'environment', why: 'The cabin and spacesuit are closed environments: oxygen and CO₂ depend on life-support systems, and CO₂ may build up where air does not circulate well.' },
        { id: 'distance', why: 'Far from Earth, a quick return may not be possible, so life-support problems may need to be handled on board.' },
        { id: 'gravity', why: 'Without convection in microgravity, exhaled CO₂ may pool around your face in still air, for example while sleeping.' },
        { id: 'radiation', why: 'Radiation may affect lung tissue over long missions; this is still being studied.' }
      ],
      measure: [
        'SpO₂: sit still for 2 minutes, warm your hands, place the pulse oximeter on a fingertip without nail polish and wait for a stable reading.',
        'Respiratory rate: count breaths for 60 seconds while at rest, or read it from your wearable. Avoid measuring right after exercise or talking.',
        'Cabin CO₂ (optional): note the reading from the cabin environment display for your module at the time of your check-in.',
        'In your sleep station, make sure the fan or ventilation is on so exhaled CO₂ does not collect around your head.'
      ],
      actions: {
        green: [
          'Keep your sleep station and work area ventilated.',
          'Keep following the cabin air quality procedures for your vehicle.'
        ],
        yellow: [
          'Re-check SpO₂ and breathing rate after 10 minutes of rest.',
          'Check ventilation in your area and move to a better-ventilated module if CO₂ is elevated.',
          'Note any headache, shortness of breath or unusual fatigue for your medical officer.'
        ],
        red: [
          'Stop strenuous activity and rest in a well-ventilated area, then repeat the measurement.',
          'Follow your vehicle\'s air quality and oxygen procedures and inform the crew.',
          'Share the readings and any symptoms with your medical officer right away.'
        ]
      }
    },

    renal: {
      what: 'The kidneys filter the blood, balance fluids and minerals, and remove waste as urine. Daily fluid intake and urine color are simple hydration indicators, and urinary calcium (shared with bones & muscle) relates to kidney stone risk.',
      research: [
        'NASA research reports increased urinary calcium during spaceflight, as calcium released from unloaded bone is excreted by the kidneys.',
        'NASA lists kidney stone formation as a risk on long missions, where a stone would be hard to treat far from Earth.',
        'Adequate fluid intake is a common countermeasure: more urine dilutes the minerals that can form stones.'
      ],
      hazards: [
        { id: 'gravity', why: 'Bone unloading may raise urinary calcium, and fluid shifts may change thirst and urine output, which may raise kidney stone risk.' },
        { id: 'distance', why: 'Far from Earth, a kidney stone would be difficult to treat, so prevention and early indicators matter more.' },
        { id: 'environment', why: 'Recycled water supplies, a packaged diet and a busy schedule may make it harder to drink enough.' }
      ],
      measure: [
        'Fluid intake: add up the liters from drink bags and food rehydration for the day. Most crews log this from their drink bag count.',
        'Urine color: compare with the color card in your hygiene kit (1 = pale, 5 = amber), using the first sample after waking.',
        'Urinary calcium (optional): enter the % change versus preflight only when your medical team shares a new result from a scheduled urine sample. It is the same value used by bones & muscle.'
      ],
      actions: {
        green: [
          'Keep drinking regularly through the day, not only at meals.',
          'Keep following the mission diet plan for sodium and protein.'
        ],
        yellow: [
          'Aim to drink an extra 0.5–1 L today, spread through the day.',
          'Check urine color again tomorrow morning.',
          'If urinary calcium is rising, ask your medical team about fluid and diet targets.'
        ],
        red: [
          'Increase fluid intake now, as your medical plan allows.',
          'Report any flank or back pain, blood in urine or pain when urinating to your medical officer right away.',
          'Share your fluid log and readings with the medical team.'
        ]
      }
    },

    heart: {
      what: 'The cardiovascular system, the heart and blood vessels, moves oxygen and nutrients around the body and keep blood pressure stable when you change position or exert yourself.',
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
      what: 'Bones support the body and store minerals such as calcium; muscles provide strength and posture. Without weight-bearing activity, both can lose mass. AURA-CREW tracks the main countermeasure, exercise, as 7-day totals, plus two optional bone markers when they are available.',
      research: [
        'NASA research reports that urinary calcium and bone resorption (breakdown) markers rise during spaceflight, while bone formation markers stay unchanged or fall. This imbalance may lead to bone loss over a mission.',
        'Exercise countermeasures, such as resistive and aerobic exercise on the ISS, reduce but do not fully prevent muscle and bone loss.',
        'These markers are not measured daily in flight. They come from periodic urine or blood samples, so the two marker fields in the check-in are optional. When provided, the most recent value (up to 30 days old) is used for status.'
      ],
      hazards: [
        { id: 'gravity', why: 'Microgravity removes most loading from bones and muscles; without countermeasures, bone density and muscle strength may decline over weeks to months.' },
        { id: 'environment', why: 'Limited space and equipment may make it harder to complete a full exercise program.' },
        { id: 'distance', why: 'Far from Earth there is no rehabilitation facility, so maintaining strength in flight matters more.' },
        { id: 'radiation', why: 'Radiation may affect bone cells; this is still being studied.' }
      ],
      measure: [
        'Exercise: log the minutes of resistive (e.g. advanced resistive exercise device) and aerobic (treadmill with harness, cycle ergometer) exercise you completed today. Count only time under load, not setup.',
        'AURA-CREW adds up the last 7 days, including today, so a single rest day does not change the status much.',
        'Urinary calcium and bone resorption markers: enter the % change versus your preflight baseline only when your medical team shares a new result from a scheduled urine or blood sample.',
        'Bone density and muscle strength scans are done by your medical team on their own schedule; AURA-CREW does not measure them.'
      ],
      actions: {
        green: [
          'Keep completing your daily resistive and aerobic exercise protocol.',
          'Keep following the mission diet plan, including calcium and vitamin D as prescribed.'
        ],
        yellow: [
          'Plan to make up missed resistive sessions this week; resistive loading is the main countermeasure for bone and muscle.',
          'Review your exercise schedule with your fitness or medical team if workload is crowding it out.',
          'If bone markers are rising, ask your medical team when the next sample is planned.'
        ],
        red: [
          'Share your exercise log and any marker results with your medical officer.',
          'Do not try to catch up with a single maximal session; follow the protocol your team sets.',
          'Note any pain, injury or unusual fatigue.'
        ]
      }
    }
  }
};
