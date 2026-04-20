import osmtogeojson from 'osmtogeojson'

const CACHE_PREFIX = 'wolfsburg_boundary_v2_'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const TIMEOUT_MS   = 15000

const OVERPASS_QUERIES = {
  'Stadtmitte':          '[out:json];relation(288449);(._;>;);out body;',
  'Mitte-West':          '[out:json];relation(11042427);(._;>;);out body;',
  'Kästorf-Sandkamp':    '[out:json];relation(20064844);(._;>;);out body;',
  'Nordstadt':           '[out:json];relation(11680489);(._;>;);out body;',
  'Vorsfelde':           '[out:json];relation(19800466);(._;>;);out body;',
  'Neuhaus-Reislingen':  '[out:json];relation(20064820);(._;>;);out body;',
}

function loadCached(name) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + name)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCached(name, geojson) {
  try { localStorage.setItem(CACHE_PREFIX + name, JSON.stringify(geojson)) } catch {}
}

async function fetchBoundary(name) {
  const cached = loadCached(name)
  if (cached) return cached

  const query = OVERPASS_QUERIES[name]
  if (!query) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`)

    const osmData = await resp.json()
    const raw     = osmtogeojson(osmData)

    // Keep only polygon/multipolygon features (the actual boundary rings)
    const geojson = {
      type: 'FeatureCollection',
      features: raw.features.filter(
        f => f.geometry &&
             (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      ),
    }

    if (geojson.features.length > 0) saveCached(name, geojson)
    return geojson
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

export async function fetchAllBoundaries(onProgress) {
  const names      = Object.keys(OVERPASS_QUERIES)
  const boundaries = {}

  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    try {
      boundaries[name] = await fetchBoundary(name)
    } catch (err) {
      console.warn(`Boundary fetch failed for "${name}":`, err.message)
      boundaries[name] = null
    }
    onProgress?.({ current: i + 1, total: names.length })
    // Small delay between Overpass requests to be polite
    if (i < names.length - 1 && !loadCached(name)) await new Promise(r => setTimeout(r, 500))
  }

  return boundaries
}

export function clearBoundaryCache() {
  Object.keys(OVERPASS_QUERIES).forEach(name => {
    try { localStorage.removeItem(CACHE_PREFIX + name) } catch {}
  })
}
