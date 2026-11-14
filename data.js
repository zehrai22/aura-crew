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

  // ---- Stage 8 indicators (SYNTHETIC) -------------------------------------
  // Another separate seeded generator, so all earlier synthetic values stay unchanged.
  var rand4 = mulberry32(2029);
  function noise4() { return rand4() + rand4() + rand4() - 1.5; }
  history.forEach(function (e, idx) {
    var t = idx / (DAYS - 1);
    var late = Math.max(0, (t - 0.55) / 0.45);       // slow drift over the second half
    e.calories = Math.round((2700 - 260 * late + noise4() * 110) / 10) * 10;
    // Body mass from the mass-measurement device, every other day (not a daily scale).
    var mass = 72.4 - 0.03 * idx - 1.5 * late * late + noise4() * 0.12;
    if ((DAYS - 1 - idx) % 2 === 0) e.bodyMass = Math.round(mass * 10) / 10;
  });

  // ---- Stage 6c: working-memory test (SYNTHETIC) ---------------------------
  // Another separate seeded generator, so all earlier synthetic values stay unchanged.
  var rand5 = mulberry32(2030);
  function noise5() { return rand5() + rand5() + rand5() - 1.5; }
  history.forEach(function (e, idx) {
    var t = idx / (DAYS - 1);
    var late = Math.max(0, (t - 0.7) / 0.3);
    e.memSpan = Math.max(3, Math.round(7.2 - 1.3 * late + noise5() * 0.6));
    e.memAccuracy = Math.min(100, Math.round(88 - 14 * late + noise5() * 4));
  });
  // First 3 completed tests form the personal baseline.
  history[0].memSpan = 7; history[0].memAccuracy = 90;
  history[1].memSpan = 7; history[1].memAccuracy = 86;
  history[2].memSpan = 8; history[2].memAccuracy = 88;
  mid.memSpan = 5; mid.memAccuracy = 67;            // the short-sleep night
  // Last 3 tests: working memory below the personal baseline (demo of the "monitor" note).
  history[DAYS - 3].memSpan = 6; history[DAYS - 3].memAccuracy = 76;
  history[DAYS - 2].memSpan = 6; history[DAYS - 2].memAccuracy = 72;
  last.memSpan = 5; last.memAccuracy = 70;

  window.AURA_SYNTHETIC_HISTORY = history;
  // SYNTHETIC demo profile (height only, used for BMI). A height you enter replaces it.
  window.AURA_SYNTHETIC_PROFILE = { height: 175, source: 'synthetic' };
})();

/*
 * AURA-CREW — guidance content (not synthetic data)
 *
 * Short, plain guidance for each body system. Wording is deliberately
 * cautious ("may", "consider"): possible influences, not cause and effect,
 * and never a diagnosis. Hazards follow NASA HRP's "5 Hazards of Human Spaceflight".
 */
window.AURA_CONTENT = {
  hazardsUrl: 'https://www.nasa.gov/hrp/hazards/',

  // `indicators`: daily indicators each hazard MAY affect (used for the legend tooltips and highlights).
  hazards: {
    radiation: { name: 'Space radiation', short: 'Radiation',
      summary: 'Higher radiation beyond Earth\'s protection may affect the nervous system, immune cells and blood vessels over time.',
      indicators: ['mood', 'sleep', 'perfReaction', 'perfMemory', 'visionChange', 'temperature', 'systolic', 'diastolic', 'boneResorption'] },
    isolation: { name: 'Isolation and confinement', short: 'Isolation',
      summary: 'Months with a small crew in a small space may affect mood, sleep, stress and task performance.',
      indicators: ['mood', 'sleep', 'perfReaction', 'perfMemory', 'lapses', 'heartRate', 'systolic', 'diastolic', 'glucose', 'calories7d'] },
    distance: { name: 'Distance from Earth', short: 'Distance',
      summary: 'Communication delays and limited care and resupply make early self-monitoring more important.',
      indicators: ['mood', 'sleep', 'lapses', 'fluidIntake', 'calories7d', 'urinaryCalcium'] },
    gravity: { name: 'Gravity fields', short: 'Gravity',
      summary: 'Weightlessness and gravity transitions may affect balance, vision, fluids, bone and muscle.',
      indicators: ['dizziness', 'visionChange', 'systolic', 'diastolic', 'heartRate', 'glucose', 'massChange7d', 'urinaryCalcium', 'urineColor', 'resistive7d', 'aerobic7d', 'boneResorption'] },
    environment: { name: 'Hostile and closed environments', short: 'Closed environment',
      summary: 'Cabin air, CO₂, noise, light, water and microbes all depend on life support and may affect the crew.',
      indicators: ['spo2', 'respRate', 'cabinCO2', 'sleep', 'mood', 'perfReaction', 'perfMemory', 'lapses', 'temperature', 'fluidIntake', 'calories7d', 'resistive7d'] }
  },

  // Actions for groups of related indicators. Used by Today's action plan and by
  // "What to do now" in each panel. Each group appears once, under its most severe system.
  plan: {
    groups: {
      rest: { indicators: ['sleep', 'mood'], reason: 'may reduce alertness',
        actions: { yellow: 'Consider a 7–9 h sleep window tonight.', red: 'Consider resting tonight and deferring high-risk tasks.' } },
      alertness: { indicators: ['perfReaction', 'perfMemory', 'lapses'], reason: 'may signal reduced task performance or fatigue',
        actions: { yellow: 'Consider a short rest and repeating the cognitive check tomorrow.', red: 'Task performance may be reduced. Consider rest and contact your flight surgeon.' } },
      balance: { indicators: ['dizziness'], reason: 'may affect coordination and safety',
        actions: { yellow: 'Consider slow head movements and avoiding fine-coordination tasks.', red: 'Consider stopping tasks that need balance until reviewed.' } },
      vision: { indicators: ['visionChange'], reason: 'may affect tasks that need clear vision',
        actions: { yellow: 'Consider repeating the vision card check tomorrow.', red: 'Consider pausing tasks that need clear vision until reviewed.' } },
      bloodPressure: { indicators: ['systolic', 'diastolic'], reason: 'may add strain on the cardiovascular system',
        actions: { yellow: 'Consider repeating the reading after 5 minutes of rest.', red: 'Consider resting and repeating the reading now.' } },
      heartRate: { indicators: ['heartRate'], reason: 'may add strain on the cardiovascular system',
        actions: { yellow: 'Consider re-checking heart rate after 5 quiet minutes.', red: 'Consider resting and avoiding strenuous activity.' } },
      oxygen: { indicators: ['spo2', 'respRate'], reason: 'may reduce oxygen delivery',
        actions: { yellow: 'Consider re-checking SpO₂ after 10 minutes of rest.', red: 'Consider stopping exertion and moving to a well-ventilated area.' } },
      co2: { indicators: ['cabinCO2'], reason: 'may cause headaches and reduce alertness',
        actions: { yellow: 'Consider working in a better-ventilated module.', red: 'Consider following air quality procedures and telling the crew.' } },
      hydration: { indicators: ['fluidIntake', 'urineColor'], reason: 'may raise kidney stone risk',
        actions: { yellow: 'Consider drinking an extra 0.5–1 L today.', red: 'Consider increasing fluids now, as your plan allows.' } },
      calcium: { indicators: ['urinaryCalcium'], reason: 'may raise kidney stone risk and reflect bone loss',
        actions: { yellow: 'Consider asking about fluid and diet targets.', red: 'Consider sharing the result and your fluid log with your medical officer.' } },
      boneMarker: { indicators: ['boneResorption'], reason: 'may reflect faster bone loss',
        actions: { yellow: 'Consider asking when the next bone sample is planned.', red: 'Consider reviewing exercise and diet with your medical officer.' } },
      exercise: { indicators: ['resistive7d', 'aerobic7d'], reason: 'may speed up bone and muscle loss',
        actions: { yellow: 'Consider making up resistive sessions this week.', red: 'Consider reviewing your exercise schedule today.' } },
      bodyMass: { indicators: ['massChange7d'], reason: 'may reflect an energy deficit or muscle loss',
        actions: { yellow: 'Consider adding planned snacks and re-measuring in a few days.', red: 'Consider sharing your body mass and food log with your medical officer.' } },
      calories: { indicators: ['calories7d'], reason: 'may not cover your energy needs',
        actions: { yellow: 'Consider adding planned snacks today.', red: 'Consider asking the nutrition team to review your intake.' } },
      temperature: { indicators: ['temperature'], reason: 'may signal an immune response',
        actions: { yellow: 'Consider re-checking temperature in 4–6 hours.', red: 'Consider resting and limiting close contact per protocol.' } },
      glucose: { indicators: ['glucose'], reason: 'may affect energy and blood sugar control',
        actions: { yellow: 'Consider re-measuring fasting glucose tomorrow.', red: 'Consider re-checking glucose now with a fresh strip.' } }
    }
  },

  trendAdvice: {
    systolic: 'Consider reviewing sleep, fluid intake and workload',
    diastolic: 'Consider reviewing sleep, fluid intake and workload',
    heartRate: 'Consider reviewing sleep, stress and your exercise recovery',
    spo2: 'Consider checking the ventilation where you sleep and work',
    respRate: 'Consider checking ventilation and how rested you are',
    cabinCO2: 'Consider asking the crew to review cabin ventilation',
    glucose: 'Consider reviewing meal timing and exercise',
    temperature: 'Consider prioritizing rest and hydration',
    sleep: 'Consider protecting your sleep window and reviewing your schedule',
    mood: 'Consider talking with a crewmate or crew support',
    reactionMedian: 'Consider reviewing sleep and workload',
    lapses: 'Consider reviewing sleep and workload',
    perfReaction: 'Consider reviewing sleep and workload',
    perfMemory: 'Consider reviewing sleep, workload and distractions during the test',
    memAccuracy: 'Consider reviewing sleep and workload',
    memSpan: 'Consider reviewing sleep and workload',
    fluidIntake: 'Consider setting drink reminders through the day',
    urinaryCalcium: 'Consider reviewing fluid intake and your exercise schedule',
    boneResorption: 'Consider reviewing your exercise schedule',
    resistive7d: 'Consider planning your resistive sessions earlier in the day',
    aerobic7d: 'Consider planning your aerobic sessions earlier in the day',
    massChange7d: 'Consider reviewing food intake and appetite',
    calories7d: 'Consider reviewing appetite, meal timing and food preferences'
  },

  // Per body system:
  //   now        : 2 short actions per status (used to fill "What to do now")
  //   contactKeys: indicators whose red limits form the flight-surgeon trigger
  //   contact    : one symptom-based trigger
  //   measure    : 2–3 short steps
  //   why        : at most 2 short sentences (collapsed)
  //   hazards    : possible contributing hazards (tags)
  regions: {
    nervous: {
      now: {
        green: ['Keep your usual sleep window.', 'Keep doing the daily balance and vision self-checks.'],
        yellow: ['Consider a 7–9 h sleep window tonight.', 'Consider repeating the cognitive check tomorrow.'],
        red: ['Consider stopping tasks that need balance, clear vision or fast reactions.', 'Tell a crewmate how you feel.']
      },
      contactKeys: ['dizziness', 'visionChange', 'perfReaction', 'perfMemory'],
      contact: 'You have a sudden severe headache, confusion or loss of vision.',
      measure: [
        'Rate sleep, mood, dizziness and vision right after waking.',
        'Run the 2-minute cognitive check at the same time each day, braced with a foot restraint.'
      ],
      why: 'Gravity changes may affect balance and vision. Isolation, noise and short sleep may lower mood and alertness.',
      hazards: ['gravity', 'isolation', 'environment', 'distance', 'radiation'],
      alertness: 'Low alertness can signal fatigue; consider rest and contact your flight surgeon.',
      performance: {
        yellow: 'Task performance may be slightly reduced compared with your own baseline. Consider rest and repeating the check tomorrow.',
        red: 'Task performance may be reduced. Consider rest and contact your flight surgeon.',
        about: 'A performance check against your own baseline, not an IQ test.'
      }
    },
    heart: {
      now: {
        green: ['Keep your scheduled aerobic and resistive exercise.', 'Keep to your hydration plan.'],
        yellow: ['Consider repeating the reading after 5 minutes of rest.', 'Consider less caffeine and a lighter workload today.'],
        red: ['Consider resting and repeating the reading now.', 'Consider avoiding strenuous activity until reviewed.']
      },
      contactKeys: ['systolic', 'diastolic', 'heartRate'],
      contact: 'You have chest pain, fainting or a racing heartbeat at rest.',
      measure: [
        'Rest 5 minutes; no caffeine or exercise for 30 minutes before.',
        'Anchor your feet and support your arm at heart level.',
        'Take two readings 1 minute apart and log the average.'
      ],
      why: 'Without gravity, fluids shift toward the head and the heart may decondition. Stress and workload may raise blood pressure.',
      hazards: ['gravity', 'isolation', 'environment', 'radiation']
    },
    respiratory: {
      now: {
        green: ['Keep your sleep station ventilated.', 'Keep following cabin air procedures.'],
        yellow: ['Consider re-checking after 10 minutes of rest.', 'Consider moving to a better-ventilated module.'],
        red: ['Consider stopping exertion and moving to a well-ventilated area.', 'Tell the crew and follow air quality procedures.']
      },
      contactKeys: ['spo2', 'respRate', 'cabinCO2'],
      contact: 'You are short of breath, confused or have a severe headache.',
      measure: [
        'Sit still 2 minutes, then read SpO₂ on a warm fingertip.',
        'Count breaths for 60 seconds at rest.',
        'Optional: note cabin CO₂ from the module display.'
      ],
      why: 'Cabins and spacesuits depend on life support, so oxygen may drop or CO₂ may build up. NASA lists hypoxia, including low oxygen and high CO₂ on spacewalks, among spaceflight risks.',
      hazards: ['environment', 'distance', 'gravity']
    },
    renal: {
      now: {
        green: ['Keep drinking through the day, not only at meals.', 'Keep to the diet plan for salt and protein.'],
        yellow: ['Consider drinking an extra 0.5–1 L today.', 'Consider checking urine color again tomorrow morning.'],
        red: ['Consider increasing fluids now, as your plan allows.', 'Consider sharing your fluid log with the medical team.']
      },
      contactKeys: ['fluidIntake', 'urineColor', 'urinaryCalcium'],
      contact: 'You have flank or back pain, blood in urine or pain when urinating.',
      measure: [
        'Add up drink bags and rehydrated food for the day, in liters.',
        'Compare first-morning urine with the color card (1 = pale, 5 = amber).'
      ],
      why: 'Urinary calcium rises in flight as bone is unloaded, which may raise kidney stone risk on long missions. Drinking enough is a common countermeasure.',
      hazards: ['gravity', 'distance', 'environment']
    },
    immune: {
      now: {
        green: ['Keep up hand hygiene and surface cleaning.', 'Keep a regular sleep schedule.'],
        yellow: ['Consider re-checking temperature in 4–6 hours.', 'Consider extra rest and fluids today.'],
        red: ['Consider limiting close contact per crew protocol.', 'Consider resting and logging your symptoms.']
      },
      contactKeys: ['temperature', 'sleep'],
      contact: 'You have fever with chills, a new rash, or feel unwell for more than a day.',
      measure: [
        'Same thermometer, same body site, each morning before exercise.',
        'Log sleep hours right after waking.'
      ],
      why: 'Shared air and surfaces may spread microbes. Stress and short sleep may weaken immune responses.',
      hazards: ['environment', 'isolation', 'gravity', 'radiation', 'distance']
    },
    metabolism: {
      now: {
        green: ['Keep to your meal plan.', 'Keep your exercise schedule.'],
        yellow: ['Consider adding planned snacks today.', 'Consider logging all meals for 3 days.'],
        red: ['Consider re-checking glucose now with a fresh strip.', 'Consider sharing your food log and body mass with the medical team.']
      },
      contactKeys: ['glucose', 'massChange7d', 'calories7d'],
      contact: 'You feel shaky, confused or very weak.',
      measure: [
        'Fasting glucose in the morning; touch the strip to the drop.',
        'Body mass on the mass-measurement device, same clothing, before breakfast.',
        'Add up the kcal on the food packages you ate today.'
      ],
      why: 'Packaged food and stress may reduce appetite; NASA lists inadequate food and nutrition among spaceflight risks. In microgravity, body mass is measured with a special device, not a scale.',
      hazards: ['environment', 'distance', 'gravity', 'isolation']
    },
    musculoskeletal: {
      now: {
        green: ['Keep your daily resistive and aerobic exercise.', 'Keep calcium and vitamin D as prescribed.'],
        yellow: ['Consider making up missed resistive sessions this week.', 'Consider reviewing your schedule with your fitness team.'],
        red: ['Consider sharing your exercise log with your medical officer.', 'Consider not catching up with one maximal session.']
      },
      contactKeys: ['resistive7d', 'aerobic7d', 'boneResorption'],
      contact: 'You have new bone or joint pain, or an injury.',
      measure: [
        'Log minutes under load for resistive and aerobic exercise.',
        'Enter bone markers only when the medical team shares a new result.'
      ],
      why: 'Unloaded bones release calcium, so urinary calcium and bone breakdown markers may rise. Exercise reduces but does not fully prevent bone and muscle loss.',
      hazards: ['gravity', 'environment', 'distance', 'radiation']
    }
  }
};
