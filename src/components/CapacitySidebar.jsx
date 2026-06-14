import React, { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { computeCapacity, MODE_META } from '../utils/capacityCalc'
import { buildRunAllHubs } from './HubNetworkSidebar'

const SANS  = "system-ui, -apple-system, sans-serif"
const SERIF = "'Georgia', 'Times New Roman', serif"
const C = {
  bg: '#FFFFFF', border: '#E8E8E8',
  text1: '#111111', text2: '#444444', text3: '#888888',
  hubL: '#1D1D1F', hubM: '#1D7A3A', hubS: '#185FA5',
}

const fmtN  = (n) => Math.round(n).toLocaleString('de-DE')
const fmtM2 = (n) => n >= 10000 ? `${(n / 10000).toFixed(1)} ha` : `${Math.round(n)} m²`

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', margin: '14px 0 5px' }}>
      {children}
    </div>
  )
}

function DataRow({ label, value, unit, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: color || C.text1, fontWeight: bold ? 700 : 600 }}>
        {value}
        {unit && <span style={{ fontWeight: 400, color: C.text3, marginLeft: 3, fontFamily: SANS, fontSize: 10 }}>{unit}</span>}
      </span>
    </div>
  )
}

function BarRow({ label, value, maxValue, color, unit }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color, fontWeight: 600 }}>
          {typeof value === 'number' ? fmtN(value) : value}
          {unit && <span style={{ fontWeight: 400, color: C.text3, marginLeft: 2, fontFamily: SANS, fontSize: 10 }}> {unit}</span>}
        </span>
      </div>
      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

export default function CapacitySidebar() {
  const store = useAppStore()
  const { hubPopulation, setHubPopulation, hubLMRunning, hubLMResults, localCarParkings, localBusStops, navOpen } = store

  const pop = hubPopulation || 130000
  const cap    = useMemo(() => computeCapacity(pop), [pop])
  const runAll = buildRunAllHubs(store)
  const ready  = !!localCarParkings && !!localBusStops

  const maxTrips = Math.max(...Object.values(cap.trips_by_mode))
  const maxFleet = Math.max(...Object.values(cap.fleet).map(f => f.total))

  return (
    <div style={{
      position: 'absolute', top: 48, left: navOpen ? 228 : 0, bottom: 0, width: 300, zIndex: 200, transition: 'left 0.3s ease',
      background: C.bg, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>
          Hub Network
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, color: C.text1 }}>Capacity Analysis</div>
      </div>

      <div style={{ flex: 1, padding: '0 16px 24px', overflowY: 'auto' }}>

        {/* ── Population Pool ── */}
        <SectionLabel>Population Pool</SectionLabel>
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: 11, color: C.text2 }}>City residents</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: C.text1 }}>
              {pop.toLocaleString('de-DE')}
            </span>
          </div>
          <input
            type="range" min={130000} max={250000} step={5000} value={pop}
            onChange={e => setHubPopulation(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.text1 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>130,000 · current</span>
            <span style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>250,000 · future</span>
          </div>
        </div>

        {/* ── Demographics ── */}
        <SectionLabel>Demographics</SectionLabel>
        <DataRow label="Population (residents)" value={fmtN(cap.total_residents)} />
        <DataRow label="Workers in zone"        value={fmtN(cap.workers)} />
        <DataRow label="Daily visitors"         value={fmtN(cap.visitors)} />
        <DataRow label="D_total (trips/day)"    value={fmtN(cap.D_total)} bold />

        {/* ── Peak Hour ── */}
        <SectionLabel>Peak Hour (08:00–09:00)</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#FFF5F5', borderRadius: 5, border: '1px solid #FECACA', marginBottom: 2 }}>
          <span style={{ fontFamily: SANS, fontSize: 11, color: '#B91C1C' }}>Peak trips in center</span>
          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#E63946' }}>{fmtN(cap.peak_hour_trips)}</span>
        </div>

        {/* ── Trip Flow Decomposition ── */}
        <SectionLabel>Trip Flow Decomposition</SectionLabel>
        {Object.entries(MODE_META).map(([mode, { label, color }]) => (
          <BarRow
            key={mode}
            label={label}
            value={cap.trips_by_mode[mode] || 0}
            maxValue={maxTrips}
            color={color}
            unit="trips/day"
          />
        ))}

        {/* ── Fleet by Mode ── */}
        <SectionLabel>Fleet by Mode</SectionLabel>
        {Object.entries(MODE_META).map(([mode, { label, color }]) => (
          <BarRow
            key={mode}
            label={label}
            value={cap.fleet[mode]?.total || 0}
            maxValue={maxFleet}
            color={color}
            unit="veh"
          />
        ))}

        {/* ── Run Analysis ── */}
        <div style={{ marginTop: 10 }}>
          <button
            onClick={runAll}
            disabled={hubLMRunning || !ready}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
              background: hubLMRunning ? '#ccc' : C.text1, color: '#fff',
              fontFamily: SANS, fontSize: 13, fontWeight: 600,
              cursor: hubLMRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {hubLMRunning ? '⏳ Running…' : hubLMResults ? '↺  Re-run Analysis' : '▶  Run Analysis'}
          </button>
          {!ready && !hubLMRunning && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: '#cc5500', marginTop: 6, textAlign: 'center' }}>
              Loading parking / bus data…
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
