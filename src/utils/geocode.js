const CACHE_KEY = 'wolfsburg_geocache_v1'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}

function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

export function addressKey(street, city) {
  return `${street}, ${city}`.toLowerCase().trim()
}

async function fetchCoords(addressStr) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${addressStr}, Wolfsburg, Germany`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'de')

  const resp = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'WolfsburgActivityMap/1.0 (research project)',
    },
  })
  if (!resp.ok) throw new Error(`Nominatim ${resp.status}`)
  const results = await resp.json()
  if (!results.length) return null
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function geocodeVenues(venues, onProgress) {
  const cache = loadCache()

  // Collect unique addresses not yet cached
  const uniqueAddrs = [
    ...new Set(
      venues
        .filter(v => v.street)
        .map(v => addressKey(v.street, v.city))
    ),
  ].filter(k => !(k in cache))

  let done = 0
  const total = uniqueAddrs.length

  for (const addr of uniqueAddrs) {
    try {
      cache[addr] = await fetchCoords(addr)
    } catch (err) {
      console.warn(`Geocode failed for "${addr}":`, err.message)
      cache[addr] = null
    }
    done++
    onProgress?.({ current: done, total })
    saveCache(cache)
    if (done < total) await sleep(1100) // Nominatim rate limit: 1 req/s
  }

  return venues.map(v => {
    const key   = addressKey(v.street, v.city)
    const coords = cache[key]
    return coords ? { ...v, lat: coords.lat, lng: coords.lng } : v
  })
}

export function clearGeoCache() {
  localStorage.removeItem(CACHE_KEY)
}
