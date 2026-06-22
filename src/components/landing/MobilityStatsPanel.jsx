import React, { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

// Colors matching the Mobility map layers
const MODE = {
  auto:    { label: 'Auto',           color: '#C10016' },
  public:  { label: 'Public Transit', color: '#5539CC' },
  cycling: { label: 'Cycling',        color: '#004225' },
}

// ── Build district bbox from its GeoJSON ──────────────────────────────────────
function districtBbox(fc) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  const add = ([lo, la]) => {
    if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo
    if (la < minLat) minLat = la; if (la > maxLat) maxLat = la
  }
  for (const f of (fc?.features || [])) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(add))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(add)))
  }
  return { minLon, maxLon, minLat, maxLat }
}

// Count features (points or line-start-coords) inside a bbox
function countInBbox(coords, bbox) {
  const { minLon, maxLon, minLat, maxLat } = bbox
  let n = 0
  for (const [lo, la] of coords)
    if (lo >= minLon && lo <= maxLon && la >= minLat && la <= maxLat) n++
  return n
}

// ── Compute normalised per-district scores (0–1) for all 3 modes ─────────────
function computeAllScores(districtBoundaries, roads, localBusStops, localCyclingOfficial) {
  const names = Object.keys(districtBoundaries)
  if (!names.length) return {}

  // Precompute bbox per district
  const bboxes = {}
  for (const name of names) bboxes[name] = districtBbox(districtBoundaries[name])

  // Precompute coordinate arrays from each dataset
  const roadCoords = (roads?.features || [])
    .map(f => f.geometry?.coordinates?.[0]).filter(Boolean)

  const busCoords = (localBusStops?.features || [])
    .map(f => f.geometry?.coordinates)
    .filter(c => c && !Array.isArray(c[0]))

  // Cycling: collect all segment start-points from LineStrings
  const cycleCoords = []
  for (const f of (localCyclingOfficial?.features || [])) {
    const g = f.geometry; if (!g) continue
    const lines = g.type === 'LineString' ? [g.coordinates]
                : g.type === 'MultiLineString' ? g.coordinates : []
    for (const line of lines) if (line[0]) cycleCoords.push(line[0])
  }

  const raw = { auto: {}, public: {}, cycling: {} }
  for (const name of names) {
    const bbox = bboxes[name]
    raw.auto[name]    = countInBbox(roadCoords,  bbox)
    raw.public[name]  = countInBbox(busCoords,   bbox)
    raw.cycling[name] = countInBbox(cycleCoords, bbox)
  }

  // Normalise each mode independently to 0–1
  const result = {}
  for (const name of names) result[name] = {}
  for (const mode of ['auto', 'public', 'cycling']) {
    const vals = names.map(n => raw[mode][n])
    const maxV = Math.max(...vals, 1)
    for (const name of names) result[name][mode] = raw[mode][name] / maxV
  }
  return result
}

// ── Bar component ─────────────────────────────────────────────────────────────
function Bar({ value, color, active, width = 120 }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width, height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color,
          opacity: active ? 1 : 0.25,
          borderRadius: 2,
          transition: 'width 0.35s ease, opacity 0.25s',
        }} />
      </div>
      <span style={{
        fontFamily: 'monospace', fontSize: 10,
        color: active ? '#111' : '#bbb',
        minWidth: 28, textAlign: 'right',
        transition: 'color 0.25s',
      }}>
        {pct}%
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MobilityStatsPanel({ mobilityTab }) {
  const { districtBoundaries, roads, localBusStops, localCyclingOfficial } = useAppStore()

  const scores = useMemo(
    () => computeAllScores(districtBoundaries, roads, localBusStops, localCyclingOfficial),
    [districtBoundaries, roads, localBusStops, localCyclingOfficial],
  )

  const districts = Object.keys(scores)
  if (!districts.length) return null

  // Sort: for a specific mode, descending by that mode; for 'activity', by average
  const sortedDistricts = [...districts].sort((a, b) => {
    if (mobilityTab === 'activity') {
      const avgA = (scores[a].auto + scores[a].public + scores[a].cycling) / 3
      const avgB = (scores[b].auto + scores[b].public + scores[b].cycling) / 3
      return avgB - avgA
    }
    const m = mobilityTab === 'auto' ? 'auto' : mobilityTab === 'public' ? 'public' : 'cycling'
    return scores[b][m] - scores[a][m]
  })

  const isActivity = mobilityTab === 'activity'
  const activeMode = !isActivity && (mobilityTab === 'auto' ? 'auto' : mobilityTab === 'public' ? 'public' : 'cycling')

  // Header label
  const headerLabel = isActivity
    ? 'Average transport accessibility by district'
    : `${MODE[activeMode]?.label || ''} infrastructure density by district`

  return (
    <section style={{
      padding: '52px 72px 60px',
      background: '#FAFAF9',
      borderTop: '1px solid #E8E8E8',
      borderBottom: '1px solid #E8E8E8',
    }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>
            Mobility · District Analysis
          </div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 600, color: '#111' }}>
            {headerLabel}
          </div>
        </div>
        {/* Mode legend */}
        <div style={{ display: 'flex', gap: 20 }}>
          {Object.entries(MODE).map(([key, { label, color }]) => {
            const active = isActivity || activeMode === key
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: active ? 1 : 0.3, transition: 'opacity 0.25s' }}>
                <div style={{ width: 20, height: 3, background: color, borderRadius: 2 }} />
                <span style={{ fontFamily: F, fontSize: 11, color: '#555' }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '2px 32px',
      }}>
        {sortedDistricts.map(name => {
          const s = scores[name]
          return (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '8px 0',
              borderBottom: '1px solid #EEEEEE',
            }}>
              {/* District name */}
              <div style={{
                fontFamily: F, fontSize: 11, color: '#444', minWidth: 110, flexShrink: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {name}
              </div>
              {/* Bars */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Object.entries(MODE).map(([key, { color }]) => {
                  const active = isActivity || activeMode === key
                  if (!isActivity && !active) return null
                  return (
                    <Bar
                      key={key}
                      value={s[key]}
                      color={color}
                      active={active}
                      width={isActivity ? 80 : 140}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
