export function computeBbox(geojson) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      if (coords[0] < minLng) minLng = coords[0]
      if (coords[0] > maxLng) maxLng = coords[0]
      if (coords[1] < minLat) minLat = coords[1]
      if (coords[1] > maxLat) maxLat = coords[1]
    } else {
      coords.forEach(visit)
    }
  }
  geojson.features?.forEach(f => { if (f.geometry) visit(f.geometry.coordinates) })
  return { minLng, maxLng, minLat, maxLat }
}

export function inBbox(lng, lat, bbox) {
  return lng >= bbox.minLng && lng <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat
}

export function expandBbox({ minLng, maxLng, minLat, maxLat }, pad) {
  return { minLng: minLng - pad, maxLng: maxLng + pad, minLat: minLat - pad, maxLat: maxLat + pad }
}

export function getCoordList(geometry) {
  if (!geometry) return []
  if (geometry.type === 'LineString')      return geometry.coordinates
  if (geometry.type === 'MultiLineString') return geometry.coordinates.flat()
  return []
}
