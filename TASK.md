# TASK: Wolfsburg Mobility Analysis Map

## 1. CONTEXT

- **Project:** Single-file HTML analytical map of Wolfsburg, Germany
- **File to edit:** `wolfsburg_map.html` (already exists in the project)
- **What already exists in the file:**
  - Leaflet.js map with OpenStreetMap tiles
  - District boundary loading via Overpass API (6 district groups)
  - Venue dot layers: Culture (purple), Schools (blue), Leisure (green), Commercial (orange)
  - District config array `DCFG` and venues array `VENUES` — **do not delete these**

---

## 2. GOAL

Rebuild the UI and analysis layer system of `wolfsburg_map.html` to support three analysis modes: **Mobility**, **Facilities**, **Greenery**. Each mode has its own sub-layers, color palette, and data source. The map tile style must be changed to light/white (CartoDB Positron).

---

## 3. UI / UX

### Map background
Replace current OSM tiles with CartoDB Positron (white/light):
```
https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
attribution: © OpenStreetMap contributors © CARTO
```

### Header bar (top, full width, white background)
- Left: title "Wolfsburg Urban Analysis", subtitle "Mobility · Facilities · Greenery"
- Right: 3 mode tabs — `[ Mobility ]` `[ Facilities ]` `[ Greenery ]`
- Active tab styling per mode:
  - Mobility → red/pink pill `#FFE4EA` bg, `#D6002A` text
  - Facilities → blue pill `#E0EEFA` bg, `#1D4ED8` text
  - Greenery → green pill `#D8F3DC` bg, `#2D6A4F` text

### Bottom panel (slides up from bottom, ~130px tall, white bg)
- Shows sub-option buttons for the currently active mode
- Only one sub-option can be active at a time
- Active sub-button: filled with mode color, white text
- Inactive: white bg, grey border, grey text

**Mobility sub-options:** `Public Transport` · `Automobile` · `Cycling` · `Pedestrian`
**Facilities sub-options:** `Schools` · `Culture` · `Leisure` · `Commercial`
**Greenery sub-options:** `Parks` · `Forest` · `Water` · `Green Corridors`

### District fill (gradient intensity)
When a sub-option is active, each district polygon is filled with color intensity based on how many infrastructure lines/routes of that type pass through the district:

| Count | Fill opacity | Meaning |
|-------|-------------|---------|
| 0     | 0.0         | No connections |
| 1     | 0.12        | Weak |
| 2–3   | 0.28        | Moderate |
| 4–9   | 0.45        | Good |
| 10+   | 0.65        | High |

Fill color per mode:
- Mobility   → `#FF4D6D`
- Facilities → `#1D70B8`
- Greenery   → `#2D6A4F`

### Legend (bottom right, always visible)
Shows 5-level color scale with labels: "No data" → "High connectivity"
Updates dynamically when mode or sub-option changes.

### District click popup (top left)
On click: show district name, active layer score (e.g. "8 routes pass through"), short description.
Close button top right of popup.

### Loading overlay
While fetching Overpass data: semi-transparent white overlay over the map with a spinner and text "Loading [layer name] from OpenStreetMap…"

---

## 4. DATA SOURCES

### MOBILITY — Public Transport
```
POST https://overpass-api.de/api/interpreter
Content-Type: application/x-www-form-urlencoded
body: data=[out:json][timeout:30];
(
  relation["route"~"bus|tram"]["network"~"[Ww]olfsburg|WVG|VRB"](52.35,10.68,52.52,10.93);
  relation["route"="bus"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```
Draw each route relation as a polyline. Color: `#FF4D6D`, weight: 2.5, opacity: 0.7.

### MOBILITY — Automobile
```
POST https://overpass-api.de/api/interpreter
body: data=[out:json][timeout:30];
(
  way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```
Draw roads as polylines. Color: `#FF8FA3`, weight by type: motorway=4, primary=2.5, secondary=1.5.

### MOBILITY — Cycling
**Primary source** — Stadt Wolfsburg official open data (license: dl-de/by-2-0):
```
GET https://geoportal.stadt.wolfsburg.de/geonetwork3/srv/api/records/84fd2681-9fca-4bac-8edc-5cee12e01bd8/attachments/Radwege.geojson
```
**Fallback** if CORS error — use Overpass:
```
POST https://overpass-api.de/api/interpreter
body: data=[out:json][timeout:30];
(
  way["highway"="cycleway"](52.35,10.68,52.52,10.93);
  way["cycleway"~"lane|track|shared_lane"](52.35,10.68,52.52,10.93);
  way["bicycle"="designated"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```
Draw as dashed polylines. Color: `#FF4D6D`, weight: 2, dashArray: "6,4".

### MOBILITY — Pedestrian
```
POST https://overpass-api.de/api/interpreter
body: data=[out:json][timeout:30];
(
  way["highway"~"footway|pedestrian|path"](52.35,10.68,52.52,10.93);
  way["foot"="designated"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```
Draw as thin polylines. Color: `#FFCCD5`, weight: 1, opacity: 0.6.

### FACILITIES — Schools / Culture / Leisure / Commercial
**No new fetch needed.** Reuse the existing `VENUES` array already in the file.
Filter by `cat` field: `school`, `culture`, `leisure`, `commercial`.
Show venue dots + color district fills by venue count per district.

### GREENERY — Parks
```
POST https://overpass-api.de/api/interpreter
body: data=[out:json][timeout:30];
(
  way["leisure"="park"](52.35,10.68,52.52,10.93);
  relation["leisure"="park"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```

### GREENERY — Forest
```
(
  way["landuse"="forest"](52.35,10.68,52.52,10.93);
  way["natural"="wood"](52.35,10.68,52.52,10.93);
  relation["landuse"="forest"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```

### GREENERY — Water
```
(
  way["natural"="water"](52.35,10.68,52.52,10.93);
  relation["natural"="water"](52.35,10.68,52.52,10.93);
  way["waterway"~"river|canal|stream"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```

### GREENERY — Green Corridors
```
(
  way["highway"="path"]["foot"="yes"](52.35,10.68,52.52,10.93);
  way["route"="hiking"](52.35,10.68,52.52,10.93);
  relation["route"~"hiking|greenway"](52.35,10.68,52.52,10.93);
);(._;>;);out body;
```
Greenery features: filled polygons color `#2D6A4F` opacity 0.15, outline `#2D6A4F` weight 1.

---

## 5. SCORING LOGIC (district intensity)

For **Mobility layers** (line data from Overpass):
- Build node map from elements array: `{nodeId: [lat, lon]}`
- Build way coordinate arrays from node IDs
- For each district, get its bounding box from the already-loaded polygon coordinates
- Count how many OSM ways have at least one node inside the district bbox
- Map count to opacity bucket (see table in section 3)

For **Facilities layers** (point data from VENUES array):
- Count venues per district where `venue.dist === district.key` and `venue.cat === selectedCat`
- Same opacity bucket logic

For **Greenery layers** (polygon/line data):
- Count how many OSM features have centroid inside district bbox
- Same opacity bucket logic

Cache results in a JS object `layerCache[modeKey_subKey]` so switching
back to a previously loaded layer does not re-fetch from Overpass.

---

## 6. CONSTRAINTS — DO NOT BREAK THESE

- Single HTML file — no external JS files, no build system
- Use only: Leaflet 1.9.4 from cdnjs, no other libraries
- Preserve the existing `DCFG` array (district config) exactly as-is
- Preserve the existing `VENUES` array exactly as-is
- Preserve the existing district boundary loading logic (Overpass fetch on init)
- No localStorage, no sessionStorage
- All Overpass requests: stagger by 500ms minimum between calls
- Max 1 concurrent Overpass request at a time (queue them)
- On Overpass timeout or error: show a non-blocking toast "Data unavailable, try again" and continue

---

## 7. FILE STRUCTURE (keep everything in one HTML file)

```
<head>   — meta, Leaflet CSS, <style> all CSS
<body>   — #header, #map, #loading, #bottom-panel, #legend, #dpop
<script> — in this order:
  1. MAP INIT (Leaflet + CartoDB tiles)
  2. DISTRICT CONFIG (DCFG array)
  3. VENUES array
  4. DISTRICT BOUNDARY LOADING (Overpass, on page load)
  5. LAYER CACHE object
  6. OVERPASS FETCH QUEUE (max 1 concurrent)
  7. DATA PROCESSORS (OSM elements → polylines/polygons + scoring)
  8. RENDER FUNCTIONS (per mode/sub-option)
  9. UI STATE (setMode, setSub, toggleLayer)
  10. LEGEND UPDATER
  11. DISTRICT POPUP handler
  12. INIT (load boundaries, set default mode = Mobility, sub = Public Transport)
```
