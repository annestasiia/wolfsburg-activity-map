# CLAUDE.md — Wolfsburg Activity Map

Briefing for any session (human or AI) working on this repo. Read this, then skim
[`README.md`](README.md) for the user-facing overview and [`docs/MODES.md`](docs/MODES.md) for the
analytical detail behind each mode.

---

## What this is

A client-only React app that runs OpenStreetMap-based spatial analysis for the **Post-Car Future of
Wolfsburg** project. Everything runs in the browser — no backend, no API keys (the basemap and OSM
APIs are keyless).

**Stack:** React 18 · Vite 5 · MapLibre GL JS 4 · Zustand 4 (state) · Tailwind 3 · SheetJS/`xlsx`
(Excel) · `osmtogeojson`. ES modules (`"type": "module"`).

## Run / build / deploy

```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # → dist/
npm run preview   # serve the build
```

Deploy is automatic: **push to `master`** → `.github/workflows/deploy.yml` builds and publishes
`dist/` to GitHub Pages. There is no other deploy path.

---

## Architecture

`src/App.jsx` is the router. It loads bundled data into the store on startup and then renders UI
conditionally on two pieces of store state:

- **`activeSection`** — the top-level section chosen in the right-hand nav
  (`null` | `strategy` | `capacity` | `hub` | `geo` | `urban` | `simulation`).
- **`activeMode`** — the active tool *within* the Hub System section
  (`mobility` | `facilities` | `greenery` | `intermodal` | `rad` | `hub-network`).

`RightNav.jsx` sets these. `MapView.jsx` owns the MapLibre map and all layers (and the satellite
"Earth" toggle). The single source of truth for everything else is the Zustand store
(`src/store/appStore.js`).

> Note: the older "flat top-bar of 7–8 modes" framing is gone. The current information
> architecture is the **5 numbered sections** below; the OSM analysis modes live *inside* the Hub
> System section.

### Code-map — section / mode → component(s) → algorithm

| Section (`activeSection`) | Mode (`activeMode`) | Main component(s) | Core logic |
|---|---|---|---|
| `strategy` (01 Post-Car Strategy) | — | `StrategyPanel.jsx` | static narrative |
| `capacity` (02 Capacity Analysis) | — | `DataPanel.jsx` | `utils/fleetCalc.js`, `utils/capacityCalc.js` |
| `geo` (03 → Geo Data Analysis) | `mobility` | `MobilityLeftBar.jsx`, `MobilityToolbar.jsx`, `TransportPoolPanel.jsx` | mobility scoring in `hooks/useDistricts.js` + `utils/geoUtils.js` |
| `geo` | `facilities` | `LeftSidebar.jsx`, `VenuePopup.jsx` | `hooks/useVenues.js`, `utils/parseExcel.js`, `utils/parseHours.js`, `utils/geocode.js` |
| `geo` | `greenery` | `GreenerySidebar.jsx` | `hooks/useGreenSocialData.js` → `utils/greenSocialAnalysis.js`, `utils/greeneryConfig.js` |
| `hub` (03 → Hubs Placement) | `intermodal` | `IntermodalSidebar.jsx`, `IntermodalHubPopup.jsx` | `utils/intermodalAlgorithm.js` |
| `hub` | `rad` | `RadSidebar.jsx`, `RadNodePopup`/`RadEdgePopup` | `utils/radAlgorithm.js` |
| `hub` | `hub-network` | `CapacitySidebar.jsx`, `HubLMDataPanel.jsx`, `HubLMHubPopup.jsx` | `utils/hubLMAlgorithm.js`, `utils/capacityCalc.js` |
| `urban` (04 Urban Design) | — | `UrbanDesignPanel.jsx` | `data/hubLayouts.js`, `data/hubElements.jsx` |
| `simulation` (05) | — | placeholder in `App.jsx` | 🚧 not built yet |

Supporting pieces:
- **`src/components/panels/`** — info/stat panels (`MobilityPanel`, `FacilitiesPanel`,
  `GreeneryPanel`, `GreenSocialPanel`, `HubStatsPanel`, `StatsPanel`, `TimePanel`,
  `DistrictsPanel`, `AnalysisInfoModal`).
- **`src/hooks/`** — `useDistricts`, `useVenues`, `useFilters`, `useGreenSocialData`.
- **`src/data/*.json`** — bundled OSM extracts loaded at startup (venues, districtBoundaries,
  parks, water, forest, buildings).
- **`public/*.geojson`** — runtime-fetched layers (roads, footways, bus_stops, car_parking,
  bike_parking, facilities, historic, parks_forests, cycling).
- **`src/mapStyle.json`** — palette/reference only. The *actual* basemap is the `MAP_STYLE`
  constant in `MapView.jsx` (**CARTO positron** — keep these in mind; the JSON note is stale).

---

## Data-refresh guide

Two independent pipelines feed the app. Re-run them only when the underlying data should change.

**1. OSM geodata → `public/*.geojson` and `src/data/*.json`** (Node scripts in `scripts/`):

```bash
node scripts/fetch-districts.cjs    # district boundaries
node scripts/fetch-transit.cjs      # bus stops / transit
node scripts/fetch-cycling.cjs      # cycling network
node scripts/fetch-parks.cjs        # parks
node scripts/fetch-forest.cjs       # forest
node scripts/fetch-water.cjs        # water/canals
node scripts/fetch-buildings.cjs    # buildings
node scripts/convert-venues.cjs     # Excel → venues.json
```
(`.mjs` variants — `downloadWolfsburgData.mjs`, `downloadCyclingOnly.mjs`, etc. — are bulk/legacy
equivalents.) These hit the Overpass API; mind its rate limits.

**2. Fleet & hub numbers → `analysis/outputs/`** (Python, run in order — each depends on the prior):

```bash
cd analysis
python modal_distribution.py    # baseline modal split → results_baseline.csv
python fleet_calculation.py     # fleet sizing → results_fleet.csv
python hub_calculation.py       # per-hub infrastructure → results_hubs.csv
python hub_area.py              # footprint breakdown + charts
```
Outputs (CSV + PNG charts) land in `analysis/outputs/` and back the Capacity Analysis dashboard.

---

## Conventions

- **State:** put shared state in `src/store/appStore.js` (Zustand). Components read/derive from it;
  avoid prop-drilling or duplicate local copies of map/analysis state.
- **Maps:** all layer add/remove/style goes through `MapView.jsx`. Mode-driven layer visibility is
  toggled there based on `activeSection`/`activeMode`.
- **Caching:** geocoding + boundary results are cached in `localStorage` under `wolfsburg_*` keys.
  Respect Nominatim's 1 req/sec and Overpass rate limits.
- **No secrets / no keys.** Keep it keyless (CARTO positron + OSM APIs).

## Branch / PR workflow

- Branch per piece of work: **`topic-YYYY-MM-DD`** (e.g. `hub-sidebar-2026-06-20`).
- Commit style follows the existing history: **conventional commits** — `feat(...)`, `fix(...)`,
  `style(...)`, `docs(...)`.
- Push the branch and **open a PR to `master`** for the team (3 people) to review.
- Merging to `master` auto-deploys (see above). Keep `master` releasable.

## Pointers

- [`README.md`](README.md) — human-facing overview & setup.
- [`docs/MODES.md`](docs/MODES.md) — deep, per-analysis reference (methods & algorithms).
- The surrounding **Post-Car Future of Wolfsburg** design workspace (its `CLAUDE.md` / `HANDOFF.md`)
  for project goals, deadlines, and locked decisions. This tool is an instrument, not the final
  deliverable.
