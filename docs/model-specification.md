# Lunar Landing Site Navigator: model specification

Nov 15, 2026 · @ATL

## Purpose and scope

The model scores any landing site and landing date on the Moon for two things: solar power potential and direct-to-Earth communication. It is the calculation core of our NASA Space Apps 2026 entry for the Lunar Landing Site Navigator challenge.

The core is an evaluation function. Finding when and where to land is a search over it.

```latex
F(\text{site},\ \text{landing date},\ \text{mission length}) \rightarrow \text{scorecard}
```

- **Primary case:** sites near the lunar south pole, roughly 85°S to 90°S. Other sites (Apollo, custom coordinates) run through the same function.
- **Users:** mission planners first; educators and the public through simpler views of the same results.
- **Structure:** five layers. Each layer uses only the output of the layer below it, so each can be built and verified alone.

| Layer | Question it answers | Output |
| --- | --- | --- |
| 1. Geometry | Where are the Sun and Earth in the site's sky? | Elevation and azimuth |
| 2. Horizon | Does terrain block them? | Terrain mask; visible or blocked |
| 3. Events | When do they rise and set? | Events, windows, time remaining |
| 4. Metrics | How much power and communication? | Scorecard |
| 5. Decision | Which site and date options are worth a look? | Filtered, ranked comparison |

## Inputs and notation

The model needs a site, a mission window, Sun and Earth positions, an elevation map, and a few planner settings.

| Symbol | Meaning | Source |
| --- | --- | --- |
| φ, λ | Site latitude and longitude in the Moon's mean-Earth frame (MOON\_ME): planetocentric, longitude positive east, 0° to 360° | Planner |
| t | Time | Planner (mission window), in UTC |
| φₛ, λₛ | Sub-solar point: where the Sun is directly overhead at time t | JPL Horizons |
| φₑ, λₑ | Sub-Earth point: where Earth is directly overhead at time t | JPL Horizons |
| R | Moon radius, 1,737.4 km: the reference sphere that LOLA heights are measured from | Constant |
| el, az | Elevation above the local level and compass direction of a body | Layer 1 |
| H(az) | Terrain mask: skyline angle in each direction | Layer 2, from LOLA elevation data |
| g(t) | Margin: how far a body sits above the skyline | Layer 3 |
| D | Earth–Moon distance at time t, used to correct Earth's elevation to the site | JPL Horizons |

**Planner settings**

- **Mission window:** landing date plus mission length. Events are searched inside it.
- **Date range to compare** (optional): the candidate landing dates and the step between them. The step starts at 1 day and can be made finer.
- **Panel type:** flat, vertical Sun-following, or vertical fixed with a facing direction. No default.
- **Height above ground:** one height, in metres, used for both the panels and the antenna in the first version. It is added to the site's height when the mask is computed.
- **Minimum Earth margin** for geometric direct-to-Earth visibility, starting at 0°. Every communication output uses it.
- **Flicker threshold** for merging short dips in sunlight, starting at 1 hour. Communication has its own threshold.
- **Hard constraints** for layer 5, such as maximum darkness.

## Layer 1: geometry

Layer 1 gives the elevation and azimuth of the Sun and of Earth as seen from the site, on a smooth spherical Moon.

Two unit vectors start at the Moon's centre. **n** points through the site, which is "straight up" there. **b** points through the body's sub-point (φ\_b, λ\_b), which is toward the body. Their dot product is the cosine of the body's angle from overhead, so:

```latex
\sin(el) = \mathbf{n}\cdot\mathbf{b} = \sin\varphi\,\sin\varphi_b + \cos\varphi\,\cos\varphi_b\,\cos(\lambda_b - \lambda)
```

Azimuth, measured clockwise from local north:

```latex
az = \operatorname{atan2}\big(\cos\varphi_b\,\sin(\lambda_b-\lambda),\ \cos\varphi\,\sin\varphi_b - \sin\varphi\,\cos\varphi_b\,\cos(\lambda_b-\lambda)\big)
```

The same two formulas serve both bodies. Use (φₛ, λₛ) for the Sun and (φₑ, λₑ) for Earth.

**Earth correction**

The formula above measures from the Moon's centre. Earth is close enough that the site's position matters, so Earth's elevation is corrected to the site using the Earth–Moon distance D:

```latex
el_{\text{site}} = \operatorname{atan2}\big(D\,\sin(el) - r_s,\ D\,\cos(el)\big),\qquad r_s = R + h_{\text{site}} + h_{\text{above ground}}
```

Azimuth is unchanged. The correction is largest when Earth is on the horizon, about 0.25°, and falls to zero when Earth is overhead; in the Apollo 11 check it was 0.11°. Near the pole Earth crosses the skyline slowly, so leaving the offset in can shift Earthrise or Earthset by hours. The Sun needs no correction.

**Behaviour at the south pole**

| Body | Sub-point latitude range | Elevation at the pole | Motion |
| --- | --- | --- | --- |
| Sun | about ±1.5° | never above about 1.5° | Circles the horizon once every 29.5 days, about 0.5° per hour |
| Earth | about ±6.7° | between about +6.7° and −6.7° | Stays near one direction and bobs up and down about every 27 days |

**Simplifications**

- The Sun's direction is taken from the Moon's centre, not the site. The measured error is about 0.0005°.
- Bodies are treated as points. The Sun is about 0.53° wide and Earth about 1.9° wide. In the first version, visible means the body's centre is above the skyline.
- North is undefined at exactly 90°S, but the azimuth formula still works there: it reduces to az = λ\_b − λ. Taking λ = 0 measures azimuth from the 0° longitude line, which is also the direction that points straight up from the pole on the LOLA south-polar maps.

## Layer 2: horizon

Layer 2 decides whether terrain blocks a body, using a horizon mask H(az): the skyline angle in each compass direction from the site.

**Visibility rule**

```latex
\text{visible}(t) = 1 \ \text{if}\ el(t) > H(az(t)),\ \text{else}\ 0
```

On a smooth sphere H is 0 everywhere, so layer 1 alone is the special case with no terrain.

**Computing the mask**

1. Take every map cell within a fixed, generous distance of the site: 200 km to start. Widen it and confirm the mask stops changing.
2. For each cell, compute its distance and azimuth from the site on the sphere, and its angle above the site's level.
3. Sort the cells into azimuth bins, 1° wide to start, and keep the largest angle in each bin. H is constant inside a bin.
4. If the search area runs past the edge of the map, flag the mask as incomplete. Missing terrain is never treated as open sky.

```latex
\text{angle} = \operatorname{atan2}\big(r_p\cos\delta - r_s,\ r_p\sin\delta\big),\qquad r_s = R + h_{\text{site}} + h_{\text{mast}},\quad r_p = R + h_{\text{point}},\quad \delta = d/R
```

Here d is the ground distance to the cell and the formula is exact on a sphere. Using every cell, instead of walking along rays, means a narrow peak cannot slip between two rays. For intuition, at short distances the angle in radians is close to (h\_point − h\_site)/d − d/(2R): rise over run, minus the Moon's curvature. At 50 km the curvature term is about 0.82°, the same as a 0.7 km drop in height.

Two biases remain and need testing. Keeping the highest angle in a bin spreads a narrow peak across the whole bin, which overstates shadow. A ridge smaller than a map pixel is missed, which overstates light. Finer bins and a finer map reduce both.

**Working figures**

| Quantity | Value |
| --- | --- |
| Azimuth bin | 1° to start, finer later |
| Search distance | 200 km to start, confirmed by widening it |
| Map, first version | LOLA LDEM\_60S\_240M at 240 m per pixel, cropped to 78°S: about 3,000 × 3,000 pixels, around 18 MB at 16 bits per pixel. This gives full 200 km coverage for sites from 85°S to the pole. |
| Finer maps | LOLA 80°S products at 80, 40 and 20 m per pixel; 10 m and 5 m closer to the pole |
| Frame of the LOLA polar maps | MOON\_ME, the same as our Horizons runs; heights measured from a 1,737.4 km sphere |
| Map cells per site at 240 m | about 2.2 million within 200 km |

**Properties**

- The mask does not depend on time. It is computed once per site and height above ground, and cached with the map product and settings used.
- One routine, `mask(site)`, serves curated sites and custom coordinates.
- An observer 1 km above a smooth reference surface sees the horizon dip about 1.9°, more than the Sun's 1.5° maximum elevation at the pole. Height buys light, unless taller terrain further out sets the skyline.
- The visibility function returns a number, 0 or 1 for now, so a visible fraction of the disk can replace it later without changing anything downstream.

## Layer 3: events

Layer 3 finds the moments a body rises or sets inside the mission window, and from them the windows and the time remaining.

**Margin function**, one per body:

```latex
g(t) = el(t) - H(az(t))
```

The body is visible when g > 0. An event is a change in visibility: a rise when the body becomes visible, a set when it stops being visible. Because H is constant inside each bin and jumps at bin edges, visibility can change at a bin edge without g ever equalling zero.

For communication, the planner's minimum margin m is subtracted, and every communication output uses this one function:

```latex
g_{\text{comm}}(t) = el_{\text{Earth}}(t) - H(az_{\text{Earth}}(t)) - m
```

Plain Earthrise and Earthset, with m = 0, are reported separately and labelled as such.

**Finding events**

1. Find the times at which the body's azimuth crosses each bin edge during the mission window. These split the window into segments, each inside one bin.
2. At each bin edge, compare visibility just before and just after. A change there is an event at that time.
3. Inside a segment, sample g at steps of no more than 1 hour. Where the sign changes, find the crossing by bisection.

This bin-by-bin walk finds every event the mask can represent. Inside a segment, g changes only through the body's elevation, which moves slowly and smoothly, at most about 0.5° per hour, so it cannot dip and recover between two hourly samples. Sudden changes come from the skyline, and those are caught at the bin edges.

The shortest outage the method can resolve is the time a body takes to cross one bin: about 2 hours for the Sun with 1° bins, 30 minutes with 0.25° bins. Event-time accuracy is a target to be confirmed by tests, not a known figure. Where a body grazes the skyline at a shallow angle, a small error in angle becomes a large error in time and can create or remove a whole window. Three things are reported separately: the search tolerance, the sensitivity to map and bin resolution, and agreement with an independent reference.

**Outputs**

- Event list: time, body, rise or set.
- Windows: each stretch from a rise to the next set, with its duration.
- Time remaining: time to the next set if the body is up, or to the next rise if it is down.
- Joint windows: stretches where the Sun and Earth are both visible.
- Summary over the mission window: longest unbroken sunlight, share of time sunlit, longest darkness, longest communication blackout.

**Flicker rule**

A Sun skimming a jagged skyline dips behind small peaks repeatedly. Dips shorter than the flicker threshold are merged into one window, and the tool says so:

- Raw intervals are kept and used for every power figure. Merged intervals are for display.
- Longest sunlight is reported both ways: raw and merged.
- Each merged window carries a note, such as "3 dips under 1 hour merged".
- The planner can expand a window to see every dip.
- The threshold is shown and adjustable. Communication has its own threshold.

**Edge cases**

- No event inside the window: report "no sunset within the mission window". This does not mean none follows soon after.
- Body already up at the start: the window began outside the evaluated interval and is marked that way.

## Layer 4: metrics

Layer 4 turns visibility into a hardware-free scorecard of power and communication numbers for one site, landing date and mission length.

**Power**

The lander carries its own solar panels. Power is reported as a power factor from 0 to 1, the share of the panel's head-on output:

```latex
\text{power factor}(t) = \text{visible}_{\text{Sun}}(t) \times \cos(\text{incidence angle})
```

The incidence term depends on the panel type, which the planner must choose:

| Panel type | cos(incidence) | At 45° elevation | At 1.5° elevation (pole) |
| --- | --- | --- | --- |
| Flat on the deck | max(0, sin(el)) | 0.71 | 0.03 |
| Vertical, Sun-following | cos(el) | 0.71 | 1.00 |
| Vertical, fixed facing azimuth a | max(0, cos(el) × cos(az − a)) | depends on a | swings between 0 and 1 |

At the pole, elevation matters mainly through visibility. The panel type decides the rest.

- **Equivalent full-sun hours:** the power factor integrated over the visible intervals with the trapezoid rule. Intervals end at events, so the sum never runs across a jump in visibility. It measures head-on sunlight time, not energy.
- **Longest terrain darkness:** the longest stretch with the Sun blocked, from layer 3.
- **Longest zero-power interval:** the longest stretch with a power factor of zero for the chosen panel. It can be longer than terrain darkness, because a fixed panel can face away from a visible Sun.

These are screening figures. Sizing a battery needs a load and storage model, which is outside this model.

**Communication**

```latex
\text{comm}(t) = 1 \ \text{if}\ g_{\text{comm}}(t) > 0,\ \text{else}\ 0
```

This is geometric direct-to-Earth visibility: Earth's centre clears the skyline by the chosen margin. It does not model antennas, link budgets, or whether a ground station is facing the Moon or booked.

**Scorecard**

| Metric | From |
| --- | --- |
| Sun elevation now, and peak during the mission | Layer 1 |
| Time to next sunset | Layer 3 |
| Equivalent full-sun hours | Layer 4 |
| Longest darkness | Layer 3 |
| Earth elevation now | Layer 1 |
| Time to next Earthset | Layer 3 |
| Share of mission with Earth visible | Layer 4 |
| Longest communication blackout | Layer 3 |
| Share of mission with Sun and Earth visible together | Layers 3 and 4 |
| Longest zero-power interval for the chosen panel | Layer 4 |

## Layer 5: decision

Layer 5 organises many scorecards so a planner can choose when and where to land. It adds no new physics. The ranking method and slip tolerance were decided on 15 November 2026.

**Candidates**

```latex
\text{candidates} = \text{sites} \times \text{landing dates}
```

The mask is computed once per site and the Sun and Earth positions are shared by all sites. Ten sites × 90 dates × a 10-day mission at hourly steps is about 216,000 evaluations.

**Hard constraints**

The planner sets pass or fail thresholds, for example:

- Sun and Earth both visible at touchdown.
- Longest darkness no more than X hours.
- Earth visible for at least Y% of the mission.
- At least Z equivalent full-sun hours.

Failed candidates stay visible, marked with the constraint they failed and by how much.

**Ranking**

| Method | How it works | Strength | Weakness |
| --- | --- | --- | --- |
| Sort by one metric | Planner picks a scorecard column | Obvious, no hidden maths | Ignores the other metrics |
| Weighted score | Metrics scaled 0 to 1, weighted by the planner, summed | One number per candidate | Weights are arbitrary and hide trade-offs |
| Non-dominated set | Keep every candidate that no other candidate beats on all metrics | Shows real trade-offs, needs no weights | Can leave many candidates |

Decided: a sortable table, with a mark on each non-dominated candidate. The mark is computed only among candidates that pass every hard constraint. Higher is better for full-sun hours, Earth-visible share, joint share and slip tolerance; lower is better for longest darkness and longest blackout. Local changes per day do not count towards the mark. One candidate beats another when it is at least as good on every one of these and better on at least one. Early and late slip tolerance count as two separate objectives. A weighted score can follow later.

**Slip tolerance and rate of change**

```latex
\text{slip tolerance} = (-\,\text{early days},\ +\,\text{late days})\ \text{to the first hard-constraint failure in each direction}
```

Early and late tolerance are reported separately, such as "−3/+9 days". Each is the unbroken run of passing dates from the candidate to the first failure in that direction, on the landing-date grid. If no failure occurs inside the date range, it is reported as "at least N days". It reuses neighbouring dates already in the candidate grid. The spatial version, for a lander missing its target point, needs extra masks and is left for later.

Tolerance is only as fine as the date grid. A result is worded as "passes through +8 days on the daily grid; first sampled failure at +9 days", because the times between grid dates are untested.

Slip tolerance is in the first version, paired with a local change per day for each metric m at landing date t₀:

```latex
\text{local change per day} \approx \frac{m(t_0 + \Delta) - m(t_0 - \Delta)}{2\Delta}
```

Δ is the date step setting, 1 day to start. At the ends of the date range a one-sided difference is used. The local change says how fast a metric moves per day of delay; slip tolerance says how long until it fails. The two are always shown together, such as "losing 2 full-sun hours per day, fails after 9 days". Metrics at the pole are not smooth: a candidate can lose almost nothing per day and then fail overnight when the Sun's path drops behind a ridge, so the local change alone would mislead.

**Comparison grid**

Rows are sites and columns are landing dates. Each cell is coloured by a metric the planner picks, with failed cells marked. Reading across a row compares dates for one site; reading down a column compares sites for one date. Selecting a cell opens its scorecard and sky view.

## Decisions log

Fourteen decisions are settled as of 15 November 2026.

| Layer | Decision | Choice |
| --- | --- | --- |
| Framing | What the model is | An evaluation function F; "when and where to land" is a search over it, with the south pole as the primary case |
| 2 | How masks are produced | Computed live for any coordinate by one routine, then cached |
| 2 | Visibility output | Visible or blocked first; visible fraction of the disk once the pipeline works |
| 3 | Period searched for events | The mission window: landing date plus mission length |
| 3 | Flicker | Merge short dips, and state the merge explicitly to the planner |
| 4 | Panel type | The planner must choose; no default |
| 4 | Units | Hardware-free: power factor and hours, no watts or battery sizes |
| 5 | Ranking | Sortable table with a mark on non-dominated candidates; no weighted score in the first version |
| 5 | Slip tolerance | In the first version, shown together with the rate of change per day of delay |
| 1 | Earth's direction | Corrected from the Moon's centre to the site in the first version, using the Earth–Moon distance |
| 2 | Height above ground | A planner input for the panels and antenna, added to the site's height in the mask |
| 5 | Slip tolerance format | Early and late reported separately, each counted to the first failure |
| 3 | Event detection | Bin-by-bin walk through the mask, in place of fixed time sampling alone |
| 2 | Number of heights | One height above ground for both panels and antenna in the first version |

## Open questions

Four questions are still open. None blocks the model.

- [ ] Educators and the public cannot choose a panel type. Show them sunlight hours only, or all three panel types side by side?
- [ ] What mission window and date range does the tool show before the planner has entered anything?
- [ ] Is 200 km a long enough search distance everywhere near the pole? Widen it and check that the mask stops changing.
- [ ] How large an error do we accept in each layer's tests?

## Assumptions, limits and verification

The model judges power and communication only. The tool should say "passes the chosen sunlight and Earth-visibility constraints", never "safe to land".

**Not modelled**

- Landing safety: slopes, rocks, dust.
- Science value of a site.
- Temperature of the lander and its equipment.
- Whether a launch and trajectory can reach the site on a given date.
- Ground station availability on Earth, antennas and link budgets.
- Earth passing in front of the Sun, which people on Earth see as a lunar eclipse.
- Battery sizing: the power figures are for screening only.

**Known accuracy limits**

| Source of error | Effect | Planned fix |
| --- | --- | --- |
| 240 m per pixel map | Misses boulders and small ridges near the lander, which overstates light | 20 m LOLA map for the area around a site |
| 1° azimuth bins | Spreads a narrow peak across the bin, which overstates shadow; Sun outages shorter than about 2 hours are not resolved | Finer bins, such as 0.25° |
| Bodies as points | Partial Sun counted as all or nothing | Visible fraction of the disk, with a stated rule for what counts as sunrise |
| Slip tolerance on a date grid | Times between grid dates are untested | Finer date step around the first failure |
| Sun direction from the Moon's centre | Sun elevation off by about 0.0007° | None needed; Earth is already corrected in layer 1 |

**Verification targets**

- Layer 1: done at an equatorial and a polar site, results below. Repeat at more latitudes and dates, and record the exact Horizons settings with each check.
- Layer 2: synthetic terrain with known answers: a smooth sphere, an observer raised above a sphere, a site below the reference height, a single ridge, and a lone narrow peak to measure the bin-spreading bias. Widen the search distance until the mask stops changing.
- Layer 3: masks with known events: a one-bin-wide peak that blocks the Sun for less than an hour, a visibility change exactly at a bin edge, and a positive communication margin. An equatorial site should show about 14.77 days of light, then about 14.77 days of dark.
- Layer 4: a constant power factor, where the integral is exact, and a fixed panel facing away from a visible Sun.
- Layer 5: a hand-built grid that tests the mark, failed constraints, and uneven early and late slip tolerance.
- Whole model: sunlight at south-pole sites against NASA's south-pole illumination visualisation for 2026, rendered every two hours, matching its height, time span and definition of "lit". The LOLA-based illumination maps average over 18.6 years, so they serve as a long-run sanity check only.

**Verification results**

Layer 1 passed its first check on 15 November 2026: Apollo 11 (0.67408°N, 23.47297°E) at 12:00 UTC, against JPL Horizons run for the same site. Horizons used the Moon's mean-Earth frame.

| Quantity | Our formula | Horizons | Difference |
| --- | --- | --- | --- |
| Sun elevation | 5.1117° | 5.1113° | 0.0005° |
| Sun azimuth | 91.6232° | 91.6232° | under 0.0001° |
| Earth elevation, uncorrected | 63.1573° | 63.0432° | 0.114° |
| Earth azimuth | 274.6537° | 274.6539° | 0.0002° |

The Earth elevation gap is the centre-to-site offset. With the Earth correction and the actual Earth–Moon distance at that time (403,931 km), the formula gives 63.0456°, which is 0.0024° from Horizons.

Layer 1 passed a second check the same day at a south-pole site: 89.45°S, 222.69°E, on the ridge next to Shackleton crater, at 12:00 UTC.

| Quantity | Our formula | Horizons | Difference |
| --- | --- | --- | --- |
| Sun elevation | 1.3297° | 1.3290° | 0.0007° |
| Sun azimuth | 245.6380° | 245.6378° | 0.0002° |
| Earth elevation, uncorrected | −3.0834° | −3.3296° | 0.246° |
| Earth elevation, corrected | −3.3294° | −3.3296° | 0.0003° |
| Earth azimuth | 133.9837° | 133.9813° | 0.0024° |

The formulas hold near 90°S, and the Earth correction removes the 0.246° offset. Both checks ignore terrain, as Horizons does. Layers 2 and 3 are not yet verified.

## Sources

- [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html): sub-solar and sub-observer points, and the Horizons API.
- [A New View of the Lunar South Pole from LOLA](https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf): LOLA polar map products, pixel scales and the MOON\_ME frame.
- [LRO LOLA gridded shape maps](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/LOLA/GDR/GDRDEM.htm): product names, sizes and the 1,737.4 km reference radius.
- [Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69): LOLA-based illumination and Earth-visibility maps at 240 m per pixel.
- [Illumination at the Moon's South Pole to 80°S, 2025 to 2028](https://svs.gsfc.nasa.gov/5027): NASA visualisation at two-hour intervals.
