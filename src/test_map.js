// Map checks: sunlight on the map must agree with the per-site skyline method.
const N = require('./engine.js'); const fs = require('fs');
const load = (f, s) => { const b = fs.readFileSync(f); return N.demFromBuffer(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), s); };
const coarse = load('dem_coarse.bin', 0.48), full = load('dem.bin', 0.24);
const table = N.parseHorizons(fs.readFileSync('../data/horizons.txt', 'utf8'));
global.window = {}; eval(fs.readFileSync('sites.js', 'utf8'));
let t0 = Date.now(); const grid = N.prepareMapGrid(coarse, 600, 190); console.log('grid ms', Date.now() - t0);
let agree = 0, total = 0, earthAgree = 0;
for (let day = 0; day < 360; day += 7.3) {
  const t = table.t0 + day * 86400000, e = N.ephemAt(table, t);
  t0 = Date.now(); const sun = N.lightMap(grid, { lat: e.sLat, lon: e.sLon }, { mastM: 2 }); const ms = Date.now() - t0;
  const earth = N.lightMap(grid, { lat: e.eLat, lon: e.eLon }, { mastM: 2, D: e.D });
  if (day === 0) console.log('lightMap ms', ms, 'lit share', (sun.vis.reduce((a, b) => a + b, 0) / sun.vis.length).toFixed(3));
  for (const s of window.SITES.filter((x) => x.builtin)) {
    const { X, Y } = N.mapXY(s.lat, s.lon), i = Math.floor((X + 190) / grid.cell), j = Math.floor((Y + 190) / grid.cell), k = j * 600 + i;
    const site = { lat: s.lat, lon: s.lon, heightKm: s.builtin.heightKm, mastM: 2, mask: s.builtin.mask };
    total++;
    if ((N.margin(table, site, t, 'sun') > 0) === !!sun.vis[k]) agree++;
    if ((N.margin(table, site, t, 'earth') > 0) === !!earth.vis[k]) earthAgree++;
  }
}
console.log(`Sun: map agrees with site skylines in ${agree} of ${total} cases; Earth: ${earthAgree} of ${total}`);
const floor = window.SITES[4], fl = N.mapXY(floor.lat, floor.lon); let lit = 0;
for (let day = 0; day < 365; day += 1) { const e = N.ephemAt(table, table.t0 + day * 86400000); const m = N.lightMap(grid, { lat: e.sLat, lon: e.sLon }, {}); const k = Math.floor((fl.Y + 190) / grid.cell) * 600 + Math.floor((fl.X + 190) / grid.cell); lit += m.vis[k]; }
console.log('Shackleton floor lit on', lit, 'of 365 days (expected 0)');
