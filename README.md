# Wolfsburg Activity Map

An interactive browser tool for the **Post-Car Future of Wolfsburg** urban-design project. It pulls
geographic data from OpenStreetMap, runs spatial-analysis algorithms in the browser, and visualises
the results on a map — to help design and *prove* a city organised around mobility hubs instead of
parking.

Built with **React 18 + Vite**, **MapLibre GL JS**, **Zustand**, and **Tailwind CSS**. No backend.

> Detailed, per-analysis documentation (what each tool measures and how the algorithm works) lives in
> **[`docs/MODES.md`](docs/MODES.md)**. Architecture and contributor guidance for future work
> (including AI-assisted sessions) live in **[`CLAUDE.md`](CLAUDE.md)**.

---

## Quick start

```bash
npm install      # first time only
npm run dev      # starts Vite dev server
```

Open the address it prints (usually <http://localhost:5173>).

```bash
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

## Deployment

Pushing to the **`master`** branch triggers `.github/workflows/deploy.yml`, which runs
`npm ci && npm run build` and publishes `dist/` to **GitHub Pages**. No manual deploy step.

---

## What's in it — the five sections

The app opens on a landing pitch; pick a section from the right-hand navigation. The numbered
sections are:

| # | Section | What it does | Status |
|---|---------|--------------|--------|
| 01 | **Post-Car Strategy** | Slide-style narrative of the overall vision. | ✅ |
| 02 | **Capacity Analysis** | Fleet-sizing / modal-distribution dashboard (the quantitative proof). | ✅ |
| 03 | **Hub System** | The map-analysis toolkit, with two sub-areas (below). | ✅ |
| 04 | **Urban Design** | Interactive hub typologies / kit-of-parts. | ✅ |
| 05 | **Operational Simulation** | Fleet-in-motion simulation. | 🚧 In development |

**Hub System → Geo Data Analysis** (the OpenStreetMap analysis modes):

- **Mobility** — district connectivity to the centre, by transport / car / cycling / walking.
- **Facilities** — venues and their activity by time of day (from the team Excel).
- **Greenery** — green-space layers + a social-vitality scoring of each district.

**Hub System → Hubs Placement Algorithm:**

- **Intermodal Hub** — scores and places candidate hubs across the city.
- **Rad Network** — Dijkstra-based cycling network connecting hubs and centres; flags missing
  infrastructure.
- **Hub L/M/S Network** — hub-tier capacity, fleet distribution, and infrastructure sizing.

A satellite ("Earth") basemap can be toggled under the map UI for any of the analysis modes.

See **[`docs/MODES.md`](docs/MODES.md)** for the full method behind each one.

---

## Data

| Data | Source | Loaded |
|------|--------|--------|
| District boundaries, venues, parks, water, forest, buildings | Pre-processed JSON in `src/data/` | Bundled, loaded on startup |
| Roads, footways, bus stops, car/bike parking, facilities, historic sites, cycling, parks/forests | `public/*.geojson` (pre-fetched from OSM) | `fetch()` on startup |
| Venue activity & hours | Team **Excel** (`.xlsx`), geocoded via Nominatim | Manual upload (Facilities) |
| Population & mobility stats | MiD 2017 + VW workforce data | Static, in `analysis/` |
| Base map tiles | **CARTO positron** (`basemaps.cartocdn.com`, no API key) | Live |

To refresh the OSM extracts or regenerate the fleet/hub numbers, see the **Data-refresh guide** in
[`CLAUDE.md`](CLAUDE.md).

### Excel file format (Facilities mode)

The app expects an `.xlsx` with data starting on **row 4** (rows 1–3 are headers/metadata):

| Col | Field | | Col | Field |
|-----|-------|-|-----|-------|
| A | District | | I | Activity intensity |
| B | Category | | J | Age groups |
| C | Name | | K | Google rating |
| D | Type | | L | Notes |
| E | Street address | | M–S | Mon…Sun activity (`—`/`Low`/`Med`/`High`) |
| F | City | | | |
| G | Opening hours (free text) | | | |
| H | Peak times | | | |

Addresses are geocoded via Nominatim (1 req/sec) and cached in `localStorage`.

### Resetting cached data

```js
// Browser console:
localStorage.removeItem('wolfsburg_geocache_v1')   // forces re-geocode on next upload
// District boundary caches are keyed 'wolfsburg_boundary_v1_<DistrictName>';
// clear the whole app's localStorage to reset everything:
Object.keys(localStorage).filter(k => k.startsWith('wolfsburg_')).forEach(k => localStorage.removeItem(k))
```

---

## Project context

This tool is one instrument within the larger **Post-Car Future of Wolfsburg** studio + competition
project (Bauhaus-Universität Weimar). The tool is a *design and analysis instrument — not the final
deliverable*. For the broader project, see the design workspace alongside this repo.
