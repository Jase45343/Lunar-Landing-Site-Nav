# Resources we used

## NASA data and tools

- [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/app.html): Sun and Earth positions, and the reference we checked our geometry against.
- [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html): definitions of the sub-solar and sub-observer points.
- [LRO LOLA gridded data products](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/LOLA/GDR/GDRDEM.htm): product names, pixel sizes and the 1,737.4 km reference radius.
- [A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (Barker et al.)](https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf): LOLA polar products and their MOON_ME frame.
- [NASA PGDA: Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69): LOLA-based illumination and Earth-visibility maps.
- [NASA SVS: Illumination at the Moon's South Pole to 80°S, 2025 to 2028](https://svs.gsfc.nasa.gov/5027): two-hourly lighting frames, our planned reference for rise and set times.
- [QuickMap](https://quickmap.lroc.im-ldi.com/) and Moon Trek: used to explore the terrain and the existing tools.

## Challenge material

- [Project Submission Guide, NASA Space Apps Challenge](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- The "Lunar Landing Site Navigator" challenge statement and its Resources tab.

## Checks we ran against Horizons

On 15 November 2026 at 12:00 UTC, with Horizons run for the site itself:

| Site | Quantity | Ours | Horizons |
|---|---|---|---|
| Apollo 11 (0.67408°N, 23.47297°E) | Sun elevation | 5.1117° | 5.1113° |
| Apollo 11 | Earth elevation, corrected | 63.0456° | 63.0432° |
| Ridge next to Shackleton (89.45°S, 222.69°E) | Sun elevation | 1.3297° | 1.3290° |
| Ridge next to Shackleton | Earth elevation, corrected | −3.3294° | −3.3296° |
