// Layer 1 checks against JPL Horizons, 15 November 2026 12:00 UTC.
// Run with: node test.js
const N = require('./engine.js');

const sample = `
 Date__(UT)__HR:MN     ObsSub-LON ObsSub-LAT  SunSub-LON SunSub-LAT             delta      deldot
$$SOE
 2026-Nov-15 12:00     356.693692   2.701345  108.340594  -1.556542  4.0393073664E+05  -0.0232554
 2026-Nov-15 13:00     356.636966   2.649369  107.833088  -1.556492  4.0384595957E+05  -0.0238387
$$EOE`;
const csv = `$$SOE
 2026-Nov-15 12:00, , , 356.693692,   2.701345, 108.340594,  -1.556542, 4.0393073664E+05,  -0.0232554,
 2026-Nov-15 13:00, , , 356.636966,   2.649369, 107.833088,  -1.556492, 4.0384595957E+05,  -0.0238387,
$$EOE`;

let failed = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got.toFixed(4)}, Horizons ${want.toFixed(4)}, tolerance ${tol}`);
}

for (const [label, text] of [['space format', sample], ['comma format', csv]]) {
  const table = N.parseHorizons(text);
  const t = Date.UTC(2026, 10, 15, 12, 0);
  console.log(`\n${label}: ${table.rows.length} rows`);
  const apollo = N.skyAt(table, { lat: 0.67408, lon: 23.47297 }, t);
  check('Apollo 11 Sun elevation', apollo.sun.el, 5.111256, 0.002);
  check('Apollo 11 Sun azimuth', apollo.sun.az, 91.623195, 0.002);
  check('Apollo 11 Earth elevation', apollo.earth.el, 63.043151, 0.005);
  check('Apollo 11 Earth azimuth', apollo.earth.az, 274.65393, 0.005);
  const pole = N.skyAt(table, { lat: -89.45, lon: 222.69 }, t);
  check('Pole site Sun elevation', pole.sun.el, 1.329045, 0.002);
  check('Pole site Sun azimuth', pole.sun.az, 245.637782, 0.002);
  check('Pole site Earth elevation', pole.earth.el, -3.329643, 0.002);
  check('Pole site Earth azimuth', pole.earth.az, 133.981286, 0.005);
  const half = N.skyAt(table, { lat: 0.67408, lon: 23.47297 }, t + 30 * 60000);
  check('Apollo 11 Sun elevation at 12:30 (interpolated)', half.sun.el, (5.111256 + 5.618523) / 2, 0.002);
}
check('Horizon dip at 1 km', N.horizonDip(1), 1.943, 0.001);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
