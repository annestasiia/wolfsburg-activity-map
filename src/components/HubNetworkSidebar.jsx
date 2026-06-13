import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { runHubLMAlgorithm } from '../utils/hubLMAlgorithm'
import { runIntermodalAlgorithm } from '../utils/intermodalAlgorithm'
import { computeCapacity } from '../utils/capacityCalc'

const SERIF = "'Georgia', 'Times New Roman', serif"
const SANS  = "system-ui, -apple-system, sans-serif"
const C = {
  bg:    '#FFFFFF', border: '#E8E8E8',
  text1: '#111111', text2: '#444444', text3: '#888888',
  hubL:  '#1D1D1F', hubM:  '#1D7A3A', hubS:  '#185FA5',
  accent:'#111111',
}

const fmt = (n) => n >= 10000 ? `${(n / 10000).toFixed(2)} ha` : `${Math.round(n)} m²`
const fmtKm2 = (m2) => (m2 / 1_000_000).toFixed(2)

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', margin: '20px 0 8px' }}>
      {children}
    </div>
  )
}

function StatRow({ label, value, unit, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: SANS, fontSize: 12, color: C.text2 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: color || C.text1, fontWeight: 600 }}>
        {value}{unit && <span style={{ fontWeight: 400, color: C.text3, marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  )
}

function NumberInput({ label, value, onChange, unit = 'm²', min = 0, max = 999999 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: SANS, fontSize: 12, color: C.text2, flex: 1 }}>{label}</span>
      <input
        type="number" value={value} min={min} max={max} step={100}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 80, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 4,
          fontFamily: 'monospace', fontSize: 12, color: C.text1, background: '#F7F7F7', textAlign: 'right' }}
      />
      <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3, width: 20 }}>{unit}</span>
    </div>
  )
}

function HubTypeCard({ type, color, count, totalArea, centreCount, outerCount, centreArea, outerArea, coverageKm2, candidateCount, requiredArea }) {
  const pct = requiredArea > 0 ? Math.min(100, Math.round(totalArea / requiredArea * 100)) : 0
  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color, letterSpacing: '0.06em' }}>{type}</span>
        <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{count} hubs · {candidateCount} candidates</span>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {[
          { label: 'Total area', value: fmt(totalArea) },
          { label: 'Required',   value: fmt(requiredArea) },
          { label: 'Coverage',   value: `${coverageKm2} km²` },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, minWidth: 80, background: '#F7F7F7', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text1, fontWeight: 600, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>Centre: <strong>{centreCount}</strong> · {fmt(centreArea)}</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>·</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>Outer: <strong>{outerCount}</strong> · {fmt(outerArea)}</div>
      </div>
    </div>
  )
}

// Exported so CapacitySidebar, HubLMDataPanel and HubStatsPanel can call it
export function buildRunAllHubs(store) {
  const { localCarParkings, localBusStops, localBikeParkings, parks,
          districtBoundaries, hubLMConfig, densityConfig, venues,
          hubPopulation,
          setHubLMResults, setHubSBusOnly, setHubLMRunning } = store
  return async () => {
    if (!localCarParkings || !localBusStops) return
    setHubLMRunning(true, 'Running Hub L/M/S analysis…')
    await new Promise(r => setTimeout(r, 10))
    try {
      // Compute required areas from city population via Capacity Analysis formulas
      const cap = computeCapacity(hubPopulation || 130000)
      const lmConfig = {
        ...hubLMConfig,
        requiredAreaL: cap.requiredAreaL,
        requiredAreaM: cap.requiredAreaM,
      }

      // Hub L + Hub M
      const lmResults = runHubLMAlgorithm({ localCarParkings, districtBoundaries, hubLMConfig: lmConfig })
      setHubLMResults(lmResults)

      // Hub S — bus_bike only (null carParkings → no auto hubs)
      const sBusOnly = runIntermodalAlgorithm(
        venues || [],
        localBusStops,
        null,
        localBikeParkings,
        parks,
        null,
        densityConfig,
      ).filter(h => h.hubType === 'bus_bike')
      setHubSBusOnly(sBusOnly)
    } catch (err) {
      console.error('[HubNetwork]', err)
    } finally {
      setHubLMRunning(false)
    }
  }
}

export default function HubNetworkSidebar() {
  const store = useAppStore()
  const {
    localCarParkings, localBusStops,
    hubLMConfig, setHubLMConfig,
    hubLMResults,
    hubLMRunning, hubLMStatus,
    hubSBusOnly,
  } = store

  const [showConfig, setShowConfig] = useState(false)
  const runAll = buildRunAllHubs(store)

  const hubS = hubSBusOnly || []
  const hubSCovM2 = hubS.length * Math.PI * (hubLMConfig.hubSCoverageRadius || 200) ** 2
  const { hubL, hubM } = hubLMResults || {}

  const ready = !!localCarParkings && !!localBusStops

  return (
    <div style={{
      position: 'absolute', top: 48, left: 0, bottom: 0, width: 300, zIndex: 200,
      background: C.bg, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
          Hub Network
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 20, color: C.text1, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          L / M / S<br />
          <span style={{ color: C.text2, fontSize: 15 }}>Tier Analysis</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 16px 24px', overflowY: 'auto' }}>

        {/* Run button */}
        <div style={{ margin: '14px 0 4px' }}>
          <button
            onClick={runAll}
            disabled={hubLMRunning || !ready}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
              background: hubLMRunning ? '#ccc' : C.accent, color: '#fff',
              fontFamily: SANS, fontSize: 13, fontWeight: 600,
              cursor: hubLMRunning ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em',
            }}
          >
            {hubLMRunning ? '⏳ Running…' : hubLMResults ? '↺  Re-run Analysis' : '▶  Run Analysis'}
          </button>
          {hubLMRunning && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 6, textAlign: 'center' }}>
              {hubLMStatus}
            </div>
          )}
          {!ready && !hubLMRunning && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: '#cc5500', marginTop: 6, textAlign: 'center' }}>
              Loading parking/bus data…
            </div>
          )}
        </div>

        {/* Config toggle */}
        <button
          onClick={() => setShowConfig(v => !v)}
          style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontFamily: SANS, fontSize: 12, color: C.text3, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {showConfig ? '▾' : '▸'} Configuration
        </button>

        {showConfig && (
          <div style={{ marginBottom: 12 }}>
            <SectionLabel>Hub L</SectionLabel>
            <NumberInput label="Required area"           value={hubLMConfig.requiredAreaL} onChange={v => setHubLMConfig('requiredAreaL', v)} unit="m²" />
            <NumberInput label="Min. distance"          value={hubLMConfig.minDistL}      onChange={v => setHubLMConfig('minDistL', v)}      unit="m" min={100} max={5000} />
            <SectionLabel>Hub M</SectionLabel>
            <NumberInput label="Required area"           value={hubLMConfig.requiredAreaM} onChange={v => setHubLMConfig('requiredAreaM', v)} unit="m²" />
            <NumberInput label="Min. distance"          value={hubLMConfig.minDistM}      onChange={v => setHubLMConfig('minDistM', v)}      unit="m" min={100} max={5000} />
            <SectionLabel>Hub S</SectionLabel>
            <NumberInput label="Coverage radius" value={hubLMConfig.hubSCoverageRadius || 200} onChange={v => setHubLMConfig('hubSCoverageRadius', v)} unit="m" min={50} max={1000} />
          </div>
        )}

        {/* Results */}
        {hubLMResults ? (
          <>
            <SectionLabel>Hub L — Fleet Depot + Charging</SectionLabel>
            <HubTypeCard
              type="HUB L" color={C.hubL}
              count={hubL.hubs.length}
              totalArea={hubL.totalArea}
              centreCount={hubL.centreCount} outerCount={hubL.outerCount}
              centreArea={hubL.centreArea}   outerArea={hubL.outerArea}
              coverageKm2={fmtKm2(hubL.coverageM2)}
              candidateCount={hubL.candidateCount}
              requiredArea={hubL.requiredArea}
            />

            <SectionLabel>Hub M — Intermodal Transfer Node</SectionLabel>
            <HubTypeCard
              type="HUB M" color={C.hubM}
              count={hubM.hubs.length}
              totalArea={hubM.totalArea}
              centreCount={hubM.centreCount} outerCount={hubM.outerCount}
              centreArea={hubM.centreArea}   outerArea={hubM.outerArea}
              coverageKm2={fmtKm2(hubM.coverageM2)}
              candidateCount={hubM.candidateCount}
              requiredArea={hubM.requiredArea}
            />

            <SectionLabel>Hub S — Bus/Bike Node</SectionLabel>
            <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.hubS}`, borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.hubS, letterSpacing: '0.06em' }}>HUB S</span>
                <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{hubS.length} hubs selected</span>
              </div>
              <StatRow label="Coverage area" value={fmtKm2(hubSCovM2)} unit="km²" />
              <StatRow label="Coverage radius" value={hubLMConfig.hubSCoverageRadius || 200} unit="m per hub" />
              <StatRow label="Existing" value={hubS.filter(h => h.status === 'existing').length} />
              <StatRow label="Proposed" value={hubS.filter(h => h.status === 'proposed').length} />
            </div>

            <SectionLabel>City-wide Summary</SectionLabel>
            <StatRow label="Total hubs" value={hubL.hubs.length + hubM.hubs.length + hubS.length} />
            <StatRow label="Hub L+M coverage" value={fmtKm2(hubL.coverageM2 + hubM.coverageM2)} unit="km²" />
            <StatRow label="Hub S coverage"   value={fmtKm2(hubSCovM2)} unit="km²" />
          </>
        ) : !hubLMRunning && (
          <div style={{ fontFamily: SERIF, fontSize: 14, color: C.text3, lineHeight: 1.6, padding: '16px 0', textAlign: 'center' }}>
            Press Run Analysis to find Hub L, M, and S sites.
          </div>
        )}
      </div>
    </div>
  )
}
