# AURA-CREW

**Crew health indicators and decision support for astronauts.** Built for the NASA Space Apps 2026 challenge *"Create Health Monitoring Software for Astronauts on Space Missions"*.

An astronaut records a short daily check-in. AURA-CREW compares each reading with configurable reference ranges and shows which body systems may need attention on an interactive body figure.

> **Decision support only.** AURA-CREW shows *indicators*. It does not diagnose. Always confirm with your medical officer or flight surgeon.
>
> **Synthetic demo data.** The 30-day history in `data.js` is made up. It is not real astronaut or patient data, and the UI labels it with a "Synthetic demo data" badge.

## Features

- **Daily check-in** with blood pressure (systolic and diastolic), resting heart rate, SpO₂, respiratory rate, blood glucose (mg/dL), body temperature, sleep hours, mood (1–5), dizziness/balance (0–3) and vision change (0–2) self-checks, fluid intake (L), urine color (1–5) and minutes of resistive and aerobic exercise. Optional fields cover cabin CO₂ (ppm), two bone and kidney markers, and the reaction self-test result. A new entry updates the whole app right away. Entries are kept in your browser's `localStorage`, and an entry for a date replaces the synthetic entry for that date.
- **Interactive 2D body figure** with seven clickable, labeled systems: nervous system, cardiovascular, respiratory, urinary and renal, bones and muscle, immune system, and metabolism. Each one turns green (within range), yellow (monitor) or red (attention) based on the latest indicators it depends on. The overall status is shown alongside.
- **Region panel** for each system. It covers what the system does and why spaceflight may affect it, linked to the five NASA HRP hazards. It also has a 30-day trend chart per indicator (with reference bands, a hover tooltip and a data table), how to measure the indicators in space, and 2–3 recommended actions that depend on the current status. A red status adds a "Contact your flight surgeon" note. Every recommendation ends with "Decision support only, confirm with your medical officer."

- **Bones & muscle indicators.** The status uses 7-day totals of resistive and aerobic exercise minutes (the main in-flight countermeasure). It also uses two optional bone markers when provided: urinary calcium change and bone resorption marker change, each as % versus the preflight baseline. These markers come from periodic samples, not daily ones, so the most recent value from the last 30 days is used for status, and the charts show only the days they were measured. A 7-day total appears once the log covers a full 7 days. The panel explains that NASA research reports urinary calcium and bone resorption markers rise during spaceflight while bone formation markers stay unchanged or fall, and that exercise countermeasures reduce but do not fully prevent muscle and bone loss.
- **Respiratory indicators.** SpO₂, resting respiratory rate and optional cabin CO₂ (read from the cabin display). The panel links them to the hostile and closed environments hazard and notes that NASA lists hypoxia, including exposure to low oxygen and high CO₂ during spacewalks, among spaceflight risks.
- **Urinary & renal indicators.** Daily fluid intake, urine color (1 = pale, 5 = amber) and the optional urinary calcium change, which is shared with bones & muscle. The panel explains that urinary calcium increases during flight, that kidney stones are a risk on long missions, and that adequate fluid intake is a common countermeasure.
- **Nervous system** (formerly "Brain & mind"). Mood, sleep and the reaction self-test, plus two self-checks: dizziness/balance problems (0 none, 1 mild, 2 moderate, 3 severe) and vision change (0 none, 1 slight, 2 noticeable). The panel notes that NASA lists altered sensorimotor and vestibular function (dizziness, motion sickness, coordination problems) and spaceflight-associated neuro-ocular syndrome (SANS, changes in eye and brain structure) among spaceflight risks. Severe dizziness (3) or a noticeable vision change (2) turns the system red with the flight-surgeon note. These are self-checks only, not diagnoses.
- **1-minute reaction self-test** for the nervous system, inspired by the psychomotor vigilance test (PVT) used on the ISS. After a random 2–6 s wait the circle lights up, and you tap it or press Space. The test records the median reaction time (ms) and lapses (responses over 500 ms; no response within 3 s also counts as a lapse). It ignores false starts and needs at least 5 responses. The results go into the check-in, the trend charts and the system status. When alertness is outside the reference range, the app shows: "Low alertness can signal fatigue; consider rest and contact your flight surgeon." This is not a validated clinical test.
- **Hazards section** with a card for each of the five NASA HRP hazards. Each card says what the hazard is and which daily indicators it *may affect*, with their latest values and status, and links to the related body systems. The hazard chips in a region panel jump to the matching card.

- **What-if scenarios.** Four toggles (skip exercise, sleep deficit, radiation event, spacewalk day) apply illustrative offsets to the latest check-in, including exercise totals, reaction results, breathing, hydration and cabin CO₂, so you can see how indicators and body-system status may shift. A "Simulation · not real data" banner appears while any toggle is on. Nothing is saved, and the trend charts always show recorded data.
- **Indicator score and streak.** A 0–100 daily indicator score (the average of per-indicator points: within range 100, monitor 60, attention 20) with its 7-day average, plus a check-in streak counting consecutive logged days up to today.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `style.css` | Holographic HUD styling, responsive layout, animations |
| `app.js` | Status logic, derived indicators (7-day totals, marker carry-forward), SVG body figure, check-in form, region panel, reaction self-test |
| `config.js` | **All thresholds**, the indicator-to-system mapping, reaction-test timing, what-if offsets and score points (each marked *ASSUMPTION*) |
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
| Reaction time, median (optional) | ≤ 320 ms | 321–400 ms | > 400 ms |
| Lapses > 500 ms in 1 min (optional) | 0–1 | 2–3 | ≥ 4 |
| Dizziness / balance (self-check) | 0 | 1–2 | 3 |
| Vision change (self-check) | 0 | 1 | 2 |
| SpO₂ | ≥ 95 % | 92–94 % | < 92 % |
| Respiratory rate | 12–20 /min | 10–11 or 21–24 /min | < 10 or > 24 /min |
| Cabin CO₂ (optional) | ≤ 3300 ppm (≈ 2.5 mmHg) | 3301–5300 ppm | > 5300 ppm (≈ 4 mmHg) |
| Fluid intake | 2.0–5.0 L | 1.5–1.9 or 5.1–6.0 L | < 1.5 or > 6.0 L |
| Urine color | 1–2 | 3 | 4–5 |

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

Background for the bone and alertness indicators:

- Smith, S. M. et al. (2005). Bone markers, calcium metabolism, and calcium kinetics during extended-duration space flight on the Mir space station. *Journal of Bone and Mineral Research*, 20(2). Reports increased urinary calcium and bone resorption markers in flight, with formation markers unchanged or decreased.
- Smith, S. M. et al. (2012). Benefits for bone from resistance exercise and nutrition in long-duration spaceflight: evidence from biochemistry and densitometry. *Journal of Bone and Mineral Research*, 27(9). Exercise countermeasures reduce, but do not fully prevent, bone loss.
- NASA Technical Reports Server: Psychomotor Vigilance Self Test on the ISS (the "Reaction Self Test", a 3-minute PVT-B) — https://ntrs.nasa.gov/citations/20090029851
- Jones, C. W. et al. (2022). Sleep deficiency in spaceflight is associated with degraded neurobehavioral functions and elevated stress in astronauts on six-month missions aboard the International Space Station. *Sleep*, 45(3) — https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197

This project is not affiliated with or endorsed by NASA and uses no NASA logos or insignia.
