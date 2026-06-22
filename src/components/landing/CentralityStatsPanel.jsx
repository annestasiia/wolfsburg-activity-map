import React, { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export const CENT_STAT_TABS = [
  { id: 'centrality', label: 'All modes' },
  { id: 'walk',       label: 'Walk'      },
  { id: 'bike',       label: 'Bike'      },
  { id: 'public',     label: 'Public'    },
  { id: 'auto',       label: 'Auto'      },
]

const TAB_CFG = {
  centrality: { label: 'All Modes (avg.)',   color: '#1D1D1F', yLabel: 'Avg. centrality score (%)' },
  walk:       { label: 'Walk',               color: '#16A34A', yLabel: 'Walk centrality (%)'        },
  bike:       { label: 'Bike',               color: '#059669', yLabel: 'Bike centrality (%)'        },
  public:     { label: 'Public Transit',     color: '#CA8A04', yLabel: 'Public centrality (%)'      },
  auto:       { label: 'Auto',               color: '#DC2626', yLabel: 'Auto centrality (%)'        },
}

// Keys inside centralitydata GeoJSON feature.properties
// CentralityMapSection MODE_CONFIG maps: walk→'w', bike→'b', auto→'a', public→'p'
const PROP = { walk: 'w', bike: 'b', auto: 'a', public: 'p' }

const MODE_LIST = [
  { key: 'walk',   propKey: 'w', color: '#16A34A', label: 'Walk'   },
  { key: 'bike',   propKey: 'b', color: '#059669', label: 'Bike'   },
  { key: 'public', propKey: 'p', color: '#CA8A04', label: 'Public' },
  { key: 'auto',   propKey: 'a', color: '#DC2626', label: 'Auto'   },
]

// ── Score computation ─────────────────────────────────────────────────────────
function computeScores(districtBoundaries, localCentrality) {
  const names = Object.keys(districtBoundaries)
  if (!names.length || !localCentrality?.features?.length) return { names: [], scores: {} }

  // Build bboxes per district
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

  // Precompute all centrality point coordinates + scores
  const pts = []
  for (const f of localCentrality.features) {
    const g = f.geometry
    if (g?.type !== 'Point') continue
    const [lo, la] = g.coordinates
    const p = f.properties || {}
    pts.push({
      lo, la,
      w: p.w ?? p.score_walk  ?? 0,
      b: p.b ?? p.score_bike  ?? 0,
      a: p.a ?? p.score_drive ?? 0,
      p: p.p ?? p.score_pt    ?? 0,
    })
  }

  // Accumulate sums per district (bbox approach)
  const acc = {}
  for (const name of names)
    acc[name] = { w: 0, b: 0, a: 0, p: 0, cnt: 0 }

  for (const pt of pts) {
    for (const name of names) {
      const [x0, y0, x1, y1] = bboxes[name]
      if (pt.lo >= x0 && pt.lo <= x1 && pt.la >= y0 && pt.la <= y1) {
        acc[name].w += pt.w; acc[name].b += pt.b; acc[name].a += pt.a; acc[name].p += pt.p
        acc[name].cnt++
      }
    }
  }

  // Average → normalise to 0–1
  const avg = {}
  for (const name of names) {
    const c = acc[name].cnt || 1
    avg[name] = { w: acc[name].w / c, b: acc[name].b / c, a: acc[name].a / c, p: acc[name].p / c }
  }

  const maxOf = key => Math.max(...names.map(n => avg[n][key]), 1)
  const mW = maxOf('w'), mB = maxOf('b'), mA = maxOf('a'), mP = maxOf('p')

  const scores = {}
  for (const name of names)
    scores[name] = {
      walk:   avg[name].w / mW,
      bike:   avg[name].b / mB,
      auto:   avg[name].a / mA,
      public: avg[name].p / mP,
      all:    (avg[name].w / mW + avg[name].b / mB + avg[name].a / mA + avg[name].p / mP) / 4,
    }

  return { names: [...names].sort((a, b) => a.localeCompare(b, 'de')), scores }
}

// ── SVG chart constants ───────────────────────────────────────────────────────
const MT = 12, MR = 16, MB = 92, ML = 48
const SLOT = 28
const CH   = 160

export default function CentralityStatsPanel({ centralityTab, onCentralityTabChange }) {
  const { districtBoundaries, localCentrality } = useAppStore()

  const { names, scores } = useMemo(
    () => computeScores(districtBoundaries, localCentrality),
    [districtBoundaries, localCentrality],
  )

  if (!names.length) return null

  const cfg    = TAB_CFG[centralityTab] || TAB_CFG.centrality
  const n      = names.length
  const VW     = ML + n * SLOT + MR
  const VH     = MT + CH + MB
  const isAll  = centralityTab === 'centrality'
  const barW   = isAll ? SLOT * 0.2 : SLOT * 0.6
  const gap    = SLOT * 0.08
  const yTicks = [0, 25, 50, 75, 100]

  return (
    <section style={{ padding: '44px 72px 48px', background: '#fff', borderTop: '1px solid #E8E8E8' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h2 style={{
          fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700,
          color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
        }}>
          Statistics
        </h2>

        {/* Tab switcher — same design as map */}
        <div style={{
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E0E0E0',
          borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        }}>
          {CENT_STAT_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => onCentralityTabChange?.(id)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: F, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              background: centralityTab === id ? '#1D1D1F' : 'transparent',
              color:      centralityTab === id ? '#fff'    : '#666',
              transition: 'background 0.15s, color 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Y-axis label + legend for combined view */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: F, fontSize: 10, color: '#BBB' }}>{cfg.yLabel}</span>
        {isAll && (
          <div style={{ display: 'flex', gap: 16 }}>
            {MODE_LIST.map(({ key, color, label }) => (
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
        {yTicks.map(pct => {
          const y = MT + CH * (1 - pct / 100)
          return (
            <g key={pct}>
              <line x1={ML} y1={y} x2={ML + n * SLOT} y2={y}
                stroke={pct === 0 ? '#DDD' : '#F0F0F0'} strokeWidth={pct === 0 ? 1 : 0.5} />
              <text x={ML - 5} y={y + 3.5} textAnchor="end" fontFamily={F} fontSize={7} fill="#AAA">{pct}%</text>
            </g>
          )
        })}
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#E0E0E0" strokeWidth={0.8} />

        {names.map((name, i) => {
          const cx   = ML + (i + 0.5) * SLOT
          const base = MT + CH

          let bars
          if (isAll) {
            const totalW = 4 * barW + 3 * gap
            const sx = cx - totalW / 2
            bars = MODE_LIST.map(({ key, color }, mi) => {
              const h = Math.max((scores[name]?.[key] || 0) * CH, 0.5)
              return <rect key={key} x={sx + mi * (barW + gap)} y={base - h} width={barW} height={h} fill={color} opacity={0.82} rx={0.8} />
            })
          } else {
            const h = Math.max((scores[name]?.[centralityTab] || 0) * CH, 0.5)
            bars = <rect x={cx - barW / 2} y={base - h} width={barW} height={h} fill={cfg.color} opacity={0.85} rx={1} />
          }

          return (
            <g key={name}>
              {bars}
              <text transform={`translate(${cx},${base + 6}) rotate(-45)`}
                textAnchor="end" fontFamily={F} fontSize={7.5} fill="#666">{name}</text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
