import React, { useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { runRadAlgorithm } from '../utils/radAlgorithm'
import { makePieSVG } from './IntermodalSidebar'

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
function Toggle({ checked, onChange, label, color, indent = false }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1D1D1F', paddingLeft: indent ? 16 : 0 }}>
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

const ROUTE_COLOR = { 'A': '#064E3B', 'B': '#15803D', 'C': '#4ADE80', 'B/C': '#86EFAC' }

// ── Rad Sidebar (left panel — analysis only) ──────────────────────────────────
export default function RadSidebar() {
  const {
    venues, roads, footways,
    intermodalHubs, intermodalRawBusStops, intermodalRawBikeParkings,

    radNodes, radEdges, radGaps, radLoading, radError, radLoadProgress,
    radRawHistoric, radRawVillages,
    radStatusFilter, radShowGaps,

    setRadNodes, setRadEdges, setRadGaps,
    setRadLoading, setRadError, setRadLoadProgress,
    setRadStatusFilter, toggleRadShowGaps,
    setRadSelectedNode, setRadSelectedEdge,
  } = useAppStore()

  const hasHubs = intermodalHubs.length > 0

  const handleRunAnalysis = useCallback(async () => {
    if (!hasHubs) return
    setRadLoading(true)
    setRadError(null)
    setRadLoadProgress('Building road graph…')
    try {
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

  const hubCount  = radEdges.filter(e => e.route_type === 'B' || e.route_type === 'B/C').length
  const villCount = radEdges.filter(e => e.route_type === 'A').length
  const histCount = radEdges.filter(e => e.route_type === 'C').length
  const gapCount  = radGaps.length

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0,
      width: 260, zIndex: 20,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '2px 0 20px rgba(0,0,0,0.10)',
      borderRight: '1px solid rgba(0,0,0,0.06)',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Rad Network</div>
        <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>Bike route network analysis</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {!hasHubs && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FBBF24', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#78350F', marginBottom: 12 }}>
            ⚠ Please run <strong>Intermodal Hub</strong> analysis first — rad network is built on top of hub locations.
          </div>
        )}

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

        {radLoadProgress && (
          <div style={{ fontSize: 12, color: '#0071E3', marginTop: 6 }}>{radLoadProgress}</div>
        )}
        {radError && (
          <div style={{ fontSize: 12, color: '#FF453A', marginTop: 6 }}>{radError}</div>
        )}

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

      </div>
    </div>
  )
}

// ── RadDataPanel (right panel — data layers, roads, heatmap, intermodal hubs) ──
export function RadDataPanel() {
  const {
    radLoading, radError, radLoadProgress,
    radRawHistoric, radRawVillages,
    radShowBusStops, radShowCarParkings, radShowBikeParkings,
    radShowFacilities, radShowHistoric, radShowParks,
    radHubTypes, radHubObjectScale, intermodalHubs,
    radShowAutoRoads, radShowPedestrianRoads, radShowCycling,
    radShowAutoHeatmap, radShowPedHeatmap,

    setRadLoading, setRadError, setRadLoadProgress, setRadRawData,
    toggleRadShowBusStops, toggleRadShowCarParkings, toggleRadShowBikeParkings,
    toggleRadShowFacilities, toggleRadShowHistoric, toggleRadShowParks,
    toggleRadHubType, setRadHubObjectScale,
    toggleRadShowAutoRoads, toggleRadShowPedestrianRoads, toggleRadShowCycling,
    toggleRadShowAutoHeatmap, toggleRadShowPedHeatmap,
  } = useAppStore()

  const dataLoaded = !!(radRawHistoric && radRawVillages)

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

  const HUB_TYPES = [
    { id: 'bus_bike',      label: 'Bus + Bike' },
    { id: 'auto_bike',     label: 'Auto + Bike' },
    { id: 'auto_bus_bike', label: 'Auto + Bus + Bike' },
  ]

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 260, height: '100%',
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.06)', zIndex: 20,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Data & Layers</div>
        <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>Map overlays for Rad Network</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* OSM Data loading */}
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
          <Toggle checked={radShowBusStops}     onChange={toggleRadShowBusStops}     label="Bus stops"            color="#FF453A" />
          <Toggle checked={radShowCarParkings}  onChange={toggleRadShowCarParkings}  label="Car parking"          color="#6B7280" />
          <Toggle checked={radShowBikeParkings} onChange={toggleRadShowBikeParkings} label="Bike parking"         color="#32ADE6" />
          <Toggle checked={radShowFacilities}   onChange={toggleRadShowFacilities}   label="Facilities"           color="#FF9F0A" />
          <Toggle checked={radShowHistoric}     onChange={toggleRadShowHistoric}     label="Historical amenities" color="#BF5AF2" />
          <Toggle checked={radShowParks}        onChange={toggleRadShowParks}        label="Parks & Forests"      color="#30D158" />
        </div>

        <Divider />

        {/* Intermodal Hubs */}
        <SectionHead>Intermodal Hubs</SectionHead>
        {intermodalHubs.length === 0 ? (
          <div style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 8 }}>Run Intermodal Hub analysis first</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HUB_TYPES.map(({ id, label }) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#1D1D1F' }}>
                <input type="checkbox" checked={radHubTypes.has(id)} onChange={() => toggleRadHubType(id)}
                  style={{ accentColor: '#1D1D1F', width: 13, height: 13, flexShrink: 0 }} />
                <span
                  dangerouslySetInnerHTML={{ __html: makePieSVG(id, 'standard', 20) }}
                  style={{ flexShrink: 0, lineHeight: 0 }}
                />
                <span>{label}</span>
              </label>
            ))}
            <div style={{ fontSize: 11, color: '#AEAEB2' }}>{intermodalHubs.length} hubs loaded</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#6E6E73', minWidth: 36 }}>Size</span>
              <button
                onClick={() => setRadHubObjectScale((radHubObjectScale ?? 1) - 0.25)}
                style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: '#F5F5F7', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D1D1F', flexShrink: 0 }}>−</button>
              <span style={{ fontSize: 12, color: '#1D1D1F', minWidth: 38, textAlign: 'center' }}>×{(radHubObjectScale ?? 1).toFixed(2)}</span>
              <button
                onClick={() => setRadHubObjectScale((radHubObjectScale ?? 1) + 0.25)}
                style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: '#F5F5F7', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D1D1F', flexShrink: 0 }}>+</button>
            </div>
          </div>
        )}

        <Divider />

        {/* Roads */}
        <SectionHead>Roads</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Toggle checked={radShowAutoRoads}       onChange={toggleRadShowAutoRoads}       label="Auto roads"       color="#AEAEB2" />
          {radShowAutoRoads && (
            <Toggle checked={radShowAutoHeatmap} onChange={toggleRadShowAutoHeatmap} label="Heatmap (by type)" color="#EF4444" indent />
          )}
          <Toggle checked={radShowPedestrianRoads} onChange={toggleRadShowPedestrianRoads} label="Pedestrian paths" color="#32ADE6" />
          {radShowPedestrianRoads && (
            <Toggle checked={radShowPedHeatmap} onChange={toggleRadShowPedHeatmap} label="Heatmap (activity)" color="#F59E0B" indent />
          )}
          <Toggle checked={radShowCycling}         onChange={toggleRadShowCycling}         label="Cycling paths"    color="#10B981" />
        </div>

        {/* Heatmap legend */}
        {radShowAutoHeatmap && (
          <>
            <div style={{ marginTop: 10, fontSize: 11, color: '#6E6E73', marginBottom: 6 }}>Road type colors</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { color: '#EF4444', label: 'Motorway / Trunk' },
                { color: '#F59E0B', label: 'Primary' },
                { color: '#84CC16', label: 'Secondary' },
                { color: '#22D3EE', label: 'Tertiary' },
                { color: '#60A5FA', label: 'Residential' },
                { color: '#9CA3AF', label: 'Other' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <div style={{ width: 20, height: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ color: '#1D1D1F' }}>{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

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

  const NODE_TYPE_COLOR = {
    hub: '#1D1D1F', city_center: '#0071E3', village_center: '#5856D6',
    facility: '#FF9F0A', historic: '#BF5AF2', bike_parking: '#32ADE6', bus_stop: '#FF453A',
  }

  return (
    <div style={{
      position: 'absolute', top: 16, right: 276, zIndex: 30, width: 300,
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
