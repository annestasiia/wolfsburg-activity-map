import osmtogeojson from 'osmtogeojson'
import { OVERPASS_ENDPOINTS, buildOverpassQuery } from './districtBoundaries'

const CACHE_PREFIX = 'wob_boundary_v2_'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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
  } catch {
    return null
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage full — skip caching
  }
}

async function fetchFromOverpass(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) continue
      const json = await res.json()
      if (json.elements && json.elements.length > 0) return json
    } catch {
      continue
    }
  }
  throw new Error('All Overpass endpoints failed')
}

function mergeToMultiPolygon(geojsonList, districtName, color) {
  const allCoords = []
  for (const geojson of geojsonList) {
    for (const feature of geojson.features) {
      if (!feature.geometry) continue
      const { type, coordinates } = feature.geometry
      if (type === 'Polygon') {
        allCoords.push(coordinates)
      } else if (type === 'MultiPolygon') {
        allCoords.push(...coordinates)
      }
    }
  }
  if (allCoords.length === 0) return null
  return {
    type: 'Feature',
    properties: { name: districtName, color },
    geometry: { type: 'MultiPolygon', coordinates: allCoords },
  }
}

export async function fetchDistrictBoundary(districtName, config) {
  const cacheKey = `${districtName}_${config.relationIds.join('_')}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const geojsonList = []
  for (const relId of config.relationIds) {
    const query = buildOverpassQuery([relId])
    try {
      const osmData = await fetchFromOverpass(query)
      const geojson = osmtogeojson(osmData)
      geojsonList.push(geojson)
    } catch (err) {
      console.warn(`Relation ${relId} (${districtName}) failed:`, err.message)
      // Try name-based fallback
      const fallback = `[out:json][timeout:30];
rel["name"]["boundary"="administrative"](area["name"="Wolfsburg"]["place"="city"])->.all;
rel.all(${relId});
(._;>;);
out body;`
      try {
        const osmData = await fetchFromOverpass(fallback)
        const geojson = osmtogeojson(osmData)
        if (geojson.features.length > 0) {
          console.log(`Fallback succeeded for relation ${relId}`)
          geojsonList.push(geojson)
        }
      } catch {
        console.error(`Both primary and fallback failed for relation ${relId} (${districtName})`)
      }
    }
  }

  if (geojsonList.length === 0) {
    console.error(`No boundary data for: ${districtName}`)
    return null
  }

  const merged = mergeToMultiPolygon(geojsonList, districtName, config.color)
  if (!merged) return null

  setCache(cacheKey, merged)
  return merged
}

export async function fetchAllDistrictBoundaries(districtConfig, onProgress) {
  const results = {}
  const entries = Object.entries(districtConfig)
  for (let i = 0; i < entries.length; i++) {
    const [name, config] = entries[i]
    onProgress?.({ current: i + 1, total: entries.length, name })
    results[name] = await fetchDistrictBoundary(name, config)
    if (i < entries.length - 1) await new Promise((r) => setTimeout(r, 300))
  }
  return results
}

export function clearBoundaryCache() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(CACHE_PREFIX))
    .forEach((k) => localStorage.removeItem(k))
  console.log('Boundary cache cleared')
}
