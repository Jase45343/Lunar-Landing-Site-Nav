# Lunar Landing Site Navigator

Compare landing sites and landing dates near the Moon's south pole. Pick a site, pick a date, and see where the Sun and Earth sit against the local skyline, how long they stay up, and what that means for solar power and direct communication with Earth.

Built for the 2026 NASA Space Apps Challenge, "Lunar Landing Site Navigator".

## Use it

Open `index.html`. It is one self-contained file and needs no server.

- **Map:** the south pole lit as it will be at the chosen time. Press Play to watch the shadows move. Select any point to analyse it as a landing site.
- **Three views:** Mission planner (every input, scorecard, site-by-date comparison), Educator (explanations and panel types side by side) and Explorer (plain-language summary).
- **Compare:** tick sites, set a range of landing dates and hard constraints, and get a grid and a sortable table with slip tolerance for each candidate.

If `dem.bin` sits next to `index.html` on a web server, the page loads it and computes skylines from the 240 m map. Without it, the page uses a built-in 480 m map for custom coordinates.

## How it works

Five layers, each using only the one below it:

1. **Geometry:** elevation and azimuth of the Sun and Earth from their sub-points, with Earth corrected from the Moon's centre to the site.
2. **Horizon:** a terrain skyline in 1° azimuth bins, from every map cell within 200 km.
3. **Events:** rises, sets, visibility windows and time remaining.
4. **Metrics:** share of time visible, longest gaps, equivalent full-sun hours for three panel types.
5. **Decision:** hard constraints, a comparison grid, slip tolerance and a mark for candidates nothing beats on every measure.

## Data

- **Sun and Earth positions:** NASA JPL Horizons, hourly sub-solar point, sub-Earth point and Earth-Moon distance, 15 November 2026 to 15 November 2027 (`src/horizons.txt`).
- **Terrain:** NASA Lunar Reconnaissance Orbiter, Lunar Orbiter Laser Altimeter (LOLA) polar elevation map `LDEM_60S_240M`, cropped to 78°S (`dem.bin`) and averaged to 480 m for the built-in map.
- **Frame:** Moon mean-Earth (MOON_ME), longitude positive east, heights above a 1,737.4 km sphere, times in UTC.

## What has been checked

- Sun and Earth elevation and azimuth agree with JPL Horizons to within 0.003° at Apollo 11 and at a site 0.55° from the south pole (`src/test.js`).
- The terrain skyline passes synthetic cases with known answers: a smooth sphere, an observer 1 km up, a site below the reference sphere and a lone peak (`src/test_terrain.js`).
- Slip tolerance, constraints and the mark pass hand-built cases (`src/test_decision.js`).
- The floor of Shackleton crater comes out permanently dark across the full year.

Run the tests with `node src/test.js`, `node src/test_terrain.js` and `node src/test_decision.js`.

## Limits

- Rise and set times against terrain have not yet been checked against an independent reference.
- Visibility uses the centre of each disk. A partly hidden Sun counts as all or nothing.
- The 240 m map misses boulders and small ridges near a lander. The map view uses about 630 m per pixel and is a visual guide.
- Not modelled: landing safety, temperature, ground stations, link budgets, battery sizing, and Earth passing in front of the Sun.

## Rebuilding

`src/` holds the separate source files. From `src/`, run `python3 build.py` to bundle them into `index.html`.

## Use of AI

The code in this repository was written with AI assistance (Claude, by Anthropic), directed and reviewed by the team. The model design was reviewed with other AI tools, and their findings were checked before being adopted.
