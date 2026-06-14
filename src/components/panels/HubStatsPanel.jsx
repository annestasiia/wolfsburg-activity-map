import React, { useState, useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'
import { computeCapacity, computeDensityConfig, MODE_META } from '../../utils/capacityCalc'

const SANS = "system-ui, -apple-system, sans-serif"
const C = {
  border: '#E8E8E8', text1: '#111', text2: '#444', text3: '#888',
  hubL: '#1D1D1F', hubM: '#1D7A3A', hubS: '#185FA5',
}
const fmt    = (n) => n >= 10000 ? `${(n/10000).toFixed(2)} ha` : `${Math.round(n)} m²`
const fmtKm2 = (m2) => `${(m2/1_000_000).toFixed(2)} km²`

function Slider({ label, value, onChange, min, max, step = 50 }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.text1 }}>{value} m</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: C.text1 }}
      />
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 80, background: '#F7F7F7', borderRadius: 4, padding: '8px 10px' }}>
      <div style={{ fontFamily: SANS, fontSize: 9, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13, color: color || C.text1, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', margin: '12px 0 6px' }}>
      {children}
    </div>
  )
}

function FleetTable({ fph, color }) {
  if (!fph) return null
  const rows = Object.entries(MODE_META).filter(([mode]) => (fph[mode] || 0) > 0)
  if (!rows.length) return null
  const total = rows.reduce((s, [mode]) => s + (fph[mode] || 0), 0)
  return (
    <div style={{ marginTop: 2 }}>
      {rows.map(([mode, { label }]) => (
        <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>{label}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color, fontWeight: 600 }}>{fph[mode]} veh</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text2 }}>Total per hub</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color }}>{total} veh</span>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'S', label: 'Hub S', color: C.hubS },
  { id: 'M', label: 'Hub M', color: C.hubM },
  { id: 'L', label: 'Hub L', color: C.hubL },
]

export default function HubStatsPanel() {
  const store = useAppStore()
  const {
    hubSBusOnly,
    hubLMConfig, setHubLMConfig,
    hubLMResults,
    hubLMRunning, localCarParkings, localBusStops,
    hubPopulation,
  } = store

  const [activeTab, setActiveTab] = useState('S')
  const rerun = buildRunAllHubs(store)

  const pop        = hubPopulation || 130000
  const cap        = useMemo(() => computeCapacity(pop), [pop])
  const autoDensity = useMemo(() => computeDensityConfig(pop), [pop])

  const hubS = hubSBusOnly || []
  const hubSRadius = hubLMConfig?.hubSCoverageRadius || 200
  const hubSCovM2  = hubS.length * Math.PI * hubSRadius * hubSRadius
  const { hubL, hubM } = hubLMResults || {}

  return (
    <div style={{ padding: '16px 20px 20px', height: '100%', overflowY: 'auto', background: '#fff' }}>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 4, border: `1px solid ${activeTab === t.id ? t.color : C.border}`,
              background: activeTab === t.id ? t.color : 'transparent', color: activeTab === t.id ? '#fff' : C.text2,
              fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Hub S ──────────────────────────────────────────────────────────── */}
      {activeTab === 'S' && (
        <div>
          <SectionLabel>Placement result</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <StatCard label="Placed" value={hubS.length} color={C.hubS} sub="hubs" />
            <StatCard label="Coverage" value={fmtKm2(hubSCovM2)} sub={`${hubSRadius} m/hub`} color={C.hubS} />
            <StatCard label="Existing" value={hubS.filter(h => h.status === 'existing').length} sub="bus stops" />
          </div>

          <SectionLabel>Capacity model</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <StatCard label="Planned" value={cap.hubSCount} color={C.hubS} sub="hubs" />
            <StatCard label="High zone" value={`${autoDensity.high} m`} sub="exclusion radius" />
            <StatCard label="Med zone" value={`${autoDensity.medium} m`} sub="exclusion radius" />
          </div>

          <SectionLabel>Fleet per Hub S (planned)</SectionLabel>
          <FleetTable fph={cap.fleet_per_hub?.hub_s} color={C.hubS} />

          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
              Coverage radius display
            </div>
            <Slider label="Coverage radius" value={hubSRadius} min={50} max={2000} step={50}
              onChange={v => setHubLMConfig('hubSCoverageRadius', v)} />
          </div>

          <button onClick={rerun} disabled={hubLMRunning || !localCarParkings || !localBusStops}
            style={{ marginTop: 4, width: '100%', padding: '8px 0', borderRadius: 4, border: 'none',
              background: hubLMRunning ? '#ccc' : C.hubS, color: '#fff', fontFamily: SANS, fontSize: 12,
              fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer' }}>
            {hubLMRunning ? '⏳ Running…' : '↺  Re-run Analysis'}
          </button>
        </div>
      )}

      {/* ── Hub M ──────────────────────────────────────────────────────────── */}
      {activeTab === 'M' && (
        <div>
          <SectionLabel>Placement result</SectionLabel>
          {hubM ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <StatCard label="Placed" value={hubM.hubs.length} color={C.hubM} sub="hubs" />
              <StatCard label="Total area" value={fmt(hubM.totalArea)} sub={`req: ${fmt(hubM.requiredArea)}`} color={C.hubM} />
              <StatCard label="Coverage" value={fmtKm2(hubM.coverageM2)} sub="2 km radius" />
            </div>
          ) : (
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginBottom: 8 }}>Run analysis to see placement results.</div>
          )}

          <SectionLabel>Capacity model</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <StatCard label="Planned" value={cap.hub_counts?.hub_m} color={C.hubM} sub="hubs" />
            <StatCard label="Req. area" value={fmt(cap.requiredAreaM || 0)} sub="total" color={C.hubM} />
            <StatCard label="Per hub" value={fmt(cap.S_hub_area?.hub_m || 0)} sub="footprint" />
          </div>

          <SectionLabel>Fleet per Hub M (planned)</SectionLabel>
          <FleetTable fph={cap.fleet_per_hub?.hub_m} color={C.hubM} />

          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
              Hub M Config
            </div>
            <Slider label="Required area" value={hubLMConfig.requiredAreaM} min={1000} max={50000} step={500}
              onChange={v => setHubLMConfig('requiredAreaM', v)} />
            <Slider label="Min. distance between hubs" value={hubLMConfig.minDistM} min={100} max={2000} step={50}
              onChange={v => setHubLMConfig('minDistM', v)} />
          </div>

          <button onClick={rerun} disabled={hubLMRunning || !localCarParkings}
            style={{ marginTop: 4, width: '100%', padding: '8px 0', borderRadius: 4, border: 'none',
              background: hubLMRunning ? '#ccc' : C.hubM, color: '#fff', fontFamily: SANS, fontSize: 12,
              fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer' }}>
            {hubLMRunning ? '⏳ Running…' : '↺  Re-run Analysis'}
          </button>
        </div>
      )}

      {/* ── Hub L ──────────────────────────────────────────────────────────── */}
      {activeTab === 'L' && (
        <div>
          <SectionLabel>Placement result</SectionLabel>
          {hubL ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <StatCard label="Placed" value={hubL.hubs.length} color={C.hubL} sub="hubs" />
              <StatCard label="Total area" value={fmt(hubL.totalArea)} sub={`req: ${fmt(hubL.requiredArea)}`} color={C.hubL} />
              <StatCard label="Coverage" value={fmtKm2(hubL.coverageM2)} sub="4 km radius" />
            </div>
          ) : (
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginBottom: 8 }}>Run analysis to see placement results.</div>
          )}

          <SectionLabel>Capacity model</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <StatCard label="Planned" value={cap.hub_counts?.hub_l} color={C.hubL} sub="hubs" />
            <StatCard label="Req. area" value={fmt(cap.requiredAreaL || 0)} sub="total" color={C.hubL} />
            <StatCard label="Per hub" value={fmt(cap.S_hub_area?.hub_l || 0)} sub="footprint" />
          </div>

          <SectionLabel>Fleet per Hub L (planned)</SectionLabel>
          <FleetTable fph={cap.fleet_per_hub?.hub_l} color={C.hubL} />

          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
              Hub L Config
            </div>
            <Slider label="Required area" value={hubLMConfig.requiredAreaL} min={5000} max={100000} step={500}
              onChange={v => setHubLMConfig('requiredAreaL', v)} />
            <Slider label="Min. distance between hubs" value={hubLMConfig.minDistL} min={200} max={3000} step={100}
              onChange={v => setHubLMConfig('minDistL', v)} />
          </div>

          <button onClick={rerun} disabled={hubLMRunning || !localCarParkings}
            style={{ marginTop: 4, width: '100%', padding: '8px 0', borderRadius: 4, border: 'none',
              background: hubLMRunning ? '#ccc' : C.hubL, color: '#fff', fontFamily: SANS, fontSize: 12,
              fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer' }}>
            {hubLMRunning ? '⏳ Running…' : '↺  Re-run Analysis'}
          </button>
        </div>
      )}
    </div>
  )
}
