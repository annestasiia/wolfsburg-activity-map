import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { runHubLMAlgorithm } from '../utils/hubLMAlgorithm'

const SERIF = "'Georgia', 'Times New Roman', serif"
const SANS  = "system-ui, -apple-system, sans-serif"
const C = {
  bg:      '#FFFFFF',
  border:  '#E8E8E8',
  text1:   '#111111',
  text2:   '#444444',
  text3:   '#888888',
  hubL:    '#1D1D1F',
  hubM:    '#1D7A3A',
  hubS:    '#185FA5',
  accent:  '#111111',
}

const fmt = (n) => n >= 10000 ? `${(n/10000).toFixed(2)} ha` : `${Math.round(n)} m²`
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
        type="number"
        value={value}
        min={min} max={max} step={100}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: 80, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 4,
          fontFamily: 'monospace', fontSize: 12, color: C.text1, background: '#F7F7F7', textAlign: 'right',
        }}
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
        <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{count} hubs selected / {candidateCount} candidates</span>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {[
          { label: 'Total area', value: fmt(totalArea) },
          { label: 'Required', value: fmt(requiredArea) },
          { label: 'Coverage', value: `${coverageKm2} km²` },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, minWidth: 80, background: '#F7F7F7', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text1, fontWeight: 600, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>
          Centre: <strong>{centreCount}</strong> hubs · {fmt(centreArea)}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>·</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>
          Outer: <strong>{outerCount}</strong> hubs · {fmt(outerArea)}
        </div>
      </div>
    </div>
  )
}

export default function HubNetworkSidebar() {
  const {
    localCarParkings, buildings, districtBoundaries,
    hubLMConfig, setHubLMConfig,
    hubLMResults, setHubLMResults,
    hubLMRunning, setHubLMRunning,
    hubLMStatus,
    intermodalHubs,
  } = useAppStore()

  const [showConfig, setShowConfig] = useState(false)

  const runAnalysis = () => {
    if (!localCarParkings) return
    setHubLMRunning(true, 'Running Hub L/M analysis…')
    // Run synchronously in next tick to let React re-render the loading state
    setTimeout(() => {
      try {
        const results = runHubLMAlgorithm({
          localCarParkings,
          buildings,
          districtBoundaries,
          hubLMConfig,
        })
        setHubLMResults(results)
      } catch (err) {
        console.error('[HubLM]', err)
      } finally {
        setHubLMRunning(false)
      }
    }, 10)
  }

  const hubS = intermodalHubs || []
  const hubSCount = hubS.length
  const hubSCovM2 = hubSCount * Math.PI * 200 * 200

  const { hubL, hubM } = hubLMResults || {}

  return (
    <div style={{
      position: 'absolute', top: 48, left: 0, bottom: 0, width: 300, zIndex: 200,
      background: C.bg, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
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
            onClick={runAnalysis}
            disabled={hubLMRunning || !localCarParkings}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
              background: hubLMRunning ? '#ccc' : C.accent, color: '#fff',
              fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: hubLMRunning ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.01em', transition: 'background 0.2s',
            }}
          >
            {hubLMRunning ? '⏳ Running…' : hubLMResults ? '↺  Re-run Analysis' : '▶  Run Analysis'}
          </button>
          {hubLMRunning && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 6, textAlign: 'center' }}>
              {hubLMStatus}
            </div>
          )}
          {!localCarParkings && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: '#cc5500', marginTop: 6, textAlign: 'center' }}>
              Car parking data loading…
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
            <SectionLabel>Hub L — Required area</SectionLabel>
            <NumberInput label="Required total area" value={hubLMConfig.requiredAreaL} onChange={v => setHubLMConfig('requiredAreaL', v)} unit="m²" />
            <NumberInput label="Min. distance between hubs" value={hubLMConfig.minDistL} onChange={v => setHubLMConfig('minDistL', v)} unit="m" min={100} max={5000} />

            <SectionLabel>Hub M — Required area</SectionLabel>
            <NumberInput label="Required total area" value={hubLMConfig.requiredAreaM} onChange={v => setHubLMConfig('requiredAreaM', v)} unit="m²" />
            <NumberInput label="Min. distance between hubs" value={hubLMConfig.minDistM} onChange={v => setHubLMConfig('minDistM', v)} unit="m" min={100} max={5000} />
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {hubLMResults ? (
          <>
            <SectionLabel>Hub L — Fleet Depot + Charging</SectionLabel>
            <HubTypeCard
              type="HUB L"
              color={C.hubL}
              count={hubL.hubs.length}
              totalArea={hubL.totalArea}
              centreCount={hubL.centreCount}
              outerCount={hubL.outerCount}
              centreArea={hubL.centreArea}
              outerArea={hubL.outerArea}
              coverageKm2={fmtKm2(hubL.coverageM2)}
              candidateCount={hubL.candidateCount}
              requiredArea={hubL.requiredArea}
            />

            <SectionLabel>Hub M — Intermodal Transfer Node</SectionLabel>
            <HubTypeCard
              type="HUB M"
              color={C.hubM}
              count={hubM.hubs.length}
              totalArea={hubM.totalArea}
              centreCount={hubM.centreCount}
              outerCount={hubM.outerCount}
              centreArea={hubM.centreArea}
              outerArea={hubM.outerArea}
              coverageKm2={fmtKm2(hubM.coverageM2)}
              candidateCount={hubM.candidateCount}
              requiredArea={hubM.requiredArea}
            />

            <SectionLabel>Hub S — Bus / Bike Node</SectionLabel>
            <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.hubS}`, borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.hubS, letterSpacing: '0.06em' }}>HUB S</span>
                <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{hubSCount} hubs</span>
              </div>
              <StatRow label="Coverage area" value={fmtKm2(hubSCovM2)} unit="km²" />
              <StatRow label="Coverage radius" value="200" unit="m per hub" />
              <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 4 }}>
                {hubSCount > 0 ? 'From Hub S analysis (Intermodal tab)' : 'Run Hub S analysis first via Intermodal tab'}
              </div>
            </div>

            {/* Combined summary */}
            <SectionLabel>City-wide Summary</SectionLabel>
            <StatRow label="Total hubs" value={hubL.hubs.length + hubM.hubs.length + hubSCount} />
            <StatRow label="Hub L area" value={fmt(hubL.totalArea)} color={C.hubL} />
            <StatRow label="Hub M area" value={fmt(hubM.totalArea)} color={C.hubM} />
            <StatRow label="Hub L+M coverage" value={fmtKm2(hubL.coverageM2 + hubM.coverageM2)} unit="km²" />
            <StatRow label="Hub S coverage" value={fmtKm2(hubSCovM2)} unit="km²" />
          </>
        ) : !hubLMRunning && (
          <div style={{ fontFamily: SERIF, fontSize: 14, color: C.text3, lineHeight: 1.6, padding: '16px 0', textAlign: 'center' }}>
            Press Run Analysis to find Hub L and M sites from OSM parking data.
          </div>
        )}
      </div>
    </div>
  )
}
