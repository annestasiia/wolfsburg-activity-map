# Analysis Reference — Wolfsburg Activity Map

The detailed reference for every analysis the tool performs: what question it answers, what you see,
and how the algorithm works. This is the **canonical, code-adjacent** version (it used to live in the
design workspace's `web-tool/status.md`).

The tool is organised into **five numbered sections** (right-hand nav). The OpenStreetMap analyses
live inside the **Hub System** section. For the code wiring (which component/algorithm implements
each), see [`../CLAUDE.md`](../CLAUDE.md).

- 01 — Post-Car Strategy
- 02 — Capacity Analysis *(fleet & hub numbers — the quantitative proof)*
- 03 — Hub System
  - Geo Data Analysis → **Mobility**, **Facilities**, **Greenery (+ social vitality)**
  - Hubs Placement Algorithm → **Intermodal Hub**, **Rad Network**, **Hub L/M/S Network**
- 04 — Urban Design
- 05 — Operational Simulation *(in development)*

Basemap: **CARTO positron** (`basemaps.cartocdn.com`, no API key). A satellite layer can be toggled
on top for any map analysis.

---

## 01 — Post-Car Strategy

A slide-style narrative panel (`StrategyPanel.jsx`) that frames the overall vision: a city where
private car ownership is obsolete, replaced by shared, electric, autonomous, on-demand mobility
organised around hubs rather than parking. No computation — it is the argument's opening.

---

## 02 — Capacity Analysis (fleet & modal proof)

A dashboard (`DataPanel.jsx`) presenting the three Python calculations from `analysis/`.

### A — Modal distribution (baseline)
How Wolfsburg moves today. Inputs: 17,400 residents, 18,000 workers (mainly VW), 7,080 daily
visitors; modal share from MiD 2017 adjusted for Wolfsburg's car dependency (≈62% car / 20% walk /
10% transit / 8% cycle). Outputs: ~104,100 daily trips, ~64,500 car trips, ~49,648 private vehicles
in motion daily, peak hour 08:00–09:00 with ≈8,983 trips. The 8am peak is the binding design
constraint; the 62%-car / 8%-cycle gap is what the project closes.

### B — Fleet sizing (the proof)
How many *shared* vehicles the post-car scenario needs. Assumes 60% of internal short trips become
walking (no car at the door), leaving ~42,000 trips needing a vehicle; peak-hour demand is split
across modes. Core formula: per mode, `trips ÷ capacity × avg trip-duration(h)` gives vehicles in
motion simultaneously; add a 15–35% reserve (charging/maintenance) for fleet total.
Result (~1,273 vehicles): ~408 e-bikes, 71 shuttle pods, 44 autonomous buses, 438 micro-pods,
210 car-sharing EVs. The headline: **49,648 private cars → ~1,273 shared vehicles** (one shared
vehicle ≈ 39 private cars, because shared vehicles circulate instead of parking 95% of the time).

### C — Hub infrastructure sizing
How much space/charging each hub tier needs, given the fleet and the rule that L-hubs hold buses +
car-sharing, M-hubs hold shuttles + pods, S-hubs hold e-bikes. Yields per-tier vehicle counts,
charging points (~50 / ~25 / ~15) and footprints (~600 / ~120 / ~35 m²). Total network footprint
≈ 8,400 m² — **< 0.25% of the centre**, versus surface parking's >10%. That is the land-efficiency
argument.

These chain: `modal_distribution.py → fleet_calculation.py → hub_calculation.py / hub_area.py`.

---

## 03 — Hub System

### Geo Data Analysis

#### Mobility — connectivity to the centre
**Question:** how well-connected is each district to the city centre? **You see:** every Wolfsburg
district shaded dark→bright by connectivity, with sub-layers for Public Transport, Automobile,
Cycling, Walking.

**How:** fetches the road/route network from OSM and counts, per district, how many routes physically
connect it to the centre (the 9 central neighbourhoods: Stadtmitte, Schillerteich, Rothenfelde,
Wohltberg, Volkswagenwerk, Alt-Wolfsburg, Hellwinkel, Heßlingen, Hohenstein). A route counts only if
it has a point inside the district *and* a point reaching the centre. Raw counts rescale to 1–10.
Comparing cycling/transit against the automobile baseline exposes the mobility gap — districts that
score 8 for cars but 2 for cycling are priority zones.

#### Facilities — venues and activity over time
**Question:** where are venues, and when are they busy? **You see:** coloured dots (Blue = schools,
Purple = culture, Green = leisure, Amber = commercial) whose size/brightness change with the
day-and-time slider.

**How:** venue data comes from a team **Excel** upload (see README for the column format). Each address
is geocoded via Nominatim (cached in `localStorage`) and placed on the map. The time slider scales
each dot by that venue's activity at the chosen time — 7am weekday reveals the VW commuter surge;
Friday 6pm lights up leisure. Overlaying venues on hub locations checks whether hubs sit where people
actually go.

#### Greenery + social vitality
**Greenery layers:** all green/natural OSM features within the city boundary, classified into 8
toggleable categories (Parks, Grass, Forests, Agriculture, Vegetation, Individual plants, Protected
areas, Network/waterways). The canal network matters for the canal-side parking-lot transformation.

**Social-vitality scoring** (`utils/greenSocialAnalysis.js`) shades districts by one of four scores:
- **Green Coverage** — % of district area under parks/forest, via Sutherland–Hodgman polygon
  clipping (exact overlap, not just touching), normalised 1–10.
- **Social Density** — weighted count of social amenities (playgrounds ×5, sports pitches ×4,
  cafés/seating ×3, benches/fountains/BBQ/shelters/toilets ×1) ÷ district area, normalised 1–10.
- **Green Accessibility** — reachability of quality green *from* the district (inside = 3 pts,
  just-outside/short-walk = 1 pt), so a park-poor but park-adjacent district can still score.
- **Encounter Potential** — composite: 35% green coverage + 30% social density + 20% transit access
  + 15% pedestrian-path density. Low scores mark where converting parking to pocket parks/benches
  would have the most impact.

### Hubs Placement Algorithm

#### Intermodal Hub — where hubs should go
**How** (`utils/intermodalAlgorithm.js`), five steps:
1. **Candidates** — every OSM bus stop and car-parking location (places where a hub *could* go).
2. **Score** each by surrounding activity: venues within 1,500 m weighted by foot-traffic; parks
   within 500 m (+); existing bike parking within 300 m (+); residential buildings within 300 m (small +).
3. **Spread** via a density filter so hubs don't cluster downtown: top-30% hubs block others within
   400 m, mid-40% within 700 m, bottom-30% within 1,200 m — pushing coverage outward.
4. **Merge** a bus stop + car park within 200 m into one hub (keep the higher score) — real
   intermodal behaviour.
5. **Priority** — above-median = "priority" (build first); below = "potential" (later phases).

This ranks hubs by the activity they'd actually serve; the 68-hub count (6 L + 19 M + 43 S) came from
classifying these results.

#### Rad Network — the cycling network
**How** (`utils/radAlgorithm.js`):
1. **Graph** — every intersection/road segment becomes a weighted graph; cost scales with
   bike-friendliness (cycleways ×0.5, residential/footpath ×0.7, minor ×1.0, secondary ×1.5,
   primary ×2.0, motorway/trunk ×3.0).
2. **Destinations** in tiers — Order 1 (hubs, Hauptbahnhof, neighbourhood centres = backbone);
   Order 2 (top-30% venues + historic sites); Order 3 (remaining bike parking, bus stops).
3. **Routes** via **Dijkstra** (true shortest *cost* path — it detours to use protected cycleways):
   Type A (dark green) village→centre arterials; Type B (medium) hub-to-hub (3 nearest) + village→
   nearest hub; Type C (light) historic→nearest hub.
4. **Flag gaps** — segments on unprotected major/secondary roads are drawn **dashed** = "needs
   infrastructure." The dashed lines are the priority streets for transformation.

#### Hub L/M/S Network — capacity & infrastructure
`CapacitySidebar.jsx` + `HubLMDataPanel.jsx` (`utils/hubLMAlgorithm.js`, `utils/capacityCalc.js`)
visualise the per-tier fleet distribution and infrastructure sizing from Calculation C above, mapped
onto the actual L/M/S hub network.

---

## 04 — Urban Design

`UrbanDesignPanel.jsx` — interactive hub typologies / kit-of-parts (data in `data/hubLayouts.js`,
`data/hubElements.jsx`). Shows what each hub tier is physically made of.

## 05 — Operational Simulation

Placeholder — *in development*. Intended to animate the fleet handling the VW shift-wave (~10k
workers in ~1 hour) across the hub network.

---

## Data sources summary

| Data | Source | Update |
|------|--------|--------|
| District boundaries, venues, parks, water, forest, buildings | Pre-processed JSON in `src/data/` | Static (regenerate via `scripts/`) |
| Roads, footways, bus/bike/car parking, facilities, historic, cycling, parks/forests | `public/*.geojson` (pre-fetched OSM) | Static (regenerate via `scripts/`) |
| Venue activity & hours | Team Excel, geocoded via Nominatim | Manual |
| Population & mobility stats | MiD 2017 + VW workforce data | Static (`analysis/`) |
| Base map tiles | CARTO positron | Live |

See [`../CLAUDE.md`](../CLAUDE.md) for how to re-run the `scripts/` (OSM) and `analysis/` (Python)
pipelines.
