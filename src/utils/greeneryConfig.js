// ── Greenery categories and OSM tag config ─────────────────────────────────

export const GREENERY_CATEGORIES = [
  {
    id: 'parks_recreation',
    label: 'Parks & Recreational Green Space',
    icon: '🌳',
    color: '#52B788',
    tags: [
      { key: 'leisure', value: 'park',               label: 'Parks' },
      { key: 'leisure', value: 'garden',             label: 'Gardens' },
      { key: 'leisure', value: 'nature_reserve',     label: 'Nature reserves' },
      { key: 'leisure', value: 'recreation_ground',  label: 'Recreation grounds' },
      { key: 'landuse', value: 'recreation_ground',  label: 'Recreation grounds' },
      { key: 'leisure', value: 'common',             label: 'Commons' },
    ],
  },
  {
    id: 'grass_open_green',
    label: 'Grass & Open Green Areas',
    icon: '🌿',
    color: '#74C69D',
    tags: [
      { key: 'landuse', value: 'grass',         label: 'Grass' },
      { key: 'landuse', value: 'meadow',        label: 'Meadows' },
      { key: 'landuse', value: 'greenery',      label: 'Greenery' },
      { key: 'landuse', value: 'village_green', label: 'Village greens' },
    ],
  },
  {
    id: 'forests_woods',
    label: 'Forests & Woods',
    icon: '🌲',
    color: '#2D6A4F',
    tags: [
      { key: 'landuse', value: 'forest', label: 'Forests' },
      { key: 'natural', value: 'wood',   label: 'Woods' },
    ],
  },
  {
    id: 'agriculture_planted',
    label: 'Agriculture & Planted Areas',
    icon: '🌾',
    color: '#95D5B2',
    tags: [
      { key: 'landuse', value: 'orchard',    label: 'Orchards' },
      { key: 'landuse', value: 'vineyard',   label: 'Vineyards' },
      { key: 'landuse', value: 'allotments', label: 'Allotments' },
      { key: 'landuse', value: 'farmland',   label: 'Farmland' },
    ],
  },
  {
    id: 'natural_vegetation',
    label: 'Natural Vegetation',
    icon: '🌱',
    color: '#40916C',
    tags: [
      { key: 'natural', value: 'grassland', label: 'Grassland' },
      { key: 'natural', value: 'scrub',     label: 'Scrub' },
      { key: 'natural', value: 'heath',     label: 'Heath' },
      { key: 'natural', value: 'wetland',   label: 'Wetlands' },
    ],
  },
  {
    id: 'individual_vegetation',
    label: 'Individual Vegetation',
    icon: '🌴',
    color: '#1B4332',
    tags: [
      { key: 'natural', value: 'tree',     label: 'Trees' },
      { key: 'natural', value: 'tree_row', label: 'Tree rows' },
      { key: 'barrier', value: 'hedge',    label: 'Hedges' },
    ],
  },
  {
    id: 'protected_conservation',
    label: 'Protected & Conservation Areas',
    icon: '🛡️',
    color: '#B7E4C7',
    tags: [
      { key: 'boundary', value: 'protected_area', label: 'Protected areas' },
      { key: 'leisure',  value: 'nature_reserve', label: 'Nature reserves' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: '🛤️',
    color: '#6B7280',
    tags: [
      { key: 'highway', value: 'footway',       label: 'Footways' },
      { key: 'highway', value: 'path',          label: 'Paths' },
      { key: 'highway', value: 'cycleway',      label: 'Cycleways' },
      { key: 'highway', value: 'pedestrian',    label: 'Pedestrian zones' },
      { key: 'highway', value: 'steps',         label: 'Steps' },
      { key: 'highway', value: 'track',         label: 'Tracks' },
      { key: 'highway', value: 'living_street', label: 'Living streets' },
      { key: 'highway', value: 'residential',   label: 'Residential roads' },
      { key: 'highway', value: 'service',       label: 'Service roads' },
      { key: 'highway', value: 'unclassified',  label: 'Unclassified roads' },
      { key: 'highway', value: 'tertiary',      label: 'Tertiary roads' },
      { key: 'highway', value: 'secondary',     label: 'Secondary roads' },
      { key: 'highway', value: 'primary',       label: 'Primary roads' },
      { key: 'highway', value: 'trunk',         label: 'Trunk roads' },
      { key: 'highway', value: 'motorway',      label: 'Motorways' },
    ],
  },
  {
    id: 'others',
    label: 'Others',
    icon: '🌿',
    color: '#A8D5A2',
    description: 'Other greenery-related OSM features not in predefined categories.',
    tags: [],
  },
]

// MapLibre color expression keyed by _categoryId
export const CATEGORY_FILL_COLORS = {
  parks_recreation:      '#52B788',
  grass_open_green:      '#95D5B2',
  forests_woods:         '#1B4332',
  agriculture_planted:   '#B7E4C7',
  natural_vegetation:    '#40916C',
  individual_vegetation: '#2D6A4F',
  protected_conservation:'#74C69D',
  network:               '#6B7280',
  others:                '#A8D5A2',
}

// MapLibre match expression for fill-color
export const CATEGORY_COLOR_EXPRESSION = [
  'match', ['get', '_categoryId'],
  'parks_recreation',       '#52B788',
  'grass_open_green',       '#95D5B2',
  'forests_woods',          '#1B4332',
  'agriculture_planted',    '#B7E4C7',
  'natural_vegetation',     '#40916C',
  'individual_vegetation',  '#2D6A4F',
  'protected_conservation', '#74C69D',
  'network',                '#6B7280',
  'others',                 '#A8D5A2',
  '#52B788',
]

// ── Green OSM values allowed into "Others" ─────────────────────────────────
// Only explicitly green/nature-related values are accepted; all other OSM
// tag values are discarded and never rendered.
const OTHERS_LANDUSE  = new Set(['cemetery', 'flowerbed', 'greenhouse_horticulture', 'plant_nursery'])
const OTHERS_NATURAL  = new Set(['fell', 'moor', 'tundra', 'floodplain', 'shrubbery'])
const OTHERS_LEISURE  = new Set(['golf_course', 'dog_park', 'bird_hide'])
const OTHERS_BOUNDARY = new Set(['national_park', 'forest_compartment'])

function formatTagLabel(key, value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Returns { categoryId, tagKey, tagValue, tagLabel } or null (discard)
export function classifyFeature(tags) {
  // Try predefined categories first (first match wins; handles leisure=nature_reserve dedup)
  for (const cat of GREENERY_CATEGORIES) {
    if (cat.id === 'others') continue
    for (const tag of cat.tags) {
      if (tags[tag.key] === tag.value) {
        return { categoryId: cat.id, tagKey: tag.key, tagValue: tag.value, tagLabel: tag.label }
      }
    }
  }

  // Whitelist check for Others
  if (tags.landuse  && OTHERS_LANDUSE.has(tags.landuse))
    return { categoryId: 'others', tagKey: 'landuse',  tagValue: tags.landuse,  tagLabel: formatTagLabel('landuse',  tags.landuse) }
  if (tags.natural  && OTHERS_NATURAL.has(tags.natural))
    return { categoryId: 'others', tagKey: 'natural',  tagValue: tags.natural,  tagLabel: formatTagLabel('natural',  tags.natural) }
  if (tags.leisure  && OTHERS_LEISURE.has(tags.leisure))
    return { categoryId: 'others', tagKey: 'leisure',  tagValue: tags.leisure,  tagLabel: formatTagLabel('leisure',  tags.leisure) }
  if (tags.boundary && OTHERS_BOUNDARY.has(tags.boundary))
    return { categoryId: 'others', tagKey: 'boundary', tagValue: tags.boundary, tagLabel: formatTagLabel('boundary', tags.boundary) }

  return null
}

// Increment this whenever queries or classification logic changes so the
// cached GeoJSON is automatically discarded on the next tab visit.
export const GREENERY_QUERY_VERSION = 7

const WOLFSBURG_BBOX = '52.35,10.68,52.52,10.93'

// ── Query 1: greenery/nature features ─────────────────────────────────────
// Uses `out geom;` (inline geometry) — good for polygon-heavy area features.
export const GREENERY_FEATURES_QUERY = `[out:json][timeout:60];
(
  nwr["leisure"~"^(park|garden|nature_reserve|golf_course|dog_park|common|recreation_ground|bird_hide)$"](${WOLFSBURG_BBOX});
  nwr["landuse"~"^(grass|meadow|greenery|village_green|forest|orchard|vineyard|allotments|farmland|cemetery|recreation_ground|flowerbed|greenhouse_horticulture|plant_nursery)$"](${WOLFSBURG_BBOX});
  nwr["natural"~"^(wood|grassland|scrub|heath|wetland|tree|tree_row|fell|moor|tundra|shrubbery)$"](${WOLFSBURG_BBOX});
  nwr["barrier"="hedge"](${WOLFSBURG_BBOX});
  nwr["boundary"~"^(protected_area|national_park|forest_compartment)$"](${WOLFSBURG_BBOX});
);
out geom;`

// ── Query 2: network/highway features ─────────────────────────────────────
// Uses `out body;>;out skel qt;` — the compact node-ref format used by the
// Mobility tab. Shared nodes are emitted once, making the response far
// smaller than `out geom;` for dense road networks.
export const NETWORK_QUERY = `[out:json][timeout:90];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|footway|cycleway|path|pedestrian|steps|track)$"](${WOLFSBURG_BBOX});
);
out body;
>;
out skel qt;`

// ── OSM elements → GeoJSON ─────────────────────────────────────────────────

// Network ways are always LineString — roads/paths are never rendered as areas.
const LINE_ONLY_CATEGORIES = new Set(['network'])

function buildWayGeometry(geometry, categoryId, tagValue) {
  const coords = (geometry || [])
    .map(p => [p.lon, p.lat])
    .filter(c => c[0] != null && c[1] != null)

  if (coords.length < 2) return null

  const isClosed =
    !LINE_ONLY_CATEGORIES.has(categoryId) &&
    coords.length >= 4 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]

  return isClosed
    ? { type: 'Polygon', coordinates: [coords] }
    : { type: 'LineString', coordinates: coords }
}

// Snap key for coordinate comparison (rounds to ~1cm precision).
function ck(c) {
  return `${Math.round(c[0] * 1e6)},${Math.round(c[1] * 1e6)}`
}

// Stitch an array of way segments into closed rings.
// OSM multipolygon member ways are often split across multiple segments that
// share endpoints. This assembles them into complete polygon rings.
function assembleRings(segments) {
  const rings = []
  // Work on shallow copies so we can splice freely
  const pool = segments.map(s => s.slice())

  while (pool.length > 0) {
    let ring = pool.splice(0, 1)[0]
    let progressed = true

    while (ck(ring[0]) !== ck(ring[ring.length - 1]) && progressed) {
      progressed = false
      const headKey = ck(ring[0])
      const tailKey = ck(ring[ring.length - 1])

      for (let i = 0; i < pool.length; i++) {
        const seg    = pool[i]
        const segS   = ck(seg[0])
        const segE   = ck(seg[seg.length - 1])

        if (segS === tailKey) {
          // seg continues ring at its tail
          ring = ring.concat(seg.slice(1))
          pool.splice(i, 1); progressed = true; break
        } else if (segE === tailKey) {
          // seg reversed continues ring at its tail
          ring = ring.concat(seg.slice().reverse().slice(1))
          pool.splice(i, 1); progressed = true; break
        } else if (segE === headKey) {
          // seg prepended to ring head
          ring = seg.concat(ring.slice(1))
          pool.splice(i, 1); progressed = true; break
        } else if (segS === headKey) {
          // seg reversed prepended to ring head
          ring = seg.slice().reverse().concat(ring.slice(1))
          pool.splice(i, 1); progressed = true; break
        }
      }
    }

    // Force-close if still open (broken geometry — best effort)
    if (ck(ring[0]) !== ck(ring[ring.length - 1])) ring.push(ring[0])
    if (ring.length >= 4) rings.push(ring)
  }

  return rings
}

function buildRelationGeometry(members) {
  const outerSegs = []
  const innerSegs = []

  for (const m of (members || [])) {
    if (!m.geometry || m.geometry.length < 2) continue
    const seg = m.geometry
      .map(p => [p.lon, p.lat])
      .filter(c => c[0] != null && c[1] != null)
    if (seg.length < 2) continue
    if (m.role === 'outer') outerSegs.push(seg)
    else if (m.role === 'inner') innerSegs.push(seg)
  }

  if (outerSegs.length === 0) return null

  const outerRings = assembleRings(outerSegs)
  const innerRings = assembleRings(innerSegs)

  if (outerRings.length === 0) return null

  // Build MultiPolygon. For simplicity, assign all inner rings to the first
  // outer (correct for the common single-outer case; good enough for most
  // multi-outer cases where inner rings are clearly inside the largest outer).
  const coordinates = outerRings.length === 1
    ? [[outerRings[0], ...innerRings]]
    : outerRings.map((o, i) => i === 0 ? [o, ...innerRings] : [o])

  return { type: 'MultiPolygon', coordinates }
}

export function greeneryOsmToGeoJSON(elements) {
  const seen = new Set()
  const features = []

  for (const el of elements) {
    const key = `${el.type}_${el.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const tags = el.tags || {}
    const cls = classifyFeature(tags)
    if (!cls) continue

    const props = {
      ...tags,
      _id: el.id,
      _osmType: el.type,
      _categoryId: cls.categoryId,
      _tagKey: cls.tagKey,
      _tagValue: cls.tagValue,
      _tagLabel: cls.tagLabel,
      _name: tags.name || tags['name:en'] || tags['name:de'] || '',
    }

    let geometry = null

    if (el.type === 'node') {
      if (el.lat == null || el.lon == null) continue
      geometry = { type: 'Point', coordinates: [el.lon, el.lat] }
    } else if (el.type === 'way') {
      geometry = buildWayGeometry(el.geometry, cls.categoryId, cls.tagValue)
    } else if (el.type === 'relation') {
      geometry = buildRelationGeometry(el.members)
    }

    if (!geometry) continue
    features.push({ type: 'Feature', geometry, properties: props })
  }

  return { type: 'FeatureCollection', features }
}

// ── Network OSM → GeoJSON ──────────────────────────────────────────────────
// Converts `out body;>;out skel qt;` Overpass response (node-ref format).
// All ways are forced to LineString — roads are never areas.
export function networkOsmToGeoJSON(elements) {
  const nodeMap = {}
  elements.forEach(el => {
    if (el.type === 'node' && el.lat != null) nodeMap[el.id] = [el.lon, el.lat]
  })

  const seen = new Set()
  const features = []

  elements.forEach(el => {
    if (el.type !== 'way') return
    const key = `way_${el.id}`
    if (seen.has(key)) return
    seen.add(key)

    const tags = el.tags || {}
    const cls = classifyFeature(tags)
    if (!cls || cls.categoryId !== 'network') return

    const coords = (el.nodes || []).map(id => nodeMap[id]).filter(Boolean)
    if (coords.length < 2) return

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {
        ...tags,
        _id:         el.id,
        _osmType:    el.type,
        _categoryId: cls.categoryId,
        _tagKey:     cls.tagKey,
        _tagValue:   cls.tagValue,
        _tagLabel:   cls.tagLabel,
        _name:       tags.name || tags['name:en'] || tags['name:de'] || '',
      },
    })
  })

  return features
}

// ── Visibility filter (non-destructive toggle) ─────────────────────────────
// Convention: undefined or true = visible; false = hidden.

export function computeVisibleGeoJSON(allGeoJSON, catToggles, tagToggles, othersTagToggles) {
  if (!allGeoJSON) return { type: 'FeatureCollection', features: [] }

  const features = allGeoJSON.features.filter(f => {
    const catId    = f.properties._categoryId
    const tagKey   = f.properties._tagKey
    const tagValue = f.properties._tagValue

    if (catToggles[catId] === false) return false

    if (catId === 'others') {
      return othersTagToggles[`${tagKey}__${tagValue}`] !== false
    }
    return tagToggles[`${catId}__${tagKey}__${tagValue}`] !== false
  })

  return { type: 'FeatureCollection', features }
}
