// Rad Network Algorithm — Wolfsburg Bike Route Network
// Steps: 1 (nodes) → 2 (graph + weights) → 3 (Dijkstra edges) → display

import { haversineM } from './intermodalAlgorithm'

export const WOLFSBURG_CENTER = { lat: 52.4228, lng: 10.7865, name: 'City Center (Wolfsburg Hbf)' }

// ── Min-heap for O(log N) Dijkstra ───────────────────────────────────────────
class MinHeap {
  constructor() { this.h = [] }
  push(item) { this.h.push(item); this._up(this.h.length - 1) }
  pop() {
    const top = this.h[0], last = this.h.pop()
    if (this.h.length) { this.h[0] = last; this._down(0) }
    return top
  }
  get size() { return this.h.length }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.h[p][0] <= this.h[i][0]) break
      ;[this.h[p], this.h[i]] = [this.h[i], this.h[p]]
      i = p
    }
  }
  _down(i) {
    const n = this.h.length
    for (;;) {
      let m = i, l = 2*i+1, r = 2*i+2
      if (l < n && this.h[l][0] < this.h[m][0]) m = l
      if (r < n && this.h[r][0] < this.h[m][0]) m = r
      if (m === i) break
      ;[this.h[m], this.h[i]] = [this.h[i], this.h[m]]
      i = m
    }
  }
}

// ── Road weight — lower = preferred by cyclist ─────────────────────────────
function roadWeight(highway, bicycle, dist) {
  let w = dist
  if (highway === 'cycleway')           w *= 0.5
  else if (bicycle === 'designated')    w *= 0.7
  else if (highway === 'pedestrian')    w *= 0.75
  else if (highway === 'living_street') w *= 0.8
  else if (highway === 'residential')   w *= 0.9
  else if (highway === 'footway')       w *= 0.8
  else if (highway === 'path')          w *= 0.85
  else if (highway === 'track')         w *= 0.85
  else if (highway === 'tertiary')      w *= 1.2
  else if (highway === 'secondary')     w *= 1.5
  else if (highway === 'primary')       w *= 2.0
  else if (highway === 'trunk')         w *= 2.5
  else if (highway === 'motorway')      w *= 3.0
  return w
}

// ── Build bidirectional road graph ────────────────────────────────────────────
export function buildRoadGraph(roadsGJ, footwaysGJ) {
  const graph = {}  // { "lng,lat": [{ to, weight, realDist, highway, coords }] }

  const addFeature = (feature) => {
    const props = feature.properties || {}
    const highway = props.highway || ''
    const bicycle = props.bicycle || ''
    let lines
    if (feature.geometry?.type === 'LineString')      lines = [feature.geometry.coordinates]
    else if (feature.geometry?.type === 'MultiLineString') lines = feature.geometry.coordinates
    else return

    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lng1, lat1] = line[i]
        const [lng2, lat2] = line[i + 1]
        const dist = haversineM(lat1, lng1, lat2, lng2)
        if (dist < 0.1) continue  // skip zero-length segments
        const w = roadWeight(highway, bicycle, dist)
        const k1 = `${lng1.toFixed(5)},${lat1.toFixed(5)}`
        const k2 = `${lng2.toFixed(5)},${lat2.toFixed(5)}`
        if (!graph[k1]) graph[k1] = []
        if (!graph[k2]) graph[k2] = []
        graph[k1].push({ to: k2, weight: w, realDist: dist, highway, coords: [[lng1, lat1], [lng2, lat2]] })
        graph[k2].push({ to: k1, weight: w, realDist: dist, highway, coords: [[lng2, lat2], [lng1, lat1]] })
      }
    }
  }

  for (const f of roadsGJ?.features || [])    addFeature(f)
  for (const f of footwaysGJ?.features || []) addFeature(f)
  return graph
}

// ── Spatial grid index for O(1) nearest-node lookup ──────────────────────────
function buildSpatialIndex(graphKeys, cellSize = 0.008) {
  const index = {}
  for (const key of graphKeys) {
    const [lng, lat] = key.split(',').map(Number)
    const ck = `${Math.floor(lng / cellSize)},${Math.floor(lat / cellSize)}`
    if (!index[ck]) index[ck] = []
    index[ck].push(key)
  }
  return { index, cellSize }
}

function snapToGraph({ index, cellSize }, lat, lng, maxRadiusM = 350) {
  const cellLng = Math.floor(lng / cellSize)
  const cellLat = Math.floor(lat / cellSize)
  let bestKey = null, bestDist = Infinity
  for (let dlat = -2; dlat <= 2; dlat++) {
    for (let dlng = -2; dlng <= 2; dlng++) {
      for (const key of index[`${cellLng + dlng},${cellLat + dlat}`] || []) {
        const [kLng, kLat] = key.split(',').map(Number)
        const d = haversineM(lat, lng, kLat, kLng)
        if (d < bestDist) { bestDist = d; bestKey = key }
      }
    }
  }
  return bestDist <= maxRadiusM ? bestKey : null
}

// ── Dijkstra from a single source, bounded by maxDistM ───────────────────────
function dijkstraFrom(graph, startKey, maxDistM = 5500) {
  const [startLng, startLat] = startKey.split(',').map(Number)
  const dist = { [startKey]: 0 }
  const prev = {}
  const visited = new Set()
  const heap = new MinHeap()
  heap.push([0, startKey])

  while (heap.size) {
    const [cost, u] = heap.pop()
    if (visited.has(u)) continue
    visited.add(u)
    for (const edge of graph[u] || []) {
      const { to, weight, realDist, highway, coords } = edge
      if (visited.has(to)) continue
      const [toLng, toLat] = to.split(',').map(Number)
      if (haversineM(startLat, startLng, toLat, toLng) > maxDistM) continue
      const newCost = cost + weight
      if (newCost < (dist[to] ?? Infinity)) {
        dist[to] = newCost
        prev[to] = { from: u, highway, coords, realDist }
        heap.push([newCost, to])
      }
    }
  }
  return { dist, prev }
}

// ── Recover path geometry and metadata from prev map ─────────────────────────
function recoverPath(prev, startKey, endKey) {
  const segments = []
  let current = endKey
  let realDist = 0
  const highwaySet = new Set()
  let hasCycleway = false

  while (current !== startKey) {
    const p = prev[current]
    if (!p) return null  // disconnected
    segments.unshift(p.coords)
    realDist += p.realDist
    highwaySet.add(p.highway)
    if (p.highway === 'cycleway') hasCycleway = true
    current = p.from
  }

  const types = [...highwaySet]
  const BAD = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'motorway'])
  const needsInfrastructure = !hasCycleway && types.length > 0 && types.every(h => BAD.has(h))

  return { segments, realDist, highwayTypes: types, hasCycleway, needsInfrastructure }
}

// ── Step 1: Build node array from all sources ─────────────────────────────────
function buildNodes(hubs, venues, historicEls, villageEls, bikeParkingsGJ, busStopsGJ) {
  const nodes = []
  let id = 0

  // Hubs — order 1
  for (const hub of hubs) {
    nodes.push({
      id: `hub_${id++}`,
      name: hub.labelBus || hub.labelCar || 'Intermodal Hub',
      node_type: 'hub', order: 1,
      lat: hub.lat, lng: hub.lng,
      hubType: hub.hubType, priority: hub.priority, score: hub.score,
    })
  }

  // City center — order 1
  nodes.push({
    id: 'city_center_0', name: WOLFSBURG_CENTER.name,
    node_type: 'city_center', order: 1,
    lat: WOLFSBURG_CENTER.lat, lng: WOLFSBURG_CENTER.lng,
  })

  // Village / district centers — order 1
  for (const el of villageEls) {
    if (!el.lat || !el.lon) continue
    nodes.push({
      id: `village_${id++}`,
      name: el.tags?.name || el.tags?.['name:de'] || 'Settlement',
      node_type: 'village_center', order: 1,
      lat: el.lat, lng: el.lon,
      placeType: el.tags?.place,
    })
  }

  // Top 30% facilities by footfall — order 2
  const INTENSITY = { High: 500, Medium: 200, Low: 50 }
  const withFP = venues
    .filter(v => v.lat && v.lng)
    .map(v => ({ ...v, _fp: v._footfall ?? INTENSITY[v.activityIntensity] ?? 100 }))
    .sort((a, b) => b._fp - a._fp)
  const topN = Math.max(1, Math.ceil(withFP.length * 0.3))
  for (const v of withFP.slice(0, topN)) {
    nodes.push({
      id: `fac_${id++}`, name: v.name || 'Facility',
      node_type: 'facility', order: 2,
      lat: v.lat, lng: v.lng, footfall: v._fp, category: v.category,
    })
  }

  // Historic sites — order 2
  for (const el of historicEls) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!lat || !lng) continue
    nodes.push({
      id: `hist_${id++}`,
      name: el.tags?.name || el.tags?.historic || el.tags?.tourism || 'Historic site',
      node_type: 'historic', order: 2,
      lat, lng, historicType: el.tags?.historic || el.tags?.tourism,
    })
  }

  // Bike parkings not inside any hub radius (200m) — order 3
  const hubCoords = hubs.map(h => ({ lat: h.lat, lng: h.lng }))
  for (const f of bikeParkingsGJ?.features || []) {
    const [lng, lat] = f.geometry.coordinates
    if (hubCoords.some(h => haversineM(lat, lng, h.lat, h.lng) <= 200)) continue
    nodes.push({
      id: `bike_${id++}`, name: f.properties?.name || 'Bike parking',
      node_type: 'bike_parking', order: 3, lat, lng,
    })
  }

  // Bus stops not inside any hub radius (200m) — order 3
  for (const f of busStopsGJ?.features || []) {
    const [lng, lat] = f.geometry.coordinates
    if (hubCoords.some(h => haversineM(lat, lng, h.lat, h.lng) <= 200)) continue
    nodes.push({
      id: `bus_${id++}`, name: f.properties?.name || f.properties?.ref || 'Bus stop',
      node_type: 'bus_stop', order: 3, lat, lng,
    })
  }

  return nodes
}

// ── Step 3: Build edges using Dijkstra ───────────────────────────────────────
function buildEdges(nodes, graph, spatialIdx) {
  const edges = []
  const gaps  = []
  let edgeId  = 0
  const edgeSet = new Set()

  // Snap each node to nearest road graph node
  const snapped = {}
  for (const n of nodes) snapped[n.id] = snapToGraph(spatialIdx, n.lat, n.lng)

  // Cache Dijkstra results per source node
  const djCache = {}
  function getDijkstra(nodeId) {
    if (!(nodeId in djCache)) {
      const key = snapped[nodeId]
      djCache[nodeId] = key ? dijkstraFrom(graph, key) : null
    }
    return djCache[nodeId]
  }

  function addEdge(from, to, routeType) {
    const pairKey = [from.id, to.id].sort().join('|')
    if (edgeSet.has(pairKey)) return
    edgeSet.add(pairKey)

    const straightDist = Math.round(haversineM(from.lat, from.lng, to.lat, to.lng))
    const dj = getDijkstra(from.id)
    const toKey = snapped[to.id]

    const base = {
      id: `edge_${edgeId++}`, from: from.id, to: to.id,
      fromName: from.name, toName: to.name,
      fromLng: from.lng, fromLat: from.lat, toLng: to.lng, toLat: to.lat,
      route_type: routeType, distance_straight_m: straightDist,
    }

    if (!dj || !toKey || !(toKey in dj.dist)) {
      gaps.push({ ...base, distance_real_m: 0, total_weight: Infinity,
        path: [], road_types: [], has_cycleway: false, needs_infrastructure: true, status: 'no_path_found' })
      return
    }

    const fromKey = snapped[from.id]
    const pathInfo = recoverPath(dj.prev, fromKey, toKey)
    if (!pathInfo) {
      gaps.push({ ...base, distance_real_m: 0, total_weight: Infinity,
        path: [], road_types: [], has_cycleway: false, needs_infrastructure: true, status: 'no_path_found' })
      return
    }

    edges.push({
      ...base,
      distance_real_m: Math.round(pathInfo.realDist),
      total_weight: Math.round(dj.dist[toKey]),
      path: pathInfo.segments,
      road_types: pathInfo.highwayTypes,
      has_cycleway: pathInfo.hasCycleway,
      needs_infrastructure: pathInfo.needsInfrastructure,
      status: 'routed',
    })
  }

  const hubs     = nodes.filter(n => n.node_type === 'hub')
  const villages = nodes.filter(n => n.node_type === 'village_center')
  const center   = nodes.find(n => n.node_type === 'city_center')
  const historics = nodes.filter(n => n.node_type === 'historic')

  // Rule 1: village → city center (type A)
  if (center) for (const v of villages) addEdge(v, center, 'A')

  // Rule 2: hub → 3 nearest hubs (type B)
  for (const hub of hubs) {
    hubs.filter(h => h.id !== hub.id)
      .map(h => ({ h, d: haversineM(hub.lat, hub.lng, h.lat, h.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ h }) => addEdge(hub, h, 'B'))
  }

  // Rule 3: village → nearest hub within 2000m (type B)
  for (const v of villages) {
    const near = hubs
      .map(h => ({ h, d: haversineM(v.lat, v.lng, h.lat, h.lng) }))
      .filter(x => x.d <= 2000)
      .sort((a, b) => a.d - b.d)
    if (near.length) addEdge(v, near[0].h, 'B')
  }

  // Rule 4: historic → nearest hub within 2000m (type C)
  for (const hist of historics) {
    const near = hubs
      .map(h => ({ h, d: haversineM(hist.lat, hist.lng, h.lat, h.lng) }))
      .filter(x => x.d <= 2000)
      .sort((a, b) => a.d - b.d)
    if (near.length) addEdge(hist, near[0].h, 'C')
  }

  return { edges, gaps }
}

// ── Main entry point ──────────────────────────────────────────────────────────
export function runRadAlgorithm(hubs, venues, historicEls, villageEls, bikeParkingsGJ, busStopsGJ, roadsGJ, footwaysGJ) {
  const graph = buildRoadGraph(roadsGJ, footwaysGJ)
  const graphKeys = Object.keys(graph)
  const spatialIdx = buildSpatialIndex(graphKeys)
  const nodes = buildNodes(hubs, venues, historicEls, villageEls, bikeParkingsGJ, busStopsGJ)
  const { edges, gaps } = buildEdges(nodes, graph, spatialIdx)
  return { nodes, edges, gaps }
}

// ── GeoJSON builders for MapLibre sources ─────────────────────────────────────
export function nodesGeoJSON(nodes) {
  return {
    type: 'FeatureCollection',
    features: nodes.map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
      properties: {
        id: n.id, name: n.name, node_type: n.node_type, order: n.order,
        hubType: n.hubType || null, priority: n.priority || null,
      },
    })),
  }
}

export function edgesGeoJSON(edges) {
  return {
    type: 'FeatureCollection',
    features: edges.map(e => {
      const coords = e.path.length
        ? [e.path[0][0], ...e.path.map(s => s[1])]
        : [[e.fromLng, e.fromLat], [e.toLng, e.toLat]]
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          id: e.id, route_type: e.route_type,
          needs_infrastructure: e.needs_infrastructure,
          has_cycleway: e.has_cycleway,
          total_weight: e.total_weight,
          distance_real_m: e.distance_real_m,
        },
      }
    }),
  }
}

export function gapsGeoJSON(gaps) {
  return {
    type: 'FeatureCollection',
    features: gaps.map(g => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[g.fromLng, g.fromLat], [g.toLng, g.toLat]] },
      properties: { id: g.id, route_type: g.route_type },
    })),
  }
}
