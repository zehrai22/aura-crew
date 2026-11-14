# AURA-CREW

**Crew health indicators and decision support for astronauts.** Built for the NASA Space Apps 2026 challenge *"Create Health Monitoring Software for Astronauts on Space Missions"*.

An astronaut records a short daily check-in. AURA-CREW compares each reading with configurable reference ranges and shows which body systems may need attention on an interactive body figure.

> **Decision support only.** AURA-CREW shows *indicators*. It does not diagnose. Always confirm with your medical officer or flight surgeon.
>
> **Synthetic demo data.** The 30-day history in `data.js` is made up. It is not real astronaut or patient data, and the UI labels it with a "Synthetic demo data" badge.

## Features

- **Daily check-in** with blood pressure (systolic and diastolic), resting heart rate, blood glucose (mg/dL), body temperature, sleep hours and mood (1–5). A new entry updates the whole app right away. Entries are kept in your browser's `localStorage`, and an entry for a date replaces the synthetic entry for that date.
- **Interactive 2D body figure** with five clickable systems: brain and mind, heart and cardiovascular, immune system, metabolism, and bones and muscle. Each one turns green (within range), yellow (monitor) or red (attention) based on the latest indicators it depends on. The overall status is shown alongside.
- **Region panel** for each system. It covers what the system does and why spaceflight may affect it, linked to the five NASA HRP hazards. It also has a 30-day trend chart per indicator (with reference bands, a hover tooltip and a data table), how to measure the indicators in space, and 2–3 recommended actions that depend on the current status. A red status adds a "Contact your flight surgeon" note. Every recommendation ends with "Decision support only, confirm with your medical officer."

- **Hazards section** with a card for each of the five NASA HRP hazards. Each card says what the hazard is and which daily indicators it *may affect*, with their latest values and status, and links to the related body systems. The hazard chips in a region panel jump to the matching card.

- **What-if scenarios.** Three toggles (skip exercise, sleep deficit, radiation event) apply illustrative offsets to the latest check-in, so you can see how indicators and body-system status may shift. A "Simulation · not real data" banner appears while any toggle is on. Nothing is saved, and the trend charts always show recorded data.
- **Indicator score and streak.** A 0–100 daily indicator score (the average of per-indicator points: within range 100, monitor 60, attention 20) with its 7-day average, plus a check-in streak counting consecutive logged days up to today.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `style.css` | Holographic HUD styling, responsive layout, animations |
| `app.js` | Status logic, SVG body figure, check-in form, region panel |
| `config.js` | **All thresholds**, the indicator-to-system mapping, what-if offsets and score points (each marked *ASSUMPTION*) |
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
The values are general adult placeholders and are not mission or clinical criteria. The mapping of indicators to body systems is a simplified proxy. For example, bones and muscle use resting heart rate and sleep, because the daily check-in has no direct bone or muscle measure.

## NASA Human Research Program references

- 5 Hazards of Human Spaceflight — https://www.nasa.gov/hrp/hazards/
- Risks of Human Spaceflight — https://humanresearchroadmap.nasa.gov/risks/
- Ongoing HRP Research — https://www.nasa.gov/hrp/research/

This project is not affiliated with or endorsed by NASA and uses no NASA logos or insignia.
