// Layer 2 checks on synthetic terrain with known answers. Run: node test_terrain.js
const N = require('./engine.js');
const n = 2000, S = 0.24;
const flat = (dn) => ({ data: new Int16Array(n * n).fill(dn), n, scaleKm: S });
let failed = 0;
const check = (name, got, want, tol) => { const ok = Math.abs(got - want) <= tol; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got.toFixed(4)}, expected ${want.toFixed(4)}, tolerance ${tol}`); };
const stats = (m) => [Math.min(...m), Math.max(...m)];

let m = N.computeMask(flat(0), { lat: -88, lon: 40, mastM: 0 });
check('Smooth sphere, observer on the surface: highest skyline', stats(m.mask)[1], 0, 0.01);
check('Smooth sphere, observer on the surface: lowest skyline', stats(m.mask)[0], 0, 0.01);

m = N.computeMask(flat(0), { lat: -88, lon: 40, mastM: 1000 });
check('Observer 1 km above a smooth sphere: highest skyline', stats(m.mask)[1], -1.9435, 0.005);
check('Observer 1 km above a smooth sphere: lowest skyline', stats(m.mask)[0], -1.9435, 0.005);

m = N.computeMask(flat(-4000), { lat: -88, lon: 40, mastM: 0 });
check('Site 2 km below the reference sphere, flat: highest skyline', stats(m.mask)[1], 0, 0.01);
check('Site 2 km below the reference sphere: site height (km)', m.heightKm, -2, 1e-6);

// Lone peak 5 km high, placed 100 km from the site toward the pole (azimuth 180).
const dem = flat(0), site = { lat: -85, lon: 0, mastM: 0 };
const pk = N.demPixel(dem, -85 - (100 / 1737.4) * (180 / Math.PI), 0);
dem.data[Math.round(pk.row) * n + Math.round(pk.col)] = 10000;
m = N.computeMask(dem, site);
const d = 100 / 1737.4, want = (Math.atan2(1742.4 * Math.cos(d) - 1737.4, 1742.4 * Math.sin(d)) * 180) / Math.PI;
const peakBin = m.mask.indexOf(Math.max(...m.mask));
check('Lone 5 km peak at 100 km: skyline angle', Math.max(...m.mask), want, 0.01);
check('Lone 5 km peak at 100 km: direction bin', peakBin, 180, 1);
check('Lone peak: number of bins raised (1 or 2)', m.mask.filter((a) => a > 0.01).length, 1.5, 0.5);
console.log('incomplete flag near the map edge:', N.computeMask(flat(0), { lat: -83, lon: 0 }).incomplete, '| off the map returns', N.computeMask(flat(0), { lat: -70, lon: 0 }));
console.log(failed ? `\n${failed} check(s) failed` : '\nAll terrain checks passed');
process.exit(failed ? 1 : 0);
