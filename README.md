# Wolfsburg Activity Map

An interactive web app that visualises social activity data across 6 districts of Wolfsburg, Germany — built with React, MapLibre GL JS, and OpenStreetMap data.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## How to use

1. **Upload your Excel file** — drag and drop `wolfsburg_hotspots_v2.xlsx` (or any compatible `.xlsx`) onto the upload screen.
2. **Wait for geocoding** — the app calls Nominatim (OpenStreetMap) to look up lat/lng for each unique address. Results are cached in `localStorage` so subsequent loads skip this step.
3. **Explore the map** — use the left sidebar to:
   - Toggle **districts** (boundary overlays are fetched from OpenStreetMap)
   - Filter by **category** (Schools / Culture / Leisure / Commercial)
   - Select a **day and time** to see which venues are open and how active they are
   - Enable **Show reviews & notes** then click a marker for full venue details

## Excel file format

The app expects an `.xlsx` file with data starting on **row 4** (rows 1–3 are headers/metadata):

| Col | Field |
|-----|-------|
| A | District |
| B | Category |
| C | Name |
| D | Type |
| E | Street address |
| F | City |
| G | Opening hours (free text) |
| H | Peak times |
| I | Activity intensity |
| J | Age groups |
| K | Google rating |
| L | Notes |
| M–S | Mon / Tue / Wed / Thu / Fri / Sat / Sun activity (`—` / `Low` / `Med` / `High`) |

## Architecture

```
Excel → SheetJS parse → Nominatim geocode → GeoJSON features → MapLibre circle layer
Overpass API → osmtogeojson → GeoJSON polygons → MapLibre fill/line layer
```

- **Map tiles**: [OpenFreeMap](https://openfreemap.org/) positron style — free, no API key required
- **District boundaries**: fetched from Overpass API using OSM relation IDs, cached in `localStorage`
- **Geocoding**: Nominatim (1 request/second rate limit respected), results cached in `localStorage`
- **State**: Zustand store
- **Styling**: Tailwind CSS

## Marker legend

| Size | Activity |
|------|----------|
| 12 px | High |
| 8 px  | Med  |
| 5 px  | Low  |
| faint grey dot | No data |

Opacity 100% = open at selected time · Opacity 20% = closed

## Resetting cached data

Open the browser console and run:

```js
// Clear geocoding cache (forces re-geocode on next upload)
localStorage.removeItem('wolfsburg_geocache_v1')

// Clear district boundary cache (forces re-fetch from Overpass)
['Stadtmitte','Mitte-West','Kästorf-Sandkamp','Nordstadt','Vorsfelde','Neuhaus-Reislingen']
  .forEach(n => localStorage.removeItem('wolfsburg_boundary_v1_' + n))
```

## Notes

- Stadia Maps tiles are referenced in `mapStyle.json` as an alternative — they work on `localhost` without an API key but require one for deployed domains.
- The Overpass API has rate limits; if boundaries fail to load a warning banner is shown but venue data is unaffected.
- The opening-hours parser is heuristic (handles `Mo–Fr 9:00–18:00` style strings). Unusual formats fall back to "Hours N/A".
