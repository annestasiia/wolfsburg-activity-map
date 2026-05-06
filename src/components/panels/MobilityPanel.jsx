import React, { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { computeBbox, inBbox, getCoordList } from '../../utils/geoUtils'

function parseLeisureRoutes(geoJSON) {
  if (!geoJSON?.features) return []
  return geoJSON.features
    .map(f => ({
      id:      f.properties._id,
      name:    f.properties.name || f.properties.description || '',
      ref:     f.properties.ref  || '',
      from:    f.properties.from || '',
      to:      f.properties.to   || '',
      network: f.properties.network || '',
      route:   f.properties.route   || 'bicycle',
    }))
    .filter(r => r.name || r.ref)
    .sort((a, b) => (a.name || a.ref).localeCompare(b.name || b.ref))
}

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
    activeMobilityModes,
    mobilityDataLoading,
    mobilityScoresPerMode,
    mobilityDataCache,
    mobilityOverlayPerMode,
    mobilityHighlightRoute,   setMobilityHighlightRoute,
    transitStopsGeoJSON,
    cyclingParkingGeoJSON,
    cyclingRoutesGeoJSON,
    cyclingHighlightLeisureRoute, setCyclingHighlightLeisureRoute,
    selectedMobilityDistrict,     setSelectedMobilityDistrict,
    districtBoundaries,
  } = useAppStore()

  const modes = [...activeMobilityModes]

  // Primary mode for stats display (transport > cycling > automobile)
  const primaryMode = modes.length === 1
    ? modes[0]
    : modes.find(m => m === 'transport') || modes.find(m => m === 'cycling') || modes[0]

  const mobilityScores        = primaryMode ? (mobilityScoresPerMode[primaryMode] || {}) : {}
  const mobilityOverlayGeoJSON = primaryMode ? (mobilityOverlayPerMode[primaryMode] || null) : null
  const leisureRoutes          = parseLeisureRoutes(cyclingRoutesGeoJSON)
  const routes                 = parseRoutes(mobilityDataCache)

  const topDistricts = Object.entries(mobilityScores)
    .filter(([, v]) => v > 0 && v < 10)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  const hasTransit = activeMobilityModes.has('transport')
  const hasCycling = activeMobilityModes.has('cycling')

  // Determine which mode to show district detail for
  const statMode = selectedMobilityDistrict
    ? (hasTransit ? 'transport' : hasCycling ? 'cycling' : null)
    : null

  const districtStats = useMemo(() => {
    if (!statMode) return null
    const distGeoJSON = districtBoundaries[selectedMobilityDistrict]
    if (!distGeoJSON) return null
    const bbox = computeBbox(distGeoJSON)

    if (statMode === 'transport') {
      const stopCount = (transitStopsGeoJSON?.features || []).filter(f => {
        if (!f.geometry?.coordinates) return false
        const [lng, lat] = f.geometry.coordinates
        return inBbox(lng, lat, bbox)
      }).length

      const allRoutes = parseRoutes(mobilityDataCache)
      const overlay   = mobilityOverlayPerMode['transport']
      const routeIds  = new Set(
        (overlay?.features || [])
          .filter(f => {
            const coords = getCoordList(f.geometry)
            return coords.some(([lng, lat]) => inBbox(lng, lat, bbox))
          })
          .map(f => f.properties._id)
      )
      const districtRoutes = allRoutes.filter(r => routeIds.has(r.id))
      return { mode: 'transport', district: selectedMobilityDistrict, stopCount, routes: districtRoutes }
    }

    if (statMode === 'cycling') {
      const spots = (cyclingParkingGeoJSON?.features || []).filter(f => {
        if (!f.geometry?.coordinates) return false
        const [lng, lat] = f.geometry.coordinates
        return inBbox(lng, lat, bbox)
      })
      const totalCapacity = spots.reduce((sum, f) => sum + (f.properties?.capacity || 1), 0)

      const overlay  = mobilityOverlayPerMode['cycling']
      const routeIds = new Set(
        (cyclingRoutesGeoJSON?.features || [])
          .filter(f => {
            const coords = getCoordList(f.geometry)
            return coords.some(([lng, lat]) => inBbox(lng, lat, bbox))
          })
          .map(f => f.properties._id)
      )
      const districtLeisureRoutes = leisureRoutes.filter(r => routeIds.has(r.id))
      return { mode: 'cycling', district: selectedMobilityDistrict, parkingCount: spots.length, totalCapacity, districtLeisureRoutes }
    }

    return null
  }, [statMode, selectedMobilityDistrict, districtBoundaries,
      transitStopsGeoJSON, mobilityOverlayPerMode, mobilityDataCache,
      cyclingParkingGeoJSON, cyclingRoutesGeoJSON, leisureRoutes])

  return (
    <div>
      <p className="panel-label">Mobility Analysis</p>

      {/* ── No mode selected ── */}
      {modes.length === 0 && (
        <p style={{ fontSize: 13, color: '#6E6E73', letterSpacing: '-0.01em' }}>
          Select a transport mode from the left panel to begin analysis.
        </p>
      )}

      {/* ── Loading ── */}
      {mobilityDataLoading && (
        <p style={{ fontSize: 13, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
          Loading network data…
        </p>
      )}

      {/* ── District detail: Transport ── */}
      {!mobilityDataLoading && districtStats?.mode === 'transport' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setSelectedMobilityDistrict(null)}
              style={{
                background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', color: '#3D3D3F',
              }}
            >
              ← All routes
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>
              {districtStats.district}
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#E8F4FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          }}>
            <span style={{ fontSize: 22 }}>🚏</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0055CC', lineHeight: 1 }}>
                {districtStats.stopCount}
              </div>
              <div style={{ fontSize: 12, color: '#5588AA', marginTop: 2 }}>bus stops in district</div>
            </div>
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6 }}>
            Routes through district · {districtStats.routes.length}
          </p>
          {districtStats.routes.length === 0 ? (
            <p style={{ fontSize: 12, color: '#AEAEB2' }}>No routes found in this district.</p>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 6, maxHeight: 200, overflowY: 'auto', paddingRight: 4,
            }}>
              {districtStats.routes.map(r => {
                const isSelected = mobilityHighlightRoute === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => setMobilityHighlightRoute(isSelected ? null : r.id)}
                    style={{
                      display: 'flex', gap: 8, alignItems: 'center',
                      background: isSelected ? '#FFF0F0' : '#F5F5F7',
                      border: `1px solid ${isSelected ? '#FF1744' : 'rgba(0,0,0,0.06)'}`,
                      borderRadius: 10, padding: '7px 11px',
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit', transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 1px 6px rgba(255,23,68,0.20)' : 'none',
                    }}
                  >
                    {r.ref && (
                      <span style={{
                        background: isSelected ? '#FF1744' : '#FF4D6D',
                        color: '#fff', borderRadius: 6, padding: '1px 7px',
                        fontWeight: 700, fontSize: 12, flexShrink: 0,
                        minWidth: 28, textAlign: 'center',
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
          )}
          <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>Source: OpenStreetMap</p>
        </div>
      )}

      {/* ── District detail: Cycling ── */}
      {!mobilityDataLoading && districtStats?.mode === 'cycling' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setSelectedMobilityDistrict(null)}
              style={{
                background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', color: '#3D3D3F',
              }}
            >
              ← Districts
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>
              {districtStats.district}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              background: '#E8FFF0', borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 22 }}>🅿️</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#007A33', lineHeight: 1 }}>
                  {districtStats.parkingCount}
                </div>
                <div style={{ fontSize: 12, color: '#2E7D53', marginTop: 2 }}>parking spots</div>
              </div>
            </div>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              background: '#F0FFF4', borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 22 }}>🚲</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#007A33', lineHeight: 1 }}>
                  {districtStats.totalCapacity}
                </div>
                <div style={{ fontSize: 12, color: '#2E7D53', marginTop: 2 }}>total capacity</div>
              </div>
            </div>
          </div>

          {districtStats.districtLeisureRoutes?.length > 0 && (
            <>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6 }}>
                Leisure routes · {districtStats.districtLeisureRoutes.length}
              </p>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 5,
                maxHeight: 160, overflowY: 'auto', paddingRight: 4,
              }}>
                {districtStats.districtLeisureRoutes.map(r => {
                  const isSelected = cyclingHighlightLeisureRoute === r.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => setCyclingHighlightLeisureRoute(isSelected ? null : r.id)}
                      style={{
                        display: 'flex', gap: 8, alignItems: 'center',
                        background: isSelected ? '#FFF4EC' : '#F5F5F7',
                        border: `1px solid ${isSelected ? '#FF6900' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 10, padding: '7px 11px',
                        fontSize: 13, cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit', transition: 'all 0.15s ease',
                      }}
                    >
                      {r.ref && (
                        <span style={{
                          background: isSelected ? '#FF6900' : '#FF8C42',
                          color: '#fff', borderRadius: 6, padding: '1px 7px',
                          fontWeight: 700, fontSize: 12, flexShrink: 0,
                        }}>{r.ref}</span>
                      )}
                      <span style={{ color: '#3D3D3F', lineHeight: 1.3, fontSize: 12 }}>
                        {r.from && r.to ? `${r.from} → ${r.to}` : r.name || 'Route'}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', color: '#FF6900', fontSize: 11, flexShrink: 0 }}>
                          on map ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>
            Source: OpenStreetMap · capacity based on tagged values
          </p>
        </div>
      )}

      {/* ── Cycling all leisure routes ── */}
      {!mobilityDataLoading && !selectedMobilityDistrict && hasCycling && leisureRoutes.length > 0 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 6 }}>
            Leisure cycling routes · {leisureRoutes.length} found
          </p>
          <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 10, letterSpacing: '-0.01em' }}>
            Click a route to highlight on map · click a district for local stats
          </p>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 5,
            maxHeight: 240, overflowY: 'auto', paddingRight: 4,
          }}>
            {leisureRoutes.map(r => {
              const isSelected = cyclingHighlightLeisureRoute === r.id
              return (
                <button
                  key={r.id}
                  onClick={() => setCyclingHighlightLeisureRoute(isSelected ? null : r.id)}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    background: isSelected ? '#FFF4EC' : '#F5F5F7',
                    border: `1px solid ${isSelected ? '#FF6900' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 10, padding: '7px 11px',
                    fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 6px rgba(255,105,0,0.20)' : 'none',
                  }}
                >
                  {r.ref && (
                    <span style={{
                      background: isSelected ? '#FF6900' : '#FF8C42',
                      color: '#fff', borderRadius: 6, padding: '1px 7px',
                      fontWeight: 700, fontSize: 12, flexShrink: 0,
                      minWidth: 28, textAlign: 'center',
                    }}>{r.ref}</span>
                  )}
                  <span style={{ color: '#3D3D3F', lineHeight: 1.3, fontSize: 12 }}>
                    {r.from && r.to ? `${r.from} → ${r.to}` : r.name || 'Route'}
                  </span>
                  {r.network && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#AEAEB2', flexShrink: 0 }}>
                      {r.network}
                    </span>
                  )}
                  {isSelected && (
                    <span style={{ marginLeft: r.network ? 4 : 'auto', color: '#FF6900', fontSize: 11, flexShrink: 0 }}>
                      on map ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>
            Source: OpenStreetMap · official routes from wolfsburg.de/radfahren
          </p>
        </div>
      )}

      {/* ── Transit all routes ── */}
      {!mobilityDataLoading && !selectedMobilityDistrict && hasTransit && routes.length > 0 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 6 }}>
            Public transport routes · {routes.length} found
          </p>
          <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 10, letterSpacing: '-0.01em' }}>
            Click a route to highlight · click a district on the map for details
          </p>
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap:                  6,
            maxHeight:            220,
            overflowY:           'auto',
            paddingRight:         4,
          }}>
            {routes.map(r => {
              const isSelected = mobilityHighlightRoute === r.id
              return (
                <button
                  key={r.id}
                  onClick={() => setMobilityHighlightRoute(isSelected ? null : r.id)}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    background: isSelected ? '#FFF0F0' : '#F5F5F7',
                    border: `1px solid ${isSelected ? '#FF1744' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 10, padding: '7px 11px',
                    fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 6px rgba(255,23,68,0.20)' : 'none',
                  }}
                >
                  {r.ref && (
                    <span style={{
                      background: isSelected ? '#FF1744' : '#FF4D6D',
                      color: '#fff', borderRadius: 6, padding: '1px 7px',
                      fontWeight: 700, fontSize: 12, flexShrink: 0,
                      minWidth: 28, textAlign: 'center',
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
          <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>Source: OpenStreetMap</p>
        </div>
      )}

      {/* ── Top districts bar chart ── */}
      {!mobilityDataLoading && !selectedMobilityDistrict && !hasCycling && !hasTransit && topDistricts.length > 0 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 10 }}>
            Most connected districts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {topDistricts.map(([name, score]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 130, fontSize: 13, color: '#1D1D1F', flexShrink: 0 }}>{name}</div>
                <div style={{ flex: 1, height: 8, background: '#E8E8ED', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width:        `${score * 10}%`,
                    height:       '100%',
                    background:    score <= 4 ? '#FF8FA3' : score <= 7 ? '#FF4D6D' : '#FF1744',
                    borderRadius:  4,
                    transition:   'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: 12, color: '#6E6E73', width: 24, textAlign: 'right' }}>
                  {score}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>
            Score 1–9 · Source: OpenStreetMap
          </p>
        </div>
      )}

      {/* ── Hint ── */}
      {!mobilityDataLoading && modes.length > 0 && !selectedMobilityDistrict
        && topDistricts.length === 0 && !hasTransit && !hasCycling && (
        <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 4, letterSpacing: '-0.01em' }}>
          Districts colored by connectivity to city center · click a district for details
        </p>
      )}
    </div>
  )
}
