import React, { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'

const SANS = "system-ui, -apple-system, sans-serif"
const C = {
  border: '#E8E8E8', text1: '#111', text2: '#444', text3: '#888',
  hubL: '#1D1D1F', hubM: '#1D7A3A', hubS: '#185FA5',
}
const fmt = (n) => n >= 10000 ? `${(n/10000).toFixed(2)} ha` : `${Math.round(n)} m²`
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

const TABS = [
  { id: 'S', label: 'Hub S', color: C.hubS },
  { id: 'M', label: 'Hub M', color: C.hubM },
  { id: 'L', label: 'Hub L', color: C.hubL },
]

export default function HubStatsPanel() {
  const store = useAppStore()
  const {
    hubSBusOnly,
    densityConfig, setDensityConfig,
    hubLMConfig, setHubLMConfig,
    hubLMResults,
    hubLMRunning, localCarParkings, localBusStops,
  } = store

  const [activeTab, setActiveTab] = useState('S')
  const rerun = buildRunAllHubs(store)

  const hubS = hubSBusOnly || []
  const hubSRadius = hubLMConfig?.hubSCoverageRadius || 200
  const hubSCovM2 = hubS.length * Math.PI * hubSRadius * hubSRadius
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <StatCard label="Hub count" value={hubS.length} color={C.hubS} />
            <StatCard label="Coverage" value={fmtKm2(hubSCovM2)} sub={`${hubSRadius} m/hub`} color={C.hubS} />
            <StatCard label="Existing" value={hubS.filter(h => h.status === 'existing').length} sub="at bus stops" />
          </div>
          {hubS.length === 0 && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginBottom: 12 }}>
              Hub S (bus_bike only) — run Re-run below to compute.
            </div>
          )}

          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
            Density Config (Hub S)
          </div>
          <Slider label="High-density zone radius"   value={densityConfig.high}   min={100}  max={1000}  onChange={v => setDensityConfig('high',   v)} />
          <Slider label="Medium-density zone radius" value={densityConfig.medium} min={300}  max={2000}  onChange={v => setDensityConfig('medium', v)} />
          <Slider label="Low-density zone radius"    value={densityConfig.low}    min={500}  max={3000}  onChange={v => setDensityConfig('low',    v)} />
          <Slider label="Coverage radius display"    value={hubSRadius}           min={50}   max={1000}  step={50}  onChange={v => setHubLMConfig('hubSCoverageRadius', v)} />

          <button onClick={rerun} disabled={hubLMRunning || !localCarParkings || !localBusStops}
            style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 4, border: 'none',
              background: hubLMRunning ? '#ccc' : C.hubS, color: '#fff', fontFamily: SANS, fontSize: 12,
              fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer' }}>
            {hubLMRunning ? '⏳ Running…' : '↺  Re-run Analysis'}
          </button>
        </div>
      )}

      {/* ── Hub M ──────────────────────────────────────────────────────────── */}
      {activeTab === 'M' && (
        <div>
          {hubM ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <StatCard label="Hub count" value={hubM.hubs.length} color={C.hubM} />
                <StatCard label="Total area" value={fmt(hubM.totalArea)} sub={`req: ${fmt(hubM.requiredArea)}`} color={C.hubM} />
                <StatCard label="Coverage" value={fmtKm2(hubM.coverageM2)} sub="1 km radius/hub" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <StatCard label="Centre hubs" value={hubM.centreCount} sub={fmt(hubM.centreArea)} />
                <StatCard label="Outer hubs" value={hubM.outerCount} sub={fmt(hubM.outerArea)} />
                <StatCard label="Candidates" value={hubM.candidateCount} sub="underground parkings" />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: SANS, fontSize: 12, color: C.text3, marginBottom: 12 }}>
              Run analysis from the HUB L/M sidebar to see results.
            </div>
          )}

          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
            Hub M Config
          </div>
          <Slider label="Required area" value={hubLMConfig.requiredAreaM} min={1000} max={50000} step={500}
            onChange={v => setHubLMConfig('requiredAreaM', v)} />
          <Slider label="Min. distance between hubs" value={hubLMConfig.minDistM} min={100} max={2000} step={50}
            onChange={v => setHubLMConfig('minDistM', v)} />

          <button onClick={rerun} disabled={hubLMRunning || !localCarParkings}
            style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 4, border: 'none',
              background: hubLMRunning ? '#ccc' : C.hubM, color: '#fff', fontFamily: SANS, fontSize: 12,
              fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer' }}>
            {hubLMRunning ? '⏳ Running…' : '↺  Re-run Analysis'}
          </button>
        </div>
      )}

      {/* ── Hub L ──────────────────────────────────────────────────────────── */}
      {activeTab === 'L' && (
        <div>
          {hubL ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <StatCard label="Hub count" value={hubL.hubs.length} color={C.hubL} />
                <StatCard label="Total area" value={fmt(hubL.totalArea)} sub={`req: ${fmt(hubL.requiredArea)}`} color={C.hubL} />
                <StatCard label="Coverage" value={fmtKm2(hubL.coverageM2)} sub="800 m radius/hub" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <StatCard label="Centre hubs" value={hubL.centreCount} sub={fmt(hubL.centreArea)} />
                <StatCard label="Outer hubs" value={hubL.outerCount} sub={fmt(hubL.outerArea)} />
                <StatCard label="Candidates" value={hubL.candidateCount} sub="multi-storey parkings" />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: SANS, fontSize: 12, color: C.text3, marginBottom: 12 }}>
              Run analysis from the HUB L/M sidebar to see results.
            </div>
          )}

          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
            Hub L Config
          </div>
          <Slider label="Required area" value={hubLMConfig.requiredAreaL} min={5000} max={100000} step={500}
            onChange={v => setHubLMConfig('requiredAreaL', v)} />
          <Slider label="Min. distance between hubs" value={hubLMConfig.minDistL} min={200} max={3000} step={100}
            onChange={v => setHubLMConfig('minDistL', v)} />

          <button onClick={rerun} disabled={hubLMRunning || !localCarParkings}
            style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 4, border: 'none',
              background: hubLMRunning ? '#ccc' : C.hubL, color: '#fff', fontFamily: SANS, fontSize: 12,
              fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer' }}>
            {hubLMRunning ? '⏳ Running…' : '↺  Re-run Analysis'}
          </button>
        </div>
      )}
    </div>
  )
}
