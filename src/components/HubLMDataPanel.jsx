import React from 'react'
import { useAppStore } from '../store/appStore'
import { computeFleetPerHub, MODE_META } from '../utils/fleetCalc'

const SANS  = "system-ui, -apple-system, sans-serif"
const SERIF = "'Georgia', 'Times New Roman', serif"
const C = {
  bg:     '#FFFFFF', border: '#E8E8E8',
  text1:  '#111111', text2:  '#444444', text3:  '#888888',
  hubL:   '#1D1D1F', hubM:   '#1D7A3A', hubS:   '#185FA5',
}

const fmt = (n) => n >= 10000 ? `${(n / 10000).toFixed(2)} ha` : `${Math.round(n)} m²`
const fmtKm2 = (m2) => `${(m2 / 1_000_000).toFixed(2)} km²`

function LayerToggle({ label, active, onToggle, color, dot = true }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', padding: '7px 0',
      background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: `1px solid ${C.border}`, textAlign: 'left',
    }}>
      <span style={{ width: 10, height: 10, borderRadius: dot ? '50%' : 2, flexShrink: 0, background: active ? color : C.border, transition: 'background 0.15s' }} />
      <span style={{ fontFamily: SANS, fontSize: 12, color: active ? C.text1 : C.text3, flex: 1 }}>{label}</span>
      <span style={{ width: 28, height: 14, borderRadius: 7, background: active ? C.text1 : C.border, position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
        <span style={{ position: 'absolute', top: 2, left: active ? 14 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
      </span>
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', margin: '14px 0 6px' }}>
      {children}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: color || C.text1, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function FleetMini({ fleetPerHub, tier, color }) {
  if (!fleetPerHub) return null
  const d = fleetPerHub[tier]
  if (!d) return null
  const modes = Object.entries(d).filter(([k, v]) => k !== '_total' && v > 0)
  return (
    <div style={{ marginTop: 4 }}>
      {modes.map(([mode, n]) => (
        <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>{MODE_META[mode]?.label || mode}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: color, fontWeight: 600 }}>{n}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: `1px solid ${C.border}`, marginTop: 2 }}>
        <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text2 }}>Total per hub</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: color }}>{d._total}</span>
      </div>
    </div>
  )
}

function StatusFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      {['all', 'existing', 'proposed'].map(s => (
        <button key={s} onClick={() => onChange(s)} style={{
          flex: 1, padding: '4px 0', borderRadius: 3, border: `1px solid ${value === s ? C.text1 : C.border}`,
          background: value === s ? C.text1 : 'transparent', color: value === s ? '#fff' : C.text3,
          fontFamily: SANS, fontSize: 10, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
        }}>
          {s}
        </button>
      ))}
    </div>
  )
}

export default function HubLMDataPanel() {
  const store = useAppStore()
  const {
    hubLMResults, hubSBusOnly,
    hubLMShowL, toggleHubLMShowL,
    hubLMShowM, toggleHubLMShowM,
    hubLMShowS, toggleHubLMShowS,
    hubLMShowCoverageL,   toggleHubLMShowCoverageL,
    hubLMShowCoverageM,   toggleHubLMShowCoverageM,
    hubLMShowCoverageS,   toggleHubLMShowCoverageS,
    hubLMShowCandidatesL, toggleHubLMShowCandidatesL,
    hubLMShowCandidatesM, toggleHubLMShowCandidatesM,
    hubLMSStatusFilter,   setHubLMSStatusFilter,
    hubLMConfig,
  } = store

  const hubL  = hubLMResults?.hubL
  const hubM  = hubLMResults?.hubM
  const hubS  = hubSBusOnly || []

  const fleetPerHub = hubLMResults
    ? computeFleetPerHub(hubL?.hubs?.length || 1, hubM?.hubs?.length || 1, hubS.length || 1)
    : null

  const hubSRadius = hubLMConfig?.hubSCoverageRadius || 200

  return (
    <div style={{
      position: 'absolute', top: 48, right: 0, bottom: 0, width: 248, zIndex: 200,
      background: C.bg, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>
          Layers
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 16, color: C.text1 }}>Hub Network</div>
      </div>

      <div style={{ flex: 1, padding: '0 14px 24px', overflowY: 'auto' }}>

        {/* ── Hub L ── */}
        <SectionLabel>Hub L — Fleet Depot</SectionLabel>
        <LayerToggle label="Hub L markers" active={hubLMShowL} onToggle={toggleHubLMShowL} color={C.hubL} />
        <LayerToggle label="Coverage (4 km)" active={hubLMShowCoverageL} onToggle={toggleHubLMShowCoverageL} color={C.hubL} dot={false} />
        <LayerToggle label="Candidates" active={hubLMShowCandidatesL} onToggle={toggleHubLMShowCandidatesL} color={C.hubL} />
        {hubL ? (
          <>
            <MiniStat label="Selected" value={`${hubL.hubs.length} hubs`} color={C.hubL} />
            <MiniStat label="Total area" value={fmt(hubL.totalArea)} />
            <MiniStat label="Coverage" value={fmtKm2(hubL.coverageM2)} />
            <MiniStat label="Centre / Outer" value={`${hubL.centreCount} / ${hubL.outerCount}`} />
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, margin: '8px 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fleet per hub</div>
            <FleetMini fleetPerHub={fleetPerHub} tier="hub_l" color={C.hubL} />
          </>
        ) : <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, padding: '4px 0' }}>Run analysis</div>}

        {/* ── Hub M ── */}
        <SectionLabel>Hub M — Transfer Node</SectionLabel>
        <LayerToggle label="Hub M markers" active={hubLMShowM} onToggle={toggleHubLMShowM} color={C.hubM} />
        <LayerToggle label="Coverage (2 km)" active={hubLMShowCoverageM} onToggle={toggleHubLMShowCoverageM} color={C.hubM} dot={false} />
        <LayerToggle label="Candidates" active={hubLMShowCandidatesM} onToggle={toggleHubLMShowCandidatesM} color={C.hubM} />
        {hubM ? (
          <>
            <MiniStat label="Selected" value={`${hubM.hubs.length} hubs`} color={C.hubM} />
            <MiniStat label="Total area" value={fmt(hubM.totalArea)} />
            <MiniStat label="Coverage" value={fmtKm2(hubM.coverageM2)} />
            <MiniStat label="Centre / Outer" value={`${hubM.centreCount} / ${hubM.outerCount}`} />
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, margin: '8px 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fleet per hub</div>
            <FleetMini fleetPerHub={fleetPerHub} tier="hub_m" color={C.hubM} />
          </>
        ) : <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, padding: '4px 0' }}>Run analysis</div>}

        {/* ── Hub S ── */}
        <SectionLabel>Hub S — Bus/Bike Node</SectionLabel>
        <LayerToggle label="Hub S markers" active={hubLMShowS} onToggle={toggleHubLMShowS} color={C.hubS} />
        <LayerToggle label={`Coverage (${hubSRadius} m)`} active={hubLMShowCoverageS} onToggle={toggleHubLMShowCoverageS} color={C.hubS} dot={false} />
        <StatusFilter value={hubLMSStatusFilter} onChange={setHubLMSStatusFilter} />
        {hubS.length > 0 ? (
          <>
            <MiniStat label="Total" value={`${hubS.length} hubs`} color={C.hubS} />
            <MiniStat label="Existing" value={hubS.filter(h => h.status === 'existing').length} />
            <MiniStat label="Proposed" value={hubS.filter(h => h.status === 'proposed').length} />
            <MiniStat label="Coverage" value={fmtKm2(hubS.length * Math.PI * hubSRadius ** 2)} />
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, margin: '8px 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fleet per hub</div>
            <FleetMini fleetPerHub={fleetPerHub} tier="hub_s" color={C.hubS} />
          </>
        ) : <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, padding: '4px 0' }}>Run analysis</div>}

        {/* ── Legend ── */}
        <SectionLabel>Legend</SectionLabel>
        {[
          { color: C.hubL, r: 14, label: 'Hub L · 4 km coverage' },
          { color: C.hubM, r: 11, label: 'Hub M · 2 km coverage' },
          { color: C.hubS, r: 8,  label: 'Hub S · configurable' },
        ].map(({ color, r, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
            <svg width={r * 2 + 4} height={r * 2 + 4}>
              <circle cx={r + 2} cy={r + 2} r={r} fill={color} />
            </svg>
            <span style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
