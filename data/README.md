# Data

Everything the tool computes comes from two NASA sources.

| File | What it is | Source |
|---|---|---|
| `data/horizons.txt` | Hourly sub-solar point, sub-Earth point and Earth-Moon distance, 15 November 2026 to 15 November 2027, in the Moon's mean-Earth frame | NASA JPL Horizons, observer table for the Moon seen from Earth's centre, quantities 14, 15 and 20 |
| `dem.bin` (repository root) | Lunar elevation at 240 m per pixel, cropped to 78°S: 3,044 by 3,044 cells, 16-bit, in units of 0.5 m above a 1,737.4 km sphere, south-polar stereographic with 0° longitude pointing up | NASA LRO LOLA gridded product `LDEM_60S_240M` |
| `src/ephem.js` | The Horizons table in compact form, built into the page | Derived from `data/horizons.txt` |
| `src/demcoarse.js` | The elevation map averaged to 480 m, built into the page | Derived from `LDEM_60S_240M` |
| `src/sites.js` | Curated landing sites with their pre-computed skylines | Derived from `dem.bin` by `src/gen_sites.js` |

`dem.bin` stays in the repository root because the live page loads it from there.

The original `LDEM_60S_240M.JP2` file (43 MB) is not stored here. It decodes to 7,760 by 7,760 unsigned 16-bit values; height in metres is (value − 32768) × 0.5.
