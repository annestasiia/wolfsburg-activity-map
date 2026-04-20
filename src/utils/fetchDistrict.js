import osmtogeojson from 'osmtogeojson'
import { OVERPASS_ENDPOINTS, buildOverpassQuery } from './districtBoundaries'

const CACHE_PREFIX = 'wob_boundary_v2_'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Named fallback search terms for each district (used when relation IDs fail)
const NAMED_FALLBACKS = {
  'Stadtmitte':         ['Stadtmitte'],
  'Mitte-West':         ['Westhagen', 'Detmerode'],
  'Kästorf-Sandkamp':   ['Sandkamp', 'Kästorf'],
  'Nordstadt':          ['Nordsteimke', 'Nordstadt'],
  'Vorsfelde':          ['Vorsfelde'],
  'Neuhaus-Reislingen': ['Reislingen', 'Neuhaus'],
}

function buildNamedQuery(name) {
  return `[out:json][timeout:30];
area["name"="Wolfsburg"]["place"="city"]->.city;
rel(area.city)["name"="${name}"]["boundary"="administrative"];
(._;>;);
out body;`
}

// ── Cache helpers ────────────────────────────────────────────────────────────

function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data
  } catch { return null }
}

function setCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {} // localStorage full — skip
}

// ── Overpass fetcher (tries all endpoints) ───────────────────────────────────

async function fetchFromOverpass(query) {
  let lastErr
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  AbortSignal.timeout(20000),
      })
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue }
      const json = await res.json()
      if (json.elements?.length > 0) return json
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('All Overpass endpoints failed or returned empty data')
}

// ── GeoJSON helpers ──────────────────────────────────────────────────────────

function extractPolygons(geojson) {
  const coords = []
  for (const f of geojson.features) {
    if (!f.geometry) continue
    const { type, coordinates } = f.geometry
    if (type === 'Polygon')      coords.push(coordinates)
    if (type === 'MultiPolygon') coords.push(...coordinates)
  }
  return coords
}

function toMultiPolygonFeature(coordsList, districtName, color) {
  if (!coordsList.length) return null
  return {
    type: 'Feature',
    properties: { name: districtName, color },
    geometry: { type: 'MultiPolygon', coordinates: coordsList },
  }
}

// ── Per-district fetcher ─────────────────────────────────────────────────────

export async function fetchDistrictBoundary(districtName, config) {
  const cacheKey = `${districtName}_${config.relationIds.join('_')}`
  const cached = getCached(cacheKey)
  if (cached) { console.log(`[boundary] "${districtName}" loaded from cache`); return cached }

  const allCoords = []

  // 1. Try each relation ID
  for (const relId of config.relationIds) {
    const query = buildOverpassQuery([relId])
    try {
      const osmData = await fetchFromOverpass(query)
      const geojson = osmtogeojson(osmData)
      const coords  = extractPolygons(geojson)
      if (coords.length) {
        console.log(`[boundary] relation ${relId} → ${coords.length} polygon(s) for "${districtName}"`)
        allCoords.push(...coords)
      } else {
        console.warn(`[boundary] relation ${relId} returned no polygons for "${districtName}" — trying named fallback`)
      }
    } catch (err) {
      console.warn(`[boundary] relation ${relId} fetch failed for "${districtName}":`, err.message)
    }
  }

  // 2. Named fallback — only for names that produced no geometry above
  if (allCoords.length === 0) {
    const names = NAMED_FALLBACKS[districtName] ?? []
    for (const searchName of names) {
      try {
        const osmData = await fetchFromOverpass(buildNamedQuery(searchName))
        const geojson = osmtogeojson(osmData)
        const coords  = extractPolygons(geojson)
        if (coords.length) {
          console.log(`[boundary] named fallback "${searchName}" → ${coords.length} polygon(s) for "${districtName}"`)
          allCoords.push(...coords)
          break // first successful name is enough
        }
      } catch (err) {
        console.warn(`[boundary] named fallback "${searchName}" failed:`, err.message)
      }
    }
  }

  if (allCoords.length === 0) {
    console.error(`[boundary] No geometry found for "${districtName}" — district will be hidden`)
    return null
  }

  const feature = toMultiPolygonFeature(allCoords, districtName, config.color)
  setCache(cacheKey, feature)
  return feature
}

// ── Fetch all districts sequentially ────────────────────────────────────────

export async function fetchAllDistrictBoundaries(districtConfig, onProgress) {
  const results = {}
  const entries = Object.entries(districtConfig)

  for (let i = 0; i < entries.length; i++) {
    const [name, config] = entries[i]
    onProgress?.({ current: i + 1, total: entries.length, name })
    results[name] = await fetchDistrictBoundary(name, config)
    if (i < entries.length - 1) await new Promise(r => setTimeout(r, 350))
  }
  return results
}

// ── Dev helper: clear the boundary cache ────────────────────────────────────

export function clearBoundaryCache() {
  const removed = Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX))
  removed.forEach(k => localStorage.removeItem(k))
  console.log(`[boundary] Cache cleared (${removed.length} entries)`)
}
