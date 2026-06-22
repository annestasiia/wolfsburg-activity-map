import React, { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const TAB_CFG = {
  activity: { label: 'Activity Map',     color: '#1D1D1F', yLabel: 'Avg. transport accessibility (%)' },
  auto:     { label: 'Auto',             color: '#C10016', yLabel: 'Road network density (%)'          },
  public:   { label: 'Public Transit',   color: '#5539CC', yLabel: 'Bus stop coverage (%)'             },
  cycling:  { label: 'Cycling',          color: '#004225', yLabel: 'Cycling infrastructure (%)'        },
}

const MODES = [
  { key: 'auto',    color: '#C10016', label: 'Auto'    },
  { key: 'public',  color: '#5539CC', label: 'Public'  },
  { key: 'cycling', color: '#004225', label: 'Cycling' },
]

// ── Score computation ─────────────────────────────────────────────────────────
function computeScores(districtBoundaries, roads, localBusStops, localCyclingOfficial) {
  const names = Object.keys(districtBoundaries)
  if (!names.length) return { names: [], scores: {} }

  // Bounding box per district
  const bboxes = {}
  for (const name of names) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    const add = ([lo, la]) => {
      if (lo < x0) x0 = lo; if (lo > x1) x1 = lo
      if (la < y0) y0 = la; if (la > y1) y1 = la
    }
    for (const f of (districtBoundaries[name]?.features || [])) {
      const g = f.geometry; if (!g) continue
      if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(add))
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(add)))
    }
    bboxes[name] = [x0, y0, x1, y1]
  }

  // Feature coordinate pools
  const roadPts  = (roads?.features || []).map(f => f.geometry?.coordinates?.[0]).filter(Boolean)
  const busPts   = (localBusStops?.features || []).map(f => f.geometry?.coordinates).filter(c => c && !Array.isArray(c[0]))
  const cyclePts = []
  for (const f of (localCyclingOfficial?.features || [])) {
    const g = f.geometry; if (!g) continue
    const ls = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []
    for (const line of ls) if (line[0]) cyclePts.push(line[0])
  }

  const countIn = (pts, [x0, y0, x1, y1]) => {
    let n = 0
    for (const [lo, la] of pts) if (lo >= x0 && lo <= x1 && la >= y0 && la <= y1) n++
    return n
  }

  const raw = {}
  for (const name of names)
    raw[name] = {
      auto:    countIn(roadPts,  bboxes[name]),
      public:  countIn(busPts,   bboxes[name]),
      cycling: countIn(cyclePts, bboxes[name]),
    }

  // Normalise each mode to 0–1
  const maxAuto    = Math.max(...names.map(n => raw[n].auto),    1)
  const maxPublic  = Math.max(...names.map(n => raw[n].public),  1)
  const maxCycling = Math.max(...names.map(n => raw[n].cycling), 1)

  const scores = {}
  for (const name of names)
    scores[name] = {
      auto:    raw[name].auto    / maxAuto,
      public:  raw[name].public  / maxPublic,
      cycling: raw[name].cycling / maxCycling,
    }

  return {
    names: [...names].sort((a, b) => a.localeCompare(b, 'de')),
    scores,
  }
}

// ── Chart ─────────────────────────────────────────────────────────────────────
const MT = 12, MR = 16, MB = 92, ML = 48   // SVG margins (units)
const SLOT = 24                              // units per district slot
const CH   = 160                             // chart height (units)

export default function MobilityStatsPanel({ mobilityTab }) {
  const { districtBoundaries, roads, localBusStops, localCyclingOfficial } = useAppStore()

  const { names, scores } = useMemo(
    () => computeScores(districtBoundaries, roads, localBusStops, localCyclingOfficial),
    [districtBoundaries, roads, localBusStops, localCyclingOfficial],
  )

  if (!names.length) return null

  const cfg  = TAB_CFG[mobilityTab] || TAB_CFG.activity
  const n    = names.length
  const VW   = ML + n * SLOT + MR
  const VH   = MT + CH + MB

  const yTicks  = [0, 25, 50, 75, 100]
  const isAct   = mobilityTab === 'activity'
  const modeKey = isAct ? null : mobilityTab

  // Bar sizing
  const barW  = isAct ? SLOT * 0.18 : SLOT * 0.5    // single bar width
  const gap   = SLOT * 0.08                           // gap between grouped bars (activity)

  return (
    <section style={{
      padding: '40px 72px 44px',
      background: '#fff',
      borderTop: '1px solid #E8E8E8',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.13em', textTransform: 'uppercase' }}>
          Statistics
        </span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#CCC', letterSpacing: '0.06em' }}>·</span>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: cfg.color }}>
          {cfg.label}
        </span>
        {/* Activity legend */}
        {isAct && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
            {MODES.map(({ key, color, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
                <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', display: 'block', overflow: 'visible' }}
      >
        {/* Y-axis grid lines + tick labels */}
        {yTicks.map(pct => {
          const y = MT + CH * (1 - pct / 100)
          return (
            <g key={pct}>
              <line
                x1={ML} y1={y} x2={ML + n * SLOT} y2={y}
                stroke={pct === 0 ? '#DDD' : '#F0F0F0'} strokeWidth={pct === 0 ? 1 : 0.5}
              />
              <text x={ML - 5} y={y + 3.5} textAnchor="end" fontFamily={F} fontSize={7} fill="#AAA">
                {pct}%
              </text>
            </g>
          )
        })}

        {/* Y-axis vertical line */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#E0E0E0" strokeWidth={0.8} />

        {/* Y-axis label */}
        <text
          x={10} y={MT + CH / 2}
          transform={`rotate(-90, 10, ${MT + CH / 2})`}
          textAnchor="middle" fontFamily={F} fontSize={7} fill="#BBB"
        >
          {cfg.yLabel}
        </text>

        {/* District bars + labels */}
        {names.map((name, i) => {
          const cx   = ML + (i + 0.5) * SLOT     // center of slot
          const base = MT + CH                    // y of X axis

          let bars
          if (isAct) {
            // 3 grouped bars
            const totalW = 3 * barW + 2 * gap
            const startX = cx - totalW / 2
            bars = MODES.map(({ key, color }, mi) => {
              const h = Math.max((scores[name]?.[key] || 0) * CH, 0.5)
              return (
                <rect
                  key={key}
                  x={startX + mi * (barW + gap)}
                  y={base - h}
                  width={barW}
                  height={h}
                  fill={color}
                  opacity={0.82}
                  rx={0.8}
                />
              )
            })
          } else {
            const h = Math.max((scores[name]?.[modeKey] || 0) * CH, 0.5)
            bars = (
              <rect
                x={cx - barW / 2}
                y={base - h}
                width={barW}
                height={h}
                fill={cfg.color}
                opacity={0.85}
                rx={1}
              />
            )
          }

          return (
            <g key={name}>
              {bars}
              {/* District name — rotated 45° counter-clockwise */}
              <text
                transform={`translate(${cx},${base + 6}) rotate(-45)`}
                textAnchor="end"
                fontFamily={F}
                fontSize={7.5}
                fill="#666"
              >
                {name}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
