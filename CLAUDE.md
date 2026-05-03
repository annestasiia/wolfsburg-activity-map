# CLAUDE.md — Agent Rules for Wolfsburg Map Project

These rules apply to every task in this project. Follow them strictly. 

## THIS IS AN ADDITIVE TASK — extend the existing file, do not rewrite it.

---

## CORE RULES

### Never delete existing data

- The `DCFG` array, `VENUES` array, and district boundary loading code must never be removed or overwritten
- Before editing any section of the file, read it fully first

### Single file constraint

- Everything must stay in one HTML file: `wolfsburg_map.html`
- Do not create separate `.js` or `.css` files
- Do not add npm, webpack, or any build tools

### No guessing on data

- Never invent coordinates, route data, or district shapes
- If a data source is unavailable, use the specified fallback (see TASK.md)
- If both primary and fallback fail, show a visible error message in the UI — do not silently fail

---

## CODING RULES

### Before writing any code

1. Read the relevant section of `wolfsburg_map.html` first
2. Identify exactly which lines will change
3. Make surgical edits — do not rewrite the entire file unless explicitly asked

### JavaScript

- Use plain ES5-compatible JavaScript (no arrow functions, no `const`/`let` if targeting broad compatibility — or use ES6 consistently, pick one and stick to it)
- All Overpass fetch calls must use `POST` method with `Content-Type: application/x-www-form-urlencoded`
- Always wrap fetch calls in try/catch
- Cache fetched data: `layerCache[key] = data` before rendering
- Check cache before fetching: `if (layerCache[key]) { render(layerCache[key]); return; }`

### Leaflet layers

- Every rendered layer must be stored in a variable and removed with `map.removeLayer()` before adding a new one
- Never call `.addTo(map)` without first removing the previous layer of the same type

### Overpass API

- Bounding box for all queries: `52.35,10.68,52.52,10.93` (covers all of Wolfsburg)
- Always include `[out:json][timeout:30]` at the start of every query
- Stagger requests: minimum 500ms between Overpass calls
- If response has 0 elements, log a warning and show "No data found" in the UI

---

## UI RULES

### Color palettes — never mix between modes

- Mobility: `#FF4D6D` (strong), `#FF8FA3` (mid), `#FFCCD5` (light)
- Facilities: `#1D70B8` (strong), `#74B0D4` (mid), `#C5DFF0` (light)
- Greenery: `#2D6A4F` (strong), `#74C69D` (mid), `#D8F3DC` (light)

### Map tiles

- Always use CartoDB Positron: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
- Do not revert to OpenStreetMap dark tiles

### Loading state

- Show loading overlay BEFORE starting any fetch
- Hide loading overlay AFTER rendering is complete OR after error
- Loading text must name the layer: "Loading Public Transport from OpenStreetMap…"

---

## WHAT NOT TO DO

- Do not add any npm packages or external dependencies beyond Leaflet 1.9.4
- Do not use `localStorage` or `sessionStorage`
- Do not hardcode route or road data — always fetch from Overpass or city open data
- Do not remove the district boundary loading code
- Do not change the map's initial center `[52.427, 10.781]` or zoom `12`
- Do not add authentication, login, or API keys — all data sources are public
- Do not create multiple HTML files — one file only

---

## HOW TO HANDLE ERRORS

| Situation                    | Action                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| Overpass timeout             | Show toast "OpenStreetMap server busy, try again" — do not crash |
| CORS error on city GeoJSON   | Silently switch to Overpass fallback query                        |
| Empty Overpass result        | Show "No data found for this layer in Wolfsburg" in bottom panel  |
| District boundary not loaded | Skip scoring for that district, do not throw error                |

---

## TESTING CHECKLIST (verify before finishing)

- [ ] All 3 mode tabs switch correctly and apply correct color theme
- [ ] All sub-option buttons in each mode work
- [ ] Clicking a sub-option fetches data and draws it on the map
- [ ] District polygons change fill opacity based on score
- [ ] Clicking the same sub-option twice does NOT re-fetch (uses cache)
- [ ] Loading overlay appears and disappears correctly
- [ ] District popup shows on polygon click with correct district name and score
- [ ] Legend updates when mode/sub changes
- [ ] Map tile is white/light (CartoDB Positron)
- [ ] Existing DCFG and VENUES arrays are intact
