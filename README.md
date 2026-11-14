# AURA-CREW

**Crew health indicators and decision support for astronauts.** Built for the NASA Space Apps 2026 challenge *"Create Health Monitoring Software for Astronauts on Space Missions"*.

An astronaut records a short daily check-in. AURA-CREW tells them what to do now, when to contact their flight surgeon, and which body systems may need attention, on an interactive body figure. The app focuses on guidance; background explanations are kept short and collapsed.

> **Decision support only.** AURA-CREW shows *indicators*. It does not diagnose. Always confirm with your medical officer or flight surgeon.
>
> **Synthetic demo data.** The 30-day history in `data.js` is made up. It is not real astronaut or patient data, and the UI labels it with a "Synthetic demo data" badge.

## Features

- **Today's action plan** (the main decision-support card, at the top of the dashboard). It collects actions from all seven body systems and ranks them: red before yellow, then by the most severe system. It shows the top 3 as a numbered list.
  - Actions are grouped by related indicators (for example rest = sleep + mood, hydration = fluid intake + urine color), so a shared indicator such as sleep produces one action, not two.
  - Each action has a one-line reason that names the indicators behind it, such as "Sleep 4.5 h and mood 2/5 may reduce alertness", plus a status dot and the body system it belongs to. Tapping an action opens that system's panel.
  - If any system is red, a red "Contact your flight surgeon" banner lists the indicators outside the monitor range and their systems.
  - If everything is within range, the card says "No action needed today. Keep your routine." and suggests the next check-in.
  - The card updates live with new check-ins and with the what-if toggles, and is marked "Simulated" while a scenario is on.
  - It also adds one **trend watch** line (see below) for the strongest unfavorable 14-day trend, for example "Body mass has been falling for 14 days. Consider reviewing food intake and appetite, and mention it at your next medical check."
  - Actions use "consider" and "may" wording, and the card ends with "Decision support only, confirm with your medical officer." The action texts and reasons are in `data.js` (`AURA_CONTENT.plan`).
- **Trend watch (early-warning signal, not a diagnosis).** For every numeric indicator, AURA-CREW fits a simple straight line to the recorded values of the last 14 days.
  - Every indicator in the list shows its 14-day arrow (↗ rising, ↘ falling, → steady).
  - When an indicator's latest value is still within range, but the line moves steadily in an unfavorable direction, the app does three things. It marks the indicator "Trend watch", adds a small ◇ TREND badge to its body system on the figure and in the system list, and lists it in that system's panel.
  - Self-rated scales (dizziness, vision, urine color) are not trended.
- **Daily check-in** with blood pressure (systolic and diastolic), resting heart rate, SpO₂, respiratory rate, blood glucose (mg/dL), body temperature, sleep hours, mood (1–5), dizziness/balance (0–3) and vision change (0–2) self-checks, fluid intake (L), urine color (1–5), calorie intake (kcal) and minutes of resistive and aerobic exercise. Optional fields cover body mass (kg), cabin CO₂ (ppm), two bone and kidney markers, and the cognitive check results. A one-time profile stores height (cm), used only to show BMI. A new entry updates the whole app right away. Entries are kept in your browser's `localStorage`, and an entry for a date replaces the synthetic entry for that date.
- **Interactive 2D body figure** with seven clickable, labeled systems: nervous system, cardiovascular, respiratory, urinary and renal, bones and muscle, immune system, and metabolism. Each one turns green (within range), yellow (monitor) or red (attention) based on the latest indicators it depends on. The overall status is shown alongside.
- **Region panel** for each system, in guidance order. Every text is 1–2 short sentences, and "Decision support only, confirm with your medical officer." appears once per panel.
  1. **Status:** the status, the indicator values with reference and 14-day trend arrow, and one-line notes (trend watch, cognitive-check note, BMI).
  2. **What to do now:** 2 short, concrete actions. These are indicator-specific actions for anything flagged first, then the system's own actions for its status.
  3. **When to contact your flight surgeon:** 1–2 clear triggers. The first is generated from the red ("attention") limits in `config.js`; the second is a symptom trigger. When the system is red, a red "Now: contact your flight surgeon" line names the indicators outside the monitor range.
  4. **30-day trend:** charts with reference bands, a hover tooltip and a data table.
  5. **How to measure:** 2–3 short steps (the nervous system panel also has the cognitive check button).
  6. **Possible contributing hazards:** small tags (radiation, isolation, distance, gravity, closed environment).
  7. **Why this may happen:** a collapsed section with at most 2 short sentences.

- **Bones & muscle indicators.** The status uses 7-day totals of resistive and aerobic exercise minutes (the main in-flight countermeasure). It also uses two optional bone markers when provided: urinary calcium change and bone resorption marker change, each as % versus the preflight baseline. These markers come from periodic samples, not daily ones, so the most recent value from the last 30 days is used for status, and the charts show only the days they were measured. A 7-day total appears once the log covers a full 7 days. The panel's short "Why" note says these markers may rise in flight and that exercise reduces but does not fully prevent bone and muscle loss.
- **Metabolism indicators.** The status uses fasting glucose, body mass and calorie intake.
  - **Body mass:** the status uses the % change over 7 days. A drop of more than 3% is "monitor" and more than 5% is "attention". The change versus your own first recorded value is shown alongside.
  - **Calorie intake:** the status compares the 7-day average with a target in `config.js`.
  - **Body mass entry:** body mass is optional, entered on days it is measured, and the latest 7-day change is reused for up to 7 days.
  - **BMI:** shown in the panel from the profile height, for reference only; it is not a daily indicator.
  - **Panel text:** it notes that NASA lists inadequate food and nutrition among spaceflight risks, and that in microgravity body mass is measured with special devices, not a normal scale.
- **Respiratory indicators.** SpO₂, resting respiratory rate and optional cabin CO₂ (read from the cabin display). The panel links them to the hostile and closed environments hazard and notes that NASA lists hypoxia, including exposure to low oxygen and high CO₂ during spacewalks, among spaceflight risks.
- **Urinary & renal indicators.** Daily fluid intake, urine color (1 = pale, 5 = amber) and the optional urinary calcium change, which is shared with bones & muscle. The panel explains that urinary calcium increases during flight, that kidney stones are a risk on long missions, and that adequate fluid intake is a common countermeasure.
- **Nervous system** (formerly "Brain & mind"). Mood, sleep and the 2-minute cognitive check, plus two self-checks: dizziness/balance problems (0 none, 1 mild, 2 moderate, 3 severe) and vision change (0 none, 1 slight, 2 noticeable). The panel notes that NASA lists altered sensorimotor and vestibular function (dizziness, motion sickness, coordination problems) and spaceflight-associated neuro-ocular syndrome (SANS, changes in eye and brain structure) among spaceflight risks. Severe dizziness (3) or a noticeable vision change (2) turns the system red with the flight-surgeon note. These are self-checks only, not diagnoses.
- **Cognitive check** (2 minutes) for the nervous system. It is a performance check compared with the astronaut's own baseline, not an IQ test and not a validated clinical test.
  - **Part 1, reaction (1 min):** inspired by the psychomotor vigilance test (PVT) used on the ISS. After a random 2–6 s wait the circle lights up, and you tap it or press Space. It records the median reaction time (ms) and lapses (responses over 500 ms; no response within 3 s also counts as a lapse). It ignores false starts and needs at least 5 responses.
  - **Part 2, working memory (1 min):** digits appear one at a time, and you type the sequence back. Each correct answer makes the next sequence one digit longer, and each miss makes it one shorter (3 to 12 digits). It records accuracy (% of sequences correct) and the longest correct sequence, and needs at least 3 sequences. Part 2 is optional; the reaction result can be added on its own.
  - **Personal baseline:** both parts are compared with the astronaut's **own baseline**, the average of their first 3 completed checks, not with population norms. "Reaction vs baseline" and "Memory vs baseline" compare the average of the last 3 checks with that baseline; memory uses the larger drop of accuracy and longest sequence. A drop of more than 15% shows a yellow note. A drop of more than 30% shows a red note: "Task performance may be reduced. Consider rest and contact your flight surgeon." A result still counts for status for 7 days without a new check.
  - **Lapses:** these keep their own count-based limit. Above it, the app shows "Low alertness can signal fatigue; consider rest and contact your flight surgeon."
  - **Where results appear:** in the check-in, the nervous system status, the score, the action plan and trend watch. The panel charts the baseline comparisons plus raw reaction time, memory accuracy and longest sequence.
- **Hazard legend.** A compact strip of the five NASA HRP hazards under the body figure ("Possible contributing hazards"). Hovering a tag shows a one-line summary and the indicators it *may affect*. Selecting a tag highlights the body systems it may affect and dims the others.

- **What-if scenarios.** Four toggles (skip exercise, sleep deficit, radiation event, spacewalk day) apply illustrative offsets to the latest check-in, including exercise totals, reaction results, breathing, hydration and cabin CO₂, so you can see how indicators and body-system status may shift. A "Simulation · not real data" banner appears while any toggle is on. Nothing is saved, and the trend charts always show recorded data.
- **Indicator score and streak.** A 0–100 daily indicator score (the average of per-indicator points: within range 100, monitor 60, attention 20) with its 7-day average, plus a check-in streak counting consecutive logged days up to today.

## Roadmap (planned, not implemented)

1. **Wearable sensor input.** Automatic readings from wearables such as the Canadian Space Agency's Bio-Monitor smart shirt (heart rate, ECG, breathing, skin temperature, oxygen saturation, activity).
2. **Lab marker inputs.** Optional results from onboard or ground analysis.
3. **Commander and flight surgeon views.** Role-based views with privacy controls.
4. **Threshold validation.** Review of all thresholds with space medicine experts.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `style.css` | Holographic HUD styling, responsive layout, animations |
| `app.js` | Status logic, today's action plan, trend watch, profile/BMI, derived indicators (7-day totals, marker carry-forward, personal baselines), SVG body figure, check-in form, region panel, cognitive check (reaction + working memory) |
| `config.js` | **All thresholds**, the indicator-to-system mapping, cognitive check timing and baseline settings, what-if offsets and score points (each marked *ASSUMPTION*) |
| `data.js` | 30 days of **synthetic** demo history (seeded and reproducible), plus the panel text and hazard content |

There is no build step, no backend and no dependencies.

## Run locally

Open `index.html` in a browser. To use a local server instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy on GitHub Pages

1. Push the files to the default branch of a GitHub repository (the files must sit at the repository root).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then choose your branch and the `/ (root)` folder. Click **Save**.
4. After a minute or so, the site is live at `https://<user>.github.io/<repo>/`.

## Reference ranges

Every threshold lives in `config.js` under the comment
`ASSUMPTION - general adult reference ranges, to be reviewed against NASA HRP sources`.
The values are general adult placeholders and are not mission or clinical criteria. The mapping of indicators to body systems is simplified.

| Indicator | Within range | Monitor | Attention |
|---|---|---|---|
| Resistive exercise, 7-day total | ≥ 240 min | 150–239 min | < 150 min |
| Aerobic exercise, 7-day total | ≥ 180 min | 120–179 min | < 120 min |
| Urinary calcium change vs preflight (optional) | ≤ +20 % | +21 to +50 % | > +50 % |
| Bone resorption marker change vs preflight (optional) | ≤ +25 % | +26 to +60 % | > +60 % |
| Reaction speed vs own baseline (optional) | within 15 % of baseline (or better) | 15–30 % below | > 30 % below |
| Working memory vs own baseline (optional) | within 15 % of baseline (or better) | 15–30 % below | > 30 % below |
| Lapses > 500 ms in 1 min (optional) | 0–1 | 2–3 | ≥ 4 |
| Dizziness / balance (self-check) | 0 | 1–2 | 3 |
| Vision change (self-check) | 0 | 1 | 2 |
| SpO₂ | ≥ 95 % | 92–94 % | < 92 % |
| Respiratory rate | 12–20 /min | 10–11 or 21–24 /min | < 10 or > 24 /min |
| Cabin CO₂ (optional) | ≤ 3300 ppm (≈ 2.5 mmHg) | 3301–5300 ppm | > 5300 ppm (≈ 4 mmHg) |
| Fluid intake | 2.0–5.0 L | 1.5–1.9 or 5.1–6.0 L | < 1.5 or > 6.0 L |
| Urine color | 1–2 | 3 | 4–5 |
| Body mass change over 7 days | > −3 % | −3 to −5 % | < −5 % |
| Calorie intake, 7-day average (target 2700 kcal/day) | 90–125 % of target | 80–90 % or 125–140 % | < 80 % or > 140 % |

**Trend watch** (`trendWatch` in `config.js`, also marked *ASSUMPTION*):
- A line is fitted to at least 6 recorded values from the last 14 days.
- The trend is flagged when three things hold: the latest value is within range, the line moves in the unfavorable direction by at least the indicator's `step` over 14 days (for example 8 mmHg systolic, 0.7 h sleep, 1 percentage point of 7-day body mass change, 150 kcal of 7-day average intake), and it fits steadily (R² ≥ 0.6).
- It is an early-warning signal only, not a diagnosis.

Optional indicators that were not provided are shown as "not measured" and don't affect a system's status or the score.

## NASA Human Research Program references

- 5 Hazards of Human Spaceflight — https://www.nasa.gov/hrp/hazards/
- Risks of Human Spaceflight — https://humanresearchroadmap.nasa.gov/risks/
- Ongoing HRP Research — https://www.nasa.gov/hrp/research/

HRP risks behind the spaceflight-specific indicators (listed on the Risks of Human Spaceflight page above; check the exact current titles there, as HRP renames risks from time to time):

- Risk of Bone Fracture due to Spaceflight-induced Changes to Bone
- Risk of Impaired Performance Due to Reduced Muscle Mass, Strength and Endurance
- Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization and Work Overload
- Risk of Altered Sensorimotor/Vestibular Function Impacting Critical Mission Tasks
- Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)
- Risk of Renal Stone Formation
- Risk of Reduced Crew Health and Performance Due to Hypoxia
- Risk of Performance Decrements and Adverse Health Outcomes Resulting from Inadequate Food and Nutrition

Background for the bone and alertness indicators:

- Smith, S. M. et al. (2005). Bone markers, calcium metabolism, and calcium kinetics during extended-duration space flight on the Mir space station. *Journal of Bone and Mineral Research*, 20(2). Reports increased urinary calcium and bone resorption markers in flight, with formation markers unchanged or decreased.
- Smith, S. M. et al. (2012). Benefits for bone from resistance exercise and nutrition in long-duration spaceflight: evidence from biochemistry and densitometry. *Journal of Bone and Mineral Research*, 27(9). Exercise countermeasures reduce, but do not fully prevent, bone loss.
- NASA Technical Reports Server: Psychomotor Vigilance Self Test on the ISS (the "Reaction Self Test", a 3-minute PVT-B) — https://ntrs.nasa.gov/citations/20090029851
- Jones, C. W. et al. (2022). Sleep deficiency in spaceflight is associated with degraded neurobehavioral functions and elevated stress in astronauts on six-month missions aboard the International Space Station. *Sleep*, 45(3) — https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197

This project is not affiliated with or endorsed by NASA and uses no NASA logos or insignia.
