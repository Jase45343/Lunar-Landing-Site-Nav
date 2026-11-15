// Lunar Landing Site Navigator: model engine.
// Layer 1 (geometry) of the model specification. Angles in degrees at the
// interface, radians inside. Frame: MOON_ME, longitude positive east. Times UTC.
(function (root) {
  const R_MOON = 1737.4; // km, reference sphere used by LOLA and Horizons
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const wrap360 = (a) => ((a % 360) + 360) % 360;

  // Elevation and azimuth of a body whose sub-point is (subLat, subLon),
  // seen from (lat, lon) on a spherical Moon. Azimuth clockwise from north.
  function elAz(lat, lon, subLat, subLon) {
    const p = rad(lat), pb = rad(subLat), d = rad(subLon - lon);
    let s = Math.sin(p) * Math.sin(pb) + Math.cos(p) * Math.cos(pb) * Math.cos(d);
    s = Math.max(-1, Math.min(1, s));
    const east = Math.cos(pb) * Math.sin(d);
    const north = Math.cos(p) * Math.sin(pb) - Math.sin(p) * Math.cos(pb) * Math.cos(d);
    return { el: deg(Math.asin(s)), az: wrap360(deg(Math.atan2(east, north))) };
  }

  // Shift an elevation measured from the Moon's centre to the observer.
  // D: distance to the body from the Moon's centre (km). rs: observer radius (km).
  function correctToSite(el, D, rs) {
    const e = rad(el);
    return deg(Math.atan2(D * Math.sin(e) - rs, D * Math.cos(e)));
  }

  // Dip of the smooth-sphere horizon for an observer h km above the sphere.
  function horizonDip(hKm) {
    return hKm > 0 ? deg(Math.acos(R_MOON / (R_MOON + hKm))) : 0;
  }

  const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

  // Parse a Horizons observer table (Moon seen from Earth's centre) with
  // quantities 14, 15, 20: sub-Earth lon/lat, sub-solar lon/lat, range in km.
  // Accepts the comma-separated and the space-separated layouts.
  function parseHorizons(text) {
    const a = text.indexOf('$$SOE'), b = text.indexOf('$$EOE');
    if (a < 0 || b < 0) throw new Error('No $$SOE / $$EOE block found in the Horizons file.');
    const rows = [];
    for (const line of text.slice(a + 5, b).split('\n')) {
      const m = line.match(/(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})/);
      if (!m) continue;
      const t = Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]);
      const nums = line.slice(m.index + m[0].length).split(/[,\s]+/).map(parseFloat).filter(Number.isFinite);
      if (nums.length < 5) continue;
      rows.push({ t, eLon: nums[0], eLat: nums[1], sLon: nums[2], sLat: nums[3], D: nums[4] });
    }
    if (rows.length < 2) throw new Error('The Horizons file has fewer than two usable rows.');
    return { rows, t0: rows[0].t, t1: rows[rows.length - 1].t, step: rows[1].t - rows[0].t };
  }

  const lerp = (x, y, f) => x + (y - x) * f;
  function lerpLon(x, y, f) {
    let d = y - x;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return wrap360(x + d * f);
  }

  // Sub-points and Earth distance at time t (ms, UTC), by linear interpolation.
  function ephemAt(table, t) {
    if (t < table.t0 || t > table.t1) return null;
    const x = (t - table.t0) / table.step;
    const i = Math.min(Math.floor(x), table.rows.length - 2), f = x - i;
    const r0 = table.rows[i], r1 = table.rows[i + 1];
    return {
      eLon: lerpLon(r0.eLon, r1.eLon, f), eLat: lerp(r0.eLat, r1.eLat, f),
      sLon: lerpLon(r0.sLon, r1.sLon, f), sLat: lerp(r0.sLat, r1.sLat, f),
      D: lerp(r0.D, r1.D, f),
    };
  }

  // Sun and Earth in the sky of a site at time t.
  // site: { lat, lon, heightKm (site height above the sphere), mastM (height above ground) }
  function skyAt(table, site, t) {
    const e = ephemAt(table, t);
    if (!e) return null;
    const rs = R_MOON + (site.heightKm || 0) + (site.mastM || 0) / 1000;
    const sun = elAz(site.lat, site.lon, e.sLat, e.sLon);
    const earth = elAz(site.lat, site.lon, e.eLat, e.eLon);
    earth.elCentre = earth.el;
    earth.el = correctToSite(earth.el, e.D, rs);
    return { sun, earth, ephem: e, dip: horizonDip(rs - R_MOON) };
  }


  // ---- Layer 2 hook: the horizon in a given direction -------------------
  // Until a terrain mask is attached to the site, the horizon is the smooth
  // sphere seen from the observer's height. site.mask = array of skyline
  // angles (degrees), one per equal azimuth bin starting at 0.
  function horizonAt(site, az, dip) {
    if (!site.mask) return -dip;
    const n = site.mask.length;
    return site.mask[Math.min(n - 1, Math.floor((wrap360(az) / 360) * n))];
  }

  // ---- Layer 3: margin, events, windows ----------------------------------
  // body: 'sun' or 'earth'. m: minimum margin in degrees (communication).
  function margin(table, site, t, body, m) {
    const sky = skyAt(table, site, t);
    if (!sky) return NaN;
    const b = body === 'sun' ? sky.sun : sky.earth;
    return b.el - horizonAt(site, b.az, sky.dip) - (m || 0);
  }

  // Visibility changes of one body between tStart and tEnd (ms, UTC).
  // Returns { events: [{t, type}], intervals: [{start, end, visible}] }.
  function findWindows(table, site, tStart, tEnd, body, m, stepMs) {
    const a = Math.max(tStart, table.t0), b = Math.min(tEnd, table.t1);
    const step = stepMs || 30 * 60000;
    const g = (t) => margin(table, site, t, body, m);
    const events = [];
    let t0 = a, g0 = g(a);
    while (t0 < b) {
      const t1 = Math.min(t0 + step, b), g1 = g(t1);
      if (g0 > 0 !== g1 > 0) {
        let lo = t0, hi = t1;
        while (hi - lo > 30000) {
          const mid = (lo + hi) / 2;
          if (g(mid) > 0 === g0 > 0) lo = mid; else hi = mid;
        }
        events.push({ t: (lo + hi) / 2, type: g1 > 0 ? 'rise' : 'set' });
      }
      t0 = t1; g0 = g1;
    }
    const intervals = [];
    let start = a, visible = g(a) > 0;
    for (const e of events) { intervals.push({ start, end: e.t, visible }); start = e.t; visible = !visible; }
    intervals.push({ start, end: b, visible });
    return { events, intervals, start: a, end: b };
  }

  // Share of the window visible, and the longest visible and blocked stretches (ms).
  function summarise(w) {
    let vis = 0, longVis = 0, longBlock = 0;
    for (const i of w.intervals) {
      const d = i.end - i.start;
      if (i.visible) { vis += d; longVis = Math.max(longVis, d); } else longBlock = Math.max(longBlock, d);
    }
    const total = w.end - w.start;
    return { share: total > 0 ? vis / total : 0, longestVisible: longVis, longestBlocked: longBlock, total };
  }

  // Windows where both A and B are visible.
  function intersect(wa, wb) {
    const out = [], A = wa.intervals.filter((i) => i.visible), B = wb.intervals.filter((i) => i.visible);
    for (const x of A) for (const y of B) {
      const s = Math.max(x.start, y.start), e = Math.min(x.end, y.end);
      if (e > s) out.push({ start: s, end: e, visible: true });
    }
    out.sort((p, q) => p.start - q.start);
    const intervals = [];
    let cur = wa.start;
    for (const i of out) {
      if (i.start > cur) intervals.push({ start: cur, end: i.start, visible: false });
      intervals.push(i); cur = i.end;
    }
    if (cur < wa.end) intervals.push({ start: cur, end: wa.end, visible: false });
    return { intervals, start: wa.start, end: wa.end };
  }

  // Build a table from the compact form embedded in the page.
  function tableFromCompact(c) {
    const rows = [];
    for (let i = 0; i < c.d.length; i += 5) rows.push({ t: c.t0 + (i / 5) * c.step, eLon: c.d[i], eLat: c.d[i + 1], sLon: c.d[i + 2], sLat: c.d[i + 3], D: c.d[i + 4] });
    return { rows, t0: c.t0, t1: rows[rows.length - 1].t, step: c.step };
  }


  // ---- Layer 2: terrain mask from a LOLA polar map -----------------------
  // dem: south-polar stereographic grid, true scale at the pole, longitude 0
  // pointing up and 90 E to the right. data = Int16 heights in units of 0.5 m
  // above the 1737.4 km sphere. n = pixels per side. scaleKm = pixel size.
  function demFromBuffer(buf, scaleKm) {
    const data = new Int16Array(buf);
    return { data, n: Math.round(Math.sqrt(data.length)), scaleKm: scaleKm || 0.24 };
  }
  function demPixel(dem, lat, lon) {
    const r = 2 * R_MOON * Math.tan(rad(90 + lat) / 2);
    return { col: (r * Math.sin(rad(lon))) / dem.scaleKm + dem.n / 2 - 0.5, row: (-r * Math.cos(rad(lon))) / dem.scaleKm + dem.n / 2 - 0.5 };
  }
  // Height of the surface at (lat, lon) in km, or null outside the map.
  function demHeightKm(dem, lat, lon) {
    const { col, row } = demPixel(dem, lat, lon), c = Math.floor(col), r = Math.floor(row);
    if (c < 0 || r < 0 || c >= dem.n - 1 || r >= dem.n - 1) return null;
    const fc = col - c, fr = row - r, d = dem.data, n = dem.n;
    const top = d[r * n + c] * (1 - fc) + d[r * n + c + 1] * fc, bot = d[(r + 1) * n + c] * (1 - fc) + d[(r + 1) * n + c + 1] * fc;
    return (top * (1 - fr) + bot * fr) * 0.0005;
  }
  // Skyline angle in each azimuth bin, from every map cell within rangeKm.
  // Returns { mask, heightKm, incomplete, rangeKm, bins } or null off the map.
  function computeMask(dem, site, opts) {
    const o = opts || {}, bins = o.bins || 360, range = o.rangeKm || 200;
    const hs = demHeightKm(dem, site.lat, site.lon);
    if (hs === null) return null;
    const rs = R_MOON + hs + (site.mastM || 0) / 1000;
    const p = rad(site.lat), l = rad(site.lon);
    const ux = Math.cos(p) * Math.cos(l), uy = Math.cos(p) * Math.sin(l), uz = Math.sin(p);
    const ex = -Math.sin(l), ey = Math.cos(l);
    const nx = -Math.sin(p) * Math.cos(l), ny = -Math.sin(p) * Math.sin(l), nz = Math.cos(p);
    const c0 = demPixel(dem, site.lat, site.lon), half = Math.ceil((range * 1.03) / dem.scaleKm), n = dem.n, S = dem.scaleKm;
    const r0 = Math.round(c0.row) - half, r1 = Math.round(c0.row) + half, k0 = Math.round(c0.col) - half, k1 = Math.round(c0.col) + half;
    const incomplete = r0 < 0 || k0 < 0 || r1 >= n || k1 >= n;
    const mask = new Float64Array(bins).fill(-Infinity), cosRange = Math.cos(range / R_MOON), minD = S / R_MOON;
    for (let r = Math.max(0, r0); r <= Math.min(n - 1, r1); r++) {
      const Y = (r - n / 2 + 0.5) * S;
      for (let k = Math.max(0, k0); k <= Math.min(n - 1, k1); k++) {
        const X = (k - n / 2 + 0.5) * S, rr = Math.sqrt(X * X + Y * Y);
        const lat = -Math.PI / 2 + 2 * Math.atan(rr / (2 * R_MOON)), cl = Math.cos(lat);
        const vx = rr > 0 ? (cl * -Y) / rr : 0, vy = rr > 0 ? (cl * X) / rr : 0, vz = Math.sin(lat);
        const cosd = ux * vx + uy * vy + uz * vz;
        if (cosd < cosRange) continue;
        const delta = Math.acos(Math.min(1, cosd));
        if (delta < minD) continue;
        const rp = R_MOON + dem.data[r * n + k] * 0.0005;
        const alpha = Math.atan2(rp * cosd - rs, rp * Math.sin(delta));
        let az = Math.atan2(vx * ex + vy * ey, vx * nx + vy * ny + vz * nz);
        if (az < 0) az += 2 * Math.PI;
        // A cell is an area, not a point: it covers every bin its width reaches.
        const w = Math.atan2(0.5 * S, delta * R_MOON), binW = (2 * Math.PI) / bins;
        const b0 = Math.floor((az - w) / binW), b1 = Math.floor((az + w) / binW);
        for (let q = b0; q <= b1; q++) {
          const b = ((q % bins) + bins) % bins;
          if (alpha > mask[b]) mask[b] = alpha;
        }
      }
    }
    const dip = -horizonDip(rs - R_MOON);
    const out = Array.from(mask, (a) => (a === -Infinity ? dip : +deg(a).toFixed(3)));
    return { mask: out, heightKm: hs, incomplete, rangeKm: range, bins };
  }


  // ---- Layer 4: power -----------------------------------------------------
  // Share of a panel's head-on output. type: 'flat', 'tracking' (vertical,
  // turns to follow the Sun) or 'fixed' (vertical, facing azimuth `facing`).
  function powerFactor(type, el, az, facing) {
    const e = rad(el);
    if (type === 'flat') return Math.max(0, Math.sin(e));
    if (type === 'tracking') return Math.max(0, Math.cos(e));
    return Math.max(0, Math.cos(e) * Math.cos(rad(az - (facing || 0))));
  }
  // Equivalent full-sun hours and the longest stretch with no power, from the
  // Sun's visibility windows. Integrates inside visible intervals only.
  function powerMetrics(table, site, sunW, panel, stepMs) {
    const step = stepMs || 10 * 60000;
    let ms = 0, longestZero = 0, zs = null;
    const close = (t) => { if (zs !== null) { longestZero = Math.max(longestZero, t - zs); zs = null; } };
    for (const i of sunW.intervals) {
      if (!i.visible) { if (zs === null) zs = i.start; continue; }
      let tPrev = i.start, pPrev = null;
      for (let t = i.start; ; t = Math.min(t + step, i.end)) {
        const k = skyAt(table, site, t), p = powerFactor(panel.type, k.sun.el, k.sun.az, panel.facing);
        if (p <= 1e-9) { if (zs === null) zs = t; } else close(t);
        if (pPrev !== null) ms += ((p + pPrev) / 2) * (t - tPrev);
        tPrev = t; pPrev = p;
        if (t >= i.end) break;
      }
    }
    close(sunW.end);
    return { fullSunHours: ms / 3600000, longestZeroPower: longestZero };
  }


  // ---- Layer 5: decision ---------------------------------------------------
  // Scorecard for one site and landing time.
  function evaluate(table, site, t0, days, m, panel) {
    const t1 = t0 + days * 86400000;
    if (t0 < table.t0 || t1 > table.t1) return null;
    const step = 20 * 60000;
    const sun = findWindows(table, site, t0, t1, 'sun', 0, step), earth = findWindows(table, site, t0, t1, 'earth', m, step);
    const a = summarise(sun), b = summarise(earth), c = summarise(intersect(sun, earth));
    const out = {
      sunShare: a.share, longestDark: a.longestBlocked / 3600000, earthShare: b.share, longestBlackout: b.longestBlocked / 3600000,
      bothShare: c.share, sunAtLanding: sun.intervals[0].visible, earthAtLanding: earth.intervals[0].visible,
    };
    if (panel && panel.type) {
      const p = powerMetrics(table, site, sun, panel, step);
      out.fullSunHours = p.fullSunHours; out.longestZeroPower = p.longestZeroPower / 3600000;
    }
    return out;
  }
  // Hard constraints. Returns a list of failure reasons (empty = passes).
  function failures(r, c) {
    const f = [];
    if (c.landingVisible && !r.sunAtLanding) f.push('Sun hidden at landing');
    if (c.landingVisible && !r.earthAtLanding) f.push('Earth hidden at landing');
    if (c.maxDarkH != null && r.longestDark > c.maxDarkH) f.push(`darkness ${r.longestDark.toFixed(0)} h > ${c.maxDarkH} h`);
    if (c.minEarthPct != null && 100 * r.earthShare < c.minEarthPct) f.push(`Earth ${(100 * r.earthShare).toFixed(0)}% < ${c.minEarthPct}%`);
    if (c.minFullSunH != null && r.fullSunHours != null && r.fullSunHours < c.minFullSunH) f.push(`full-sun ${r.fullSunHours.toFixed(0)} h < ${c.minFullSunH} h`);
    return f;
  }
  // Early and late slip tolerance on a date grid: the unbroken run of passing
  // dates on each side of index i. `open` means the run reached the grid edge.
  function slipTolerance(pass, i) {
    if (!pass[i]) return null;
    let e = 0, l = 0;
    while (i - e - 1 >= 0 && pass[i - e - 1]) e++;
    while (i + l + 1 < pass.length && pass[i + l + 1]) l++;
    return { early: e, late: l, earlyOpen: i - e === 0, lateOpen: i + l === pass.length - 1 };
  }
  // Change per grid step: central difference, one-sided at the edges.
  function localChange(values, i) {
    const n = values.length;
    if (n < 2) return 0;
    if (i === 0) return values[1] - values[0];
    if (i === n - 1) return values[n - 1] - values[n - 2];
    return (values[i + 1] - values[i - 1]) / 2;
  }
  // Marks candidates no other candidate beats on every objective.
  // objectives: [{ key, better: 'high' | 'low' }]
  function nonDominated(items, objectives) {
    const val = (x, o) => (o.better === 'high' ? x[o.key] : -x[o.key]);
    return items.map((a) => !items.some((b) => b !== a && objectives.every((o) => val(b, o) >= val(a, o)) && objectives.some((o) => val(b, o) > val(a, o))));
  }


  // ---- Map: sunlight and Earth visibility across the south-polar region ---
  // A square grid of P x P points covering [-E, E] km in polar stereographic
  // coordinates (0 longitude up, 90 E right), with heights from the map.
  function prepareMapGrid(dem, P, E) {
    const cell = (2 * E) / P, h = new Float32Array(P * P), lat = new Float32Array(P * P), lon = new Float32Array(P * P);
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const X = -E + (i + 0.5) * cell, Y = -E + (j + 0.5) * cell, r = Math.hypot(X, Y), k = j * P + i;
      lat[k] = -90 + (2 * Math.atan(r / (2 * R_MOON)) * 180) / Math.PI;
      lon[k] = wrap360((Math.atan2(X, -Y) * 180) / Math.PI);
      const v = demHeightKm(dem, lat[k], lon[k]);
      h[k] = v === null ? 0 : v;
    }
    return { P, E, cell, h, lat, lon };
  }
  function mapXY(lat, lon) {
    const r = 2 * R_MOON * Math.tan(rad(90 + lat) / 2);
    return { X: r * Math.sin(rad(lon)), Y: -r * Math.cos(rad(lon)) };
  }
  // Which grid points see the body, and how directly sunlight hits the ground.
  // sub: { lat, lon } sub-point of the body. D: distance in km (Earth only).
  function lightMap(grid, sub, opts) {
    const o = opts || {}, { P, E, cell, h } = grid, mast = (o.mastM || 0) / 1000, maxD = o.maxKm || 150;
    const sl = rad(sub.lat), so = rad(sub.lon), sx = Math.cos(sl) * Math.cos(so), sy = Math.cos(sl) * Math.sin(so), sz = Math.sin(sl);
    let dx = sy, dy = -sx; const dn = Math.hypot(dx, dy) || 1; dx /= dn; dy /= dn;
    const vis = new Uint8Array(P * P), lambert = new Float32Array(P * P);
    const H = (fx, fy) => {
      const i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0 || j < 0 || i >= P - 1 || j >= P - 1) return null;
      const a = fx - i, b = fy - j, k = j * P + i;
      return (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) + (h[k + P] * (1 - a) + h[k + P + 1] * a) * b;
    };
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const k = j * P + i, la = rad(grid.lat[k]), lo = rad(grid.lon[k]);
      let el = Math.asin(Math.max(-1, Math.min(1, Math.cos(la) * Math.cos(lo) * sx + Math.cos(la) * Math.sin(lo) * sy + Math.sin(la) * sz)));
      const hs = h[k] + mast;
      if (o.D) el = Math.atan2(o.D * Math.sin(el) - (R_MOON + hs), o.D * Math.cos(el));
      if (el < rad(-6)) continue;
      const tanEl = Math.tan(el);
      let seen = true;
      for (let d = cell * 0.75; d < maxD; d = d * 1.06 + cell * 0.25) {
        const hp = H(i + (d * dx) / cell, j + (d * dy) / cell);
        if (hp === null) break;
        if ((hp - hs - (d * d) / (2 * R_MOON)) / d > tanEl) { seen = false; break; }
      }
      if (!seen) continue;
      vis[k] = 1;
      const gx = i > 0 && i < P - 1 ? (h[k + 1] - h[k - 1]) / (2 * cell) : 0, gy = j > 0 && j < P - 1 ? (h[k + P] - h[k - P]) / (2 * cell) : 0;
      const ce = Math.cos(el);
      lambert[k] = Math.max(0, (-gx * ce * dx - gy * ce * dy + Math.sin(el)) / Math.sqrt(gx * gx + gy * gy + 1));
    }
    return { vis, lambert };
  }

  const api = { R_MOON, elAz, correctToSite, horizonDip, parseHorizons, ephemAt, skyAt, wrap360, horizonAt, margin, findWindows, summarise, intersect, tableFromCompact, demFromBuffer, demPixel, demHeightKm, computeMask, powerFactor, powerMetrics, evaluate, failures, slipTolerance, localChange, nonDominated, prepareMapGrid, mapXY, lightMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Navigator = api;
})(typeof window !== 'undefined' ? window : globalThis);
