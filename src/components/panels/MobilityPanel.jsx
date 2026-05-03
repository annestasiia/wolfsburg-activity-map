import React, { useState } from 'react'
import { useAppStore } from '../../store/appStore'

const SUB_LAYERS = [
  { id: 'transport',  label: 'Public Transport',         icon: '🚌' },
  { id: 'automobile', label: 'Automobile Transport',     icon: '🚗' },
  { id: 'cycling',    label: 'Cycling Accessibility',    icon: '🚲' },
  { id: 'pedestrian', label: 'Pedestrian Accessibility', icon: '🚶' },
]

function parseRoutes(cache) {
  const data = cache?.transport
  if (!data?.elements) return []
  return data.elements
    .filter(el => el.type === 'relation' && el.tags)
    .map(r => ({
      id:   r.id,
      ref:  r.tags.ref  || '',
      name: r.tags.name || r.tags.description || '',
      from: r.tags.from || '',
      to:   r.tags.to   || '',
    }))
    .filter(r => r.ref || r.name)
    .sort((a, b) => String(a.ref).localeCompare(String(b.ref), undefined, { numeric: true }))
}

export default function MobilityPanel() {
  const {
    mobilitySubLayer, setMobilitySubLayer,
    mobilityDataLoading, mobilityScores, mobilityDataCache,
    mobilityHighlightRoute, setMobilityHighlightRoute,
  } = useAppStore()

  const [showStats, setShowStats] = useState(false)

  const activeLayerLabel = SUB_LAYERS.find(s => s.id === mobilitySubLayer)?.label ?? ''
  const routes = parseRoutes(mobilityDataCache)

  const topDistricts = Object.entries(mobilityScores)
    .filter(([, v]) => v > 0 && v < 10)   // exclude central (10) and zero
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  return (
    <div>
      <p className="panel-label">Mobility Analysis</p>

      {/* ── 5-column button row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {SUB_LAYERS.map(s => {
          const active  = mobilitySubLayer === s.id
          const loading = active && mobilityDataLoading
          return (
            <button
              key={s.id}
              onClick={() => { setMobilitySubLayer(s.id); setShowStats(false) }}
              style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:            8,
                padding:       '16px 10px',
                borderRadius:   14,
                background:     active ? '#FF1744' : '#F5F5F7',
                border:        `1px solid ${active ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                cursor:        'pointer',
                transition:    'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fontFamily:    'inherit',
                opacity:        loading ? 0.75 : 1,
                boxShadow:      active ? '0 2px 10px rgba(255,23,68,0.28)' : 'none',
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{loading ? '⏳' : s.icon}</span>
              <span style={{
                fontSize:      12,
                fontWeight:    500,
                color:         active ? '#FFFFFF' : '#1D1D1F',
                textAlign:     'center',
                lineHeight:    1.3,
                letterSpacing: '-0.01em',
              }}>
                {s.label}
              </span>
            </button>
          )
        })}

        {/* ── Statistics column ── */}
        <button
          onClick={() => setShowStats(v => !v)}
          style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:            8,
            padding:       '16px 10px',
            borderRadius:   14,
            background:     showStats ? '#1D1D1F' : '#F5F5F7',
            border:        `1px solid ${showStats ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
            cursor:        'pointer',
            transition:    'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fontFamily:    'inherit',
            boxShadow:      showStats ? '0 2px 10px rgba(0,0,0,0.18)' : 'none',
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1 }}>📊</span>
          <span style={{
            fontSize:      12,
            fontWeight:    500,
            color:         showStats ? '#FFFFFF' : '#1D1D1F',
            textAlign:     'center',
            lineHeight:    1.3,
            letterSpacing: '-0.01em',
          }}>
            Statistics
          </span>
        </button>
      </div>

      {/* ── Status hint ── */}
      {!showStats && mobilitySubLayer && !mobilityDataLoading && (
        <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 12, letterSpacing: '-0.01em' }}>
          Districts colored by connectivity to city center · darker = more connected
        </p>
      )}
      {!showStats && mobilityDataLoading && (
        <p style={{ fontSize: 13, color: '#AEAEB2', marginTop: 12, letterSpacing: '-0.01em' }}>
          Loading network data…
        </p>
      )}

      {/* ── Statistics panel ── */}
      {showStats && (
        <div style={{ marginTop: 16 }}>
          {!mobilitySubLayer ? (
            <p style={{ fontSize: 13, color: '#6E6E73' }}>
              Select a mobility layer first to see statistics.
            </p>
          ) : mobilitySubLayer === 'transport' && routes.length > 0 ? (
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 6 }}>
                Public transport routes · {routes.length} found
              </p>
              <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 10, letterSpacing: '-0.01em' }}>
                Click a route to highlight it on the map
              </p>
              <div style={{
                display:        'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap:             6,
                maxHeight:       220,
                overflowY:       'auto',
                paddingRight:    4,
              }}>
                {routes.map(r => {
                  const isSelected = mobilityHighlightRoute === r.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => setMobilityHighlightRoute(isSelected ? null : r.id)}
                      style={{
                        display:    'flex',
                        gap:         8,
                        alignItems: 'center',
                        background:  isSelected ? '#FFF0F0' : '#F5F5F7',
                        border:     `1px solid ${isSelected ? '#FF1744' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 10,
                        padding:    '7px 11px',
                        fontSize:    13,
                        cursor:     'pointer',
                        textAlign:  'left',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                        boxShadow:   isSelected ? '0 1px 6px rgba(255,23,68,0.20)' : 'none',
                      }}
                    >
                      {r.ref && (
                        <span style={{
                          background:  isSelected ? '#FF1744' : '#FF4D6D',
                          color:       '#fff',
                          borderRadius: 6,
                          padding:    '1px 7px',
                          fontWeight:  700,
                          fontSize:    12,
                          flexShrink:  0,
                          minWidth:    28,
                          textAlign:  'center',
                        }}>{r.ref}</span>
                      )}
                      <span style={{ color: '#3D3D3F', lineHeight: 1.3, fontSize: 12 }}>
                        {r.from && r.to ? `${r.from} → ${r.to}` : r.name || 'Route'}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', color: '#FF1744', fontSize: 11, flexShrink: 0 }}>
                          on map ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>
                Source: OpenStreetMap · stop-by-stop details coming soon
              </p>
            </div>
          ) : topDistricts.length > 0 ? (
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 10 }}>
                Most connected districts · {activeLayerLabel.toLowerCase()}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {topDistricts.map(([name, score]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 130, fontSize: 13, color: '#1D1D1F', flexShrink: 0 }}>
                      {name}
                    </div>
                    <div style={{ flex: 1, height: 8, background: '#E8E8ED', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width:      `${score * 10}%`,
                        height:     '100%',
                        background:  score <= 4 ? '#FF8FA3' : score <= 7 ? '#FF4D6D' : '#FF1744',
                        borderRadius: 4,
                        transition:  'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#6E6E73', width: 24, textAlign: 'right' }}>
                      {score}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>
                Score 1–9 (normalized, excl. central districts) · Source: OpenStreetMap
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#AEAEB2' }}>
              {mobilityDataLoading ? 'Loading…' : 'No data loaded yet. Select a layer above.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
