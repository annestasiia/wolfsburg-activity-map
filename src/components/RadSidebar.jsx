import React, { useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { runRadAlgorithm } from '../utils/radAlgorithm'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const BBOX = '52.32,10.57,52.60,10.98'

const HISTORIC_Q = `[out:json][timeout:60];(
  node["historic"](${BBOX});
  way["historic"](${BBOX});
  node["tourism"~"museum|gallery|artwork|castle|ruins"](${BBOX});
  way["tourism"~"museum|gallery|artwork|castle|ruins"](${BBOX});
);out center;`

const VILLAGES_Q = `[out:json][timeout:30];node["place"~"village|hamlet|suburb|district|quarter"](${BBOX});out body;`

async function overpassFetch(query) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── UI primitives ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, color }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1D1D1F' }}>
      <div onClick={onChange} style={{
        width: 32, height: 18, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
        background: checked ? (color || '#0071E3') : '#E0E0E0', position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 15 : 2, width: 14, height: 14,
          borderRadius: 7, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </label>
  )
}

function SectionHead({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#AEAEB2', marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  )
}

function Divider() { return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 0' }} /> }

const NODE_TYPE_COLOR = {
  hub: '#1D1D1F', city_center: '#0071E3', village_center: '#5856D6',
  facility: '#FF9F0A', historic: '#BF5AF2', bike_parking: '#32ADE6', bus_stop: '#FF453A',
}

const ROUTE_COLOR = { 'A': '#064E3B', 'B': '#15803D', 'C': '#4ADE80', 'B/C': '#86EFAC' }

// ── Rad Sidebar (left panel) ─────────────────────────────────────────────────
export default function RadSidebar() {
  const {
    venues, roads, footways,
    parks, intermodalRawForests,
    intermodalHubs, intermodalRawBusStops, intermodalRawBikeParkings,

    radNodes, radEdges, radGaps, radLoading, radError, radLoadProgress,
    radRawHistoric, radRawVillages,
    radShowBusStops, radShowCarParkings, radShowBikeParkings,
    radShowFacilities, radShowHistoric, radShowParks,
    radHubTypes, radShowAutoRoads, radShowPedestrianRoads,
    radStatusFilter, radShowGaps,
    radSelectedNode, radSelectedEdge,

    setRadNodes, setRadEdges, setRadGaps,
    setRadLoading, setRadError, setRadLoadProgress,
    setRadRawData,
    toggleRadShowBusStops, toggleRadShowCarParkings, toggleRadShowBikeParkings,
    toggleRadShowFacilities, toggleRadShowHistoric, toggleRadShowParks,
    toggleRadHubType, toggleRadShowAutoRoads, toggleRadShowPedestrianRoads,
    setRadStatusFilter, toggleRadShowGaps,
    setRadSelectedNode, setRadSelectedEdge,
  } = useAppStore()

  const dataLoaded = !!(radRawHistoric && radRawVillages)
  const hasHubs = intermodalHubs.length > 0

  const handleLoadData = useCallback(async () => {
    setRadLoading(true)
    setRadError(null)
    setRadLoadProgress('Loading historic & settlement data…')
    try {
      const [historicRaw, villagesRaw] = await Promise.all([
        overpassFetch(HISTORIC_Q),
        overpassFetch(VILLAGES_Q),
      ])
      setRadRawData(historicRaw.elements || [], villagesRaw.elements || [])
      setRadLoadProgress('')
    } catch (err) {
      console.error('Rad load error:', err)
      setRadError('Failed to load OSM data. Check your connection.')
      setRadLoadProgress('')
    } finally {
      setRadLoading(false)
    }
  }, [setRadLoading, setRadError, setRadLoadProgress, setRadRawData])

  const handleRunAnalysis = useCallback(async () => {
    if (!hasHubs) return
    setRadLoading(true)
    setRadError(null)
    setRadLoadProgress('Building road graph…')
    try {
      // small yield to browser before heavy computation
      await new Promise(r => setTimeout(r, 20))
      setRadLoadProgress('Running Dijkstra routing…')
      await new Promise(r => setTimeout(r, 10))
      const { nodes, edges, gaps } = runRadAlgorithm(
        intermodalHubs, venues,
        radRawHistoric || [], radRawVillages || [],
        intermodalRawBikeParkings, intermodalRawBusStops,
        roads, footways,
      )
      setRadNodes(nodes)
      setRadEdges(edges)
      setRadGaps(gaps)
      setRadLoadProgress('')
    } catch (err) {
      console.error('Rad algorithm error:', err)
      setRadError('Analysis failed. Please try again.')
      setRadLoadProgress('')
    } finally {
      setRadLoading(false)
    }
  }, [hasHubs, intermodalHubs, venues, radRawHistoric, radRawVillages,
      intermodalRawBikeParkings, intermodalRawBusStops, roads, footways,
      setRadLoading, setRadError, setRadLoadProgress, setRadNodes, setRadEdges, setRadGaps])

  const hubCount   = radEdges.filter(e => e.route_type === 'B' || e.route_type === 'B/C').length
  const villCount  = radEdges.filter(e => e.route_type === 'A').length
  const histCount  = radEdges.filter(e => e.route_type === 'C').length
  const gapCount   = radGaps.length

  const sidebarStyle = {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 260, zIndex: 20,
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '2px 0 20px rgba(0,0,0,0.10)',
    borderRight: '1px solid rgba(0,0,0,0.06)',
    fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }

  return (
    <div style={sidebarStyle}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Rad Network</div>
        <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>Bike route network analysis</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* No hubs warning */}
        {!hasHubs && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FBBF24', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#78350F', marginBottom: 12 }}>
            ⚠ Please run <strong>Intermodal Hub</strong> analysis first — rad network is built on top of hub locations.
          </div>
        )}

        {/* Data loading */}
        <SectionHead>OSM Data</SectionHead>
        {!dataLoaded ? (
          <button
            onClick={handleLoadData}
            disabled={radLoading}
            style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
              background: radLoading ? '#E5E5EA' : '#0071E3', color: radLoading ? '#AEAEB2' : '#fff',
              fontSize: 13, fontWeight: 600, cursor: radLoading ? 'default' : 'pointer', letterSpacing: '-0.01em' }}>
            {radLoading ? 'Loading…' : 'Load Historic & Villages'}
          </button>
        ) : (
          <div style={{ fontSize: 12, color: '#34C759', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span>✓</span> {(radRawHistoric || []).length} historic sites · {(radRawVillages || []).length} settlements
          </div>
        )}

        {radLoadProgress && (
          <div style={{ fontSize: 12, color: '#0071E3', marginTop: 6 }}>{radLoadProgress}</div>
        )}
        {radError && (
          <div style={{ fontSize: 12, color: '#FF453A', marginTop: 6 }}>{radError}</div>
        )}

        <Divider />

        {/* Data Layers */}
        <SectionHead>Data Layers</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Toggle checked={radShowBusStops}    onChange={toggleRadShowBusStops}    label="Bus stops"      color="#FF453A" />
          <Toggle checked={radShowCarParkings} onChange={toggleRadShowCarParkings} label="Car parking"    color="#6B7280" />
          <Toggle checked={radShowBikeParkings} onChange={toggleRadShowBikeParkings} label="Bike parking" color="#32ADE6" />
          <Toggle checked={radShowFacilities}  onChange={toggleRadShowFacilities}  label="Facilities"     color="#FF9F0A" />
          <Toggle checked={radShowHistoric}    onChange={toggleRadShowHistoric}    label="Historical amenities" color="#BF5AF2" />
          <Toggle checked={radShowParks}       onChange={toggleRadShowParks}       label="Parks & Forests" color="#30D158" />
        </div>

        {/* Hub types */}
        <div style={{ marginTop: 12, fontSize: 12, color: '#6E6E73', marginBottom: 6 }}>Hub types</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'bus_bike',      label: 'Bus + Bike',        c: '#EF4444' },
            { id: 'auto_bike',     label: 'Auto + Bike',       c: '#6B7280' },
            { id: 'auto_bus_bike', label: 'Auto + Bus + Bike', c: '#5856D6' },
          ].map(({ id, label, c }) => (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#1D1D1F' }}>
              <input type="checkbox" checked={radHubTypes.has(id)} onChange={() => toggleRadHubType(id)}
                style={{ accentColor: c, width: 13, height: 13 }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
              {label}
            </label>
          ))}
        </div>

        <Divider />

        {/* Roads */}
        <SectionHead>Roads</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Toggle checked={radShowAutoRoads}       onChange={toggleRadShowAutoRoads}       label="Auto roads"       color="#AEAEB2" />
          <Toggle checked={radShowPedestrianRoads} onChange={toggleRadShowPedestrianRoads} label="Pedestrian paths" color="#32ADE6" />
        </div>

        <Divider />

        {/* Analysis */}
        <SectionHead>Analysis</SectionHead>
        <button
          onClick={handleRunAnalysis}
          disabled={!hasHubs || radLoading}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
            background: (!hasHubs || radLoading) ? '#E5E5EA' : '#1D1D1F',
            color: (!hasHubs || radLoading) ? '#AEAEB2' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: (!hasHubs || radLoading) ? 'default' : 'pointer',
            letterSpacing: '-0.01em' }}>
          {radLoading ? 'Computing routes…' : 'Run Analysis'}
        </button>

        {/* Results summary */}
        {radNodes.length > 0 && (
          <>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { label: 'Nodes', v: radNodes.length },
                { label: 'Routes', v: radEdges.length },
                { label: 'Village→City', v: villCount },
                { label: 'Hub→Hub', v: hubCount },
                { label: 'Historic', v: histCount },
                { label: 'Gaps', v: gapCount },
              ].map(({ label, v }) => (
                <div key={label} style={{ background: '#F5F5F7', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            <Divider />

            {/* Status filter */}
            <SectionHead>Status</SectionHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['all', 'All routes'], ['existing', 'Existing (has cycleway)'], ['proposed', 'Needs infrastructure']].map(([val, lbl]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1D1D1F' }}>
                  <input type="radio" name="rad-status" value={val} checked={radStatusFilter === val} onChange={() => setRadStatusFilter(val)}
                    style={{ accentColor: '#0071E3' }} />
                  {lbl}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <Toggle checked={radShowGaps} onChange={toggleRadShowGaps} label="Show network gaps" color="#FF453A" />
            </div>
          </>
        )}

        <Divider />

        {/* Legend */}
        <SectionHead>Route legend</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { type: 'A', label: 'Village → City Center', thick: 4 },
            { type: 'B', label: 'Hub → Hub / Village → Hub', thick: 3 },
            { type: 'C', label: 'Historic → Hub', thick: 2 },
          ].map(({ type, label, thick }) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ width: 28, height: thick, borderRadius: thick, background: ROUTE_COLOR[type], flexShrink: 0 }} />
              <span style={{ color: '#1D1D1F' }}><strong>{type}</strong> — {label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 28, height: 2, borderRadius: 2, background: '#FF453A', flexShrink: 0,
              backgroundImage: 'repeating-linear-gradient(to right, #FF453A 0, #FF453A 4px, transparent 4px, transparent 8px)' }} />
            <span style={{ color: '#1D1D1F' }}>Gap — no path found</span>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <SectionHead>Node types</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries({
              hub: 'Intermodal Hub', city_center: 'City Center',
              village_center: 'Village/District', facility: 'Top Facility',
              historic: 'Historic site', bike_parking: 'Bike parking', bus_stop: 'Bus stop',
            }).map(([type, label]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#1D1D1F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_TYPE_COLOR[type] || '#6B7280', flexShrink: 0, display: 'inline-block' }} />
                {label}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── RadNodePopup ──────────────────────────────────────────────────────────────
export function RadNodePopup() {
  const { radSelectedNode, radEdges, radGaps, setRadSelectedNode } = useAppStore()
  const node = radSelectedNode
  if (!node) return null

  const connectedEdges = [...radEdges, ...radGaps].filter(e => e.from === node.id || e.to === node.id)

  return (
    <div style={{
      position: 'absolute', top: 16, right: 246, zIndex: 30, width: 300,
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif', overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_TYPE_COLOR[node.node_type] || '#6B7280', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6E6E73' }}>
              {node.node_type?.replace(/_/g, ' ')} · order {node.order}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>{node.name}</div>
        </div>
        <button onClick={() => setRadSelectedNode(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 0 0 8px' }}>×</button>
      </div>
      <div style={{ padding: '10px 16px', maxHeight: 340, overflowY: 'auto' }}>
        {connectedEdges.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#AEAEB2', marginBottom: 6 }}>
              Routes from this point ({connectedEdges.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {connectedEdges.slice(0, 6).map(e => (
                <div key={e.id} style={{ background: '#F5F5F7', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ width: 12, height: 3, borderRadius: 2, background: ROUTE_COLOR[e.route_type] || '#ccc', display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, color: '#1D1D1F' }}>
                      {e.from === node.id ? `→ ${e.toName}` : `← ${e.fromName}`}
                    </span>
                  </div>
                  <div style={{ color: '#6E6E73' }}>
                    {e.status === 'no_path_found' ? '⚠ No path found' : `${(e.distance_real_m / 1000).toFixed(1)} km`}
                    {e.has_cycleway && ' · ✓ Cycleway'}
                    {e.needs_infrastructure && ' · ⚠ Needs infra'}
                  </div>
                </div>
              ))}
              {connectedEdges.length > 6 && (
                <div style={{ fontSize: 11, color: '#AEAEB2', textAlign: 'center' }}>+{connectedEdges.length - 6} more</div>
              )}
            </div>
          </>
        )}
        <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 8 }}>
          {node.lat?.toFixed(5)}, {node.lng?.toFixed(5)}
        </div>
      </div>
    </div>
  )
}

// ── RadEdgePopup ──────────────────────────────────────────────────────────────
export function RadEdgePopup() {
  const { radSelectedEdge, setRadSelectedEdge } = useAppStore()
  const edge = radSelectedEdge
  if (!edge) return null

  const bikeTimeMin = edge.distance_real_m ? Math.round(edge.distance_real_m / (15000 / 60)) : null
  const ebikeTimeMin = edge.distance_real_m ? Math.round(edge.distance_real_m / (25000 / 60)) : null

  return (
    <div style={{
      position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: 340,
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif', overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ width: 20, height: 3, borderRadius: 2, background: ROUTE_COLOR[edge.route_type] || '#ccc', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6E6E73' }}>
              Route {edge.route_type}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>{edge.fromName} → {edge.toName}</div>
        </div>
        <button onClick={() => setRadSelectedEdge(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 0 0 8px' }}>×</button>
      </div>
      <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {edge.status === 'no_path_found' ? (
          <div style={{ gridColumn: '1/-1', background: '#FEE2E2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#991B1B' }}>
            ⚠ No path found — infrastructure gap
          </div>
        ) : (
          <>
            <Stat label="Real distance" value={`${(edge.distance_real_m / 1000).toFixed(2)} km`} />
            <Stat label="Straight line" value={`${(edge.distance_straight_m / 1000).toFixed(2)} km`} />
            {bikeTimeMin && <Stat label="Bike (15 km/h)" value={`${bikeTimeMin} min`} />}
            {ebikeTimeMin && <Stat label="E-bike (25 km/h)" value={`${ebikeTimeMin} min`} />}
            <Stat label="Cycleway" value={edge.has_cycleway ? '✓ Yes' : '✗ No'} ok={edge.has_cycleway} />
            <Stat label="Needs infra" value={edge.needs_infrastructure ? '⚠ Yes' : 'No'} warn={edge.needs_infrastructure} />
          </>
        )}
        {edge.road_types?.length > 0 && (
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>Road types</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {edge.road_types.map(t => (
                <span key={t} style={{ fontSize: 11, background: '#F5F5F7', borderRadius: 6, padding: '2px 7px', color: '#1D1D1F' }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, ok, warn }) {
  return (
    <div style={{ background: '#F5F5F7', borderRadius: 8, padding: '7px 10px' }}>
      <div style={{ fontSize: 11, color: '#6E6E73' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: ok === true ? '#34C759' : warn ? '#FF453A' : '#1D1D1F', marginTop: 1 }}>{value}</div>
    </div>
  )
}
