// Layer 5 checks on hand-built cases. Run: node test_decision.js
const N = require('./engine.js');
let failed = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${JSON.stringify(got)}${ok ? '' : ', expected ' + JSON.stringify(want)}`); };
// Uneven slip: passes on days 2..7 and 10, candidate on day 4.
const pass = [false, false, true, true, true, true, true, true, false, false, true];
eq('Slip tolerance, uneven', N.slipTolerance(pass, 4), { early: 2, late: 3, earlyOpen: false, lateOpen: false });
eq('Slip tolerance, failing candidate', N.slipTolerance(pass, 0), null);
eq('Slip tolerance, isolated pass at the grid edge', N.slipTolerance(pass, 10), { early: 0, late: 0, earlyOpen: false, lateOpen: true });
eq('Slip tolerance, run reaching both edges', N.slipTolerance([true, true, true], 1), { early: 1, late: 1, earlyOpen: true, lateOpen: true });
eq('Change per step, central', N.localChange([10, 12, 18], 1), 4);
eq('Change per step, edge', N.localChange([10, 12, 18], 2), 6);
const items = [{ a: 5, b: 5 }, { a: 6, b: 5 }, { a: 4, b: 9 }, { a: 3, b: 3 }];
eq('Mark: only candidates nothing beats', N.nonDominated(items, [{ key: 'a', better: 'high' }, { key: 'b', better: 'high' }]), [false, true, true, false]);
eq('Mark: lower-is-better objective', N.nonDominated([{ d: 10 }, { d: 5 }], [{ key: 'd', better: 'low' }]), [false, true]);
eq('Constraints', N.failures({ longestDark: 60, earthShare: 0.4, sunAtLanding: true, earthAtLanding: false }, { maxDarkH: 48, minEarthPct: 50, landingVisible: true }), ['Earth hidden at landing', 'darkness 60 h > 48 h', 'Earth 40% < 50%']);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll decision checks passed');
process.exit(failed ? 1 : 0);
