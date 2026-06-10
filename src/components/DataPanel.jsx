import React, { useState } from 'react'

// ─── BASELINE (MiD 2017 · WOKS 2023/2025) ────────────────────────────────────
const DISTRICT_POP = {
  'Stadtmitte':    2800, 'Schillerteich': 2100, 'Hellwinkel':    1900,
  'Heßlingen':     2200, 'Rothenfelde':   1800, 'Köhlerberg':    1400,
  'Alt-Wolfsburg': 2600, 'Sandkamp':      1100, 'Hochenstein':   1500,
}
const WORKERS = 18000, T_RESIDENT = 3.2, T_WORKER = 2.1, T_VISITOR = 1.5
const VISITOR_SHARE = 0.20, CAR_OCCUPANCY = 1.3

const MODAL = {
  private_car:    { share: 0.62, label: 'Private car',    color: '#E63946' },
  public_transit: { share: 0.10, label: 'Public transit', color: '#1D70B8' },
  walking:        { share: 0.20, label: 'Walking',        color: '#2D6A4F' },
  cycling:        { share: 0.08, label: 'Cycling',        color: '#FF8C42' },
}

const HOUR_RAW = [
  0.005,0.003,0.002,0.002,0.005,0.015,
  0.040,0.075,0.085,0.065,0.055,0.060,
  0.060,0.055,0.055,0.065,0.075,0.080,
  0.065,0.045,0.030,0.020,0.015,0.008,
]
const HOUR_SUM   = HOUR_RAW.reduce((a,b) => a+b, 0)
const HOUR_SHARE = HOUR_RAW.map(s => s / HOUR_SUM)

const total_residents    = Object.values(DISTRICT_POP).reduce((a,b) => a+b, 0)
const visitors           = (total_residents + WORKERS) * VISITOR_SHARE
const D_total            = total_residents*T_RESIDENT + WORKERS*T_WORKER + visitors*T_VISITOR
const D_internal         = D_total * 0.65
const car_trips          = D_total * MODAL.private_car.share
const transit_trips      = D_total * MODAL.public_transit.share
const walk_trips         = D_total * MODAL.walking.share
const cycling_trips      = D_total * MODAL.cycling.share
const car_vehicles_per_day = car_trips / CAR_OCCUPANCY
const peak_hour_trips    = Math.round(D_total * HOUR_SHARE[8])

const BASELINE_RESULTS = [
  { metric: 'Population (residents)',  value: total_residents,      source: 'WOKS 2023' },
  { metric: 'Workers in zone',         value: WORKERS,              source: 'WOKS 2025' },
  { metric: 'Daily visitors',          value: visitors,             source: 'MiD 2017 estimate' },
  { metric: 'D_total (trips/day)',     value: D_total,              source: 'MiD 2017 formula' },
  { metric: 'D_internal (trips/day)',  value: D_internal,           source: '65% of D_total' },
  { metric: 'Car trips/day',           value: car_trips,            source: 'MiD 2017' },
  { metric: 'Car vehicles/day',        value: car_vehicles_per_day, source: 'MiD 2017' },
  { metric: 'Transit trips/day',       value: transit_trips,        source: 'MiD 2017' },
  { metric: 'Walking trips/day',       value: walk_trips,           source: 'MiD 2017' },
  { metric: 'Cycling trips/day',       value: cycling_trips,        source: 'MiD 2017' },
]

// ─── FLEET CALCULATION (Post-Car Wolfsburg) ───────────────────────────────────
const ZONE_AREA_KM2 = 4.0
const CARS_REPLACED = 49648

const NEW_MODAL = {
  e_bike:             { share: 0.25, label: 'E-Bike',         color: '#27AE60' },
  autonomous_shuttle: { share: 0.18, label: 'Auto Shuttle',   color: '#8E44AD' },
  autonomous_bus:     { share: 0.10, label: 'Auto Bus',       color: '#2C3E50' },
  autonomous_pod:     { share: 0.10, label: 'Auto Pod',       color: '#2980B9' },
  car_sharing_ev:     { share: 0.07, label: 'Car-Share EV',   color: '#E67E22' },
}

const FLEET_PARAMS = {
  e_bike:             { capacity: 1,    turnover: 7,  peak_factor: 1.35, trip_h: 0.25, source: 'Nextbike operational data' },
  autonomous_shuttle: { capacity: 12,   turnover: 40, peak_factor: 1.40, trip_h: 0.25, source: 'UITP autonomous shuttle benchmarks' },
  autonomous_bus:     { capacity: 25,   turnover: 18, peak_factor: 1.45, trip_h: 0.40, source: 'UITP urban bus benchmarks' },
  autonomous_pod:     { capacity: 1.5,  turnover: 22, peak_factor: 1.30, trip_h: 0.20, source: 'MOIA Hamburg analogue' },
  car_sharing_ev:     { capacity: 3.5,  turnover: 5,  peak_factor: 1.25, trip_h: 0.50, source: 'Share Now / Stadtmobil data' },
}

const ceil = Math.ceil
const transport_share_total = 1 - 0.30   // walking = 0.30

const fleet = {}
for (const [mode, { share }] of Object.entries(NEW_MODAL)) {
  const trips   = D_internal * share
  const p       = FLEET_PARAMS[mode]
  const base    = ceil(trips / (p.turnover * p.capacity))
  const peak    = ceil(base  * p.peak_factor)
  const mode_share_transport = share / transport_share_total
  const peak_trips_mode      = peak_hour_trips * mode_share_transport
  const on_street            = ceil((peak_trips_mode / p.capacity) * p.trip_h)
  const charging             = mode === 'e_bike'
    ? ceil(peak * 0.50)
    : ceil(peak * 0.30)
  fleet[mode] = { trips: D_internal * share, base, peak, on_street, charging, density: +(peak / ZONE_AREA_KM2).toFixed(1) }
}

const total_fleet    = Object.values(fleet).reduce((s, f) => s + f.peak, 0)
const total_charging = Object.values(fleet).reduce((s, f) => s + f.charging, 0)
const total_on_street= Object.values(fleet).reduce((s, f) => s + f.on_street, 0)
const replacement_ratio = (CARS_REPLACED / total_fleet).toFixed(1)

// ─── SHARED UTILS ─────────────────────────────────────────────────────────────
const fmt = n => Math.round(n).toLocaleString('de-DE')

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function SectionBlock({ id, title, subtitle, children, accent }) {
  return (
    <div id={id} style={{
      background: '#fff', borderRadius: 16, padding: '22px 24px',
      border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.015em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function KPICard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 18px',
      border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 20px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.10em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
    </div>
  )
}

function NavLink({ href, label, active }) {
  return (
    <a href={href} style={{
      display: 'block', padding: '7px 14px', borderRadius: 8, fontSize: 13,
      fontWeight: active ? 600 : 400, color: active ? '#0A7E45' : '#6E6E73',
      background: active ? 'rgba(10,126,69,0.08)' : 'transparent',
      textDecoration: 'none', transition: 'all 0.15s ease',
    }}>
      {label}
    </a>
  )
}

// ─── BASELINE CHARTS ──────────────────────────────────────────────────────────
function ModalShareChart() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(MODAL).map(([key, { share, label, color }]) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 13, color: '#1D1D1F' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{(share*100).toFixed(0)}%</span>
          </div>
          <div style={{ height: 9, background: '#E8E8ED', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(share/0.62)*100}%`, height: '100%', background: color, borderRadius: 5 }} />
          </div>
          <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 3 }}>{fmt(D_total * share)} trips/day</div>
        </div>
      ))}
    </div>
  )
}

function DistrictChart() {
  const maxPop = Math.max(...Object.values(DISTRICT_POP))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(DISTRICT_POP).sort(([,a],[,b]) => b-a).map(([name, pop]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 108, fontSize: 12, color: '#3D3D3F', flexShrink: 0 }}>{name}</div>
          <div style={{ flex: 1, height: 7, background: '#E8E8ED', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(pop/maxPop)*100}%`, height: '100%', background: '#0071E3', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 12, color: '#6E6E73', width: 44, textAlign: 'right', flexShrink: 0 }}>
            {pop.toLocaleString('de-DE')}
          </div>
        </div>
      ))}
    </div>
  )
}

function HourlyChart() {
  const maxS = Math.max(...HOUR_SHARE)
  const isPeak = h => (h >= 7 && h <= 9) || (h >= 16 && h <= 18)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
        {HOUR_SHARE.map((s, h) => (
          <div key={h} title={`${h}:00 — ${fmt(D_total*s)} trips`} style={{
            flex: 1, height: `${(s/maxS)*100}%`,
            background: isPeak(h) ? '#E63946' : '#0071E3',
            borderRadius: '3px 3px 0 0', opacity: 0.85, cursor: 'default',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, borderTop: '1px solid #E8E8ED', paddingTop: 4 }}>
        {[0,4,8,12,16,20,23].map(h => <span key={h} style={{ fontSize: 10, color: '#AEAEB2' }}>{h}h</span>)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[['#E63946','Peak (7–9h, 16–18h)'],['#0071E3','Off-peak']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: '#6E6E73' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsTable({ rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E8ED' }}>
            {['Metric','Value','Source'].map(h => (
              <th key={h} style={{
                textAlign: h==='Value' ? 'right' : 'left', padding: '8px 10px',
                fontWeight: 600, color: '#6E6E73', fontSize: 11,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ metric, value, source }, i) => (
            <tr key={metric} style={{ background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
              <td style={{ padding: '9px 10px', color: '#1D1D1F' }}>{metric}</td>
              <td style={{ padding: '9px 10px', color: '#1D1D1F', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(value)}
              </td>
              <td style={{ padding: '9px 10px', color: '#AEAEB2' }}>{source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── FLEET CHARTS ─────────────────────────────────────────────────────────────
function FleetModeCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {Object.entries(NEW_MODAL).map(([key, { label, color }]) => {
        const f = fleet[key]
        return (
          <div key={key} style={{
            background: '#fff', borderRadius: 14, padding: '14px 14px',
            border: `1.5px solid ${color}30`,
            borderTop: `3px solid ${color}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(f.peak)}</div>
            <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 2, marginBottom: 10 }}>peak units</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#6E6E73' }}>Base</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3D3D3F' }}>{fmt(f.base)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#6E6E73' }}>On street</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3D3D3F' }}>{fmt(f.on_street)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#6E6E73' }}>Charging</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3D3D3F' }}>{fmt(f.charging)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#6E6E73' }}>Trips/day</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3D3D3F' }}>{fmt(f.trips)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FleetBaseVsPeakChart() {
  const modes = Object.keys(NEW_MODAL)
  const maxVal = Math.max(...modes.map(m => fleet[m].peak))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {modes.map(mode => {
        const { label, color } = NEW_MODAL[mode]
        const { base, peak } = fleet[mode]
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#1D1D1F', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 12, color: '#6E6E73' }}>
                {fmt(base)} <span style={{ color: '#AEAEB2' }}>base</span>
                {'  →  '}
                <span style={{ fontWeight: 700, color }}>{fmt(peak)}</span> <span style={{ color: '#AEAEB2' }}>peak</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 20 }}>
              <div style={{ position: 'absolute', inset: 0, background: '#E8E8ED', borderRadius: 5 }} />
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${(peak/maxVal)*100}%`,
                background: color, opacity: 0.35, borderRadius: 5,
              }} />
              <div style={{
                position: 'absolute', left: 0, top: 3, bottom: 3,
                width: `${(base/maxVal)*100}%`,
                background: color, borderRadius: 4,
              }} />
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        {[['full bar (light)','Peak fleet'],['inner bar (solid)','Base fleet']].map(([desc,label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 8, background: '#6E6E73', borderRadius: 2, opacity: desc.includes('light') ? 0.35 : 1 }} />
            <span style={{ fontSize: 11, color: '#6E6E73' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplacementChart() {
  const modes = Object.keys(NEW_MODAL)
  const scaleMax = Math.max(CARS_REPLACED, total_fleet) * 1.08
  const barW = 110

  const segments = modes.map(m => ({ mode: m, ...NEW_MODAL[m], val: fleet[m].peak }))

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end' }}>
      {/* Baseline column */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#AEAEB2', marginBottom: 6 }}>BASELINE</div>
        <div style={{
          width: barW,
          height: Math.round((CARS_REPLACED / scaleMax) * 280),
          background: '#E63946', borderRadius: '6px 6px 0 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(CARS_REPLACED)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#E63946', fontWeight: 600, marginTop: 6 }}>Private cars</div>
      </div>

      {/* Post-Car stacked column */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#AEAEB2', marginBottom: 6 }}>POST-CAR</div>
        <div style={{
          width: barW,
          height: Math.round((total_fleet / scaleMax) * 280),
          borderRadius: '6px 6px 0 0', overflow: 'hidden',
          display: 'flex', flexDirection: 'column-reverse',
        }}>
          {segments.map(({ mode, color, val }) => (
            <div key={mode} style={{
              flex: val,
              background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {val > 150 && <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{fmt(val)}</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#1D1D1F', fontWeight: 600, marginTop: 6 }}>Shared fleet</div>
        <div style={{ fontSize: 11, color: '#6E6E73' }}>{fmt(total_fleet)} units total</div>
      </div>

      {/* Legend + ratio */}
      <div style={{ flex: 1, paddingBottom: 28 }}>
        <div style={{
          background: 'rgba(10,126,69,0.07)', border: '1px solid rgba(10,126,69,0.2)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0A7E45', letterSpacing: '-0.02em' }}>
            1 : {replacement_ratio}
          </div>
          <div style={{ fontSize: 12, color: '#2D6A4F', marginTop: 3 }}>
            shared vehicle replaces {replacement_ratio} private cars
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {segments.map(({ mode, color, label, val }) => (
            <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#3D3D3F', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DotMatrix() {
  const UNIT = 10
  const COLS = 60

  const carDots  = Math.ceil(CARS_REPLACED / UNIT)
  const fleetDots= Math.ceil(total_fleet / UNIT)

  const carRows  = Math.ceil(carDots / COLS)
  const fleetRows= Math.ceil(fleetDots / COLS)

  const renderDots = (count, cols, colorFn) => {
    const rows = []
    for (let r = 0; r < Math.ceil(count / cols); r++) {
      const cells = []
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        if (idx >= count) break
        cells.push(
          <div key={c} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: colorFn(idx), flexShrink: 0,
          }} />
        )
      }
      rows.push(<div key={r} style={{ display: 'flex', gap: 3 }}>{cells}</div>)
    }
    return rows
  }

  // colour for fleet dots: cycle through modes by proportion
  const modeOrder = Object.keys(NEW_MODAL)
  const modeDots  = modeOrder.map(m => Math.ceil(fleet[m].peak / UNIT))
  const fleetColorFn = (idx) => {
    let acc = 0
    for (let i = 0; i < modeOrder.length; i++) {
      acc += modeDots[i]
      if (idx < acc) return NEW_MODAL[modeOrder[i]].color
    }
    return '#ccc'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cars */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#E63946', marginBottom: 8 }}>
          Private Cars — {fmt(CARS_REPLACED)} units
          <span style={{ fontSize: 11, fontWeight: 400, color: '#AEAEB2', marginLeft: 8 }}>
            (each dot = {UNIT} vehicles)
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {renderDots(carDots, COLS, () => '#E63946')}
        </div>
      </div>

      {/* Fleet */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', marginBottom: 8 }}>
          Post-Car Fleet — {fmt(total_fleet)} units
          <span style={{ fontSize: 11, fontWeight: 400, color: '#AEAEB2', marginLeft: 8 }}>
            (each dot = {UNIT} vehicles)
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {renderDots(fleetDots, COLS, fleetColorFn)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {modeOrder.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: NEW_MODAL[m].color }} />
              <span style={{ fontSize: 11, color: '#6E6E73' }}>{NEW_MODAL[m].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChargingChart() {
  const modes  = Object.keys(NEW_MODAL)
  const maxVal = Math.max(...modes.map(m => fleet[m].charging))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {modes.map(mode => {
        const { label, color } = NEW_MODAL[mode]
        const val = fleet[mode].charging
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#1D1D1F' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt(val)} pts</span>
            </div>
            <div style={{ height: 8, background: '#E8E8ED', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(val/maxVal)*100}%`, height: '100%', background: color, borderRadius: 4 }} />
            </div>
          </div>
        )
      })}
      <div style={{
        marginTop: 8, padding: '10px 14px',
        background: 'rgba(10,126,69,0.06)', borderRadius: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>Total charging points</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#0A7E45' }}>{fmt(total_charging)}</span>
      </div>
    </div>
  )
}

function FleetSummaryGrid() {
  const cards = [
    { label: 'Total fleet (peak)',   value: fmt(total_fleet),       sub: 'all modes combined',         color: '#0071E3' },
    { label: 'Cars replaced',        value: fmt(CARS_REPLACED),     sub: 'baseline private cars/day',  color: '#E63946' },
    { label: 'Replacement ratio',    value: `1 : ${replacement_ratio}`, sub: 'shared → private cars', color: '#0A7E45' },
    { label: 'Total charging pts',   value: fmt(total_charging),    sub: 'simultaneous',               color: '#8E44AD' },
    { label: 'On-street peak',       value: fmt(total_on_street),   sub: 'vehicles at 08:00',          color: '#E67E22' },
    { label: 'Zone coverage',        value: `${(total_fleet/ZONE_AREA_KM2).toFixed(1)}`, sub: 'units per km²', color: '#2980B9' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {cards.map(({ label, value, sub, color }) => (
        <div key={label} style={{
          background: '#fff', borderRadius: 14, padding: '16px 18px',
          border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginTop: 6 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>
  )
}

function FleetResultsTable() {
  const rows = Object.entries(NEW_MODAL).map(([mode, { label }]) => {
    const f = fleet[mode]
    return { mode, label, ...f }
  })
  const cols = [
    { key: 'label',      head: 'Mode',           align: 'left'  },
    { key: 'trips',      head: 'Trips/day',       align: 'right' },
    { key: 'base',       head: 'Fleet base',      align: 'right' },
    { key: 'peak',       head: 'Fleet peak',      align: 'right' },
    { key: 'on_street',  head: 'On street (peak)',align: 'right' },
    { key: 'charging',   head: 'Charging pts',    align: 'right' },
    { key: 'density',    head: 'Units/km²',       align: 'right' },
  ]
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E8ED' }}>
            {cols.map(c => (
              <th key={c.key} style={{
                textAlign: c.align, padding: '8px 10px',
                fontWeight: 600, color: '#6E6E73', fontSize: 11,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{c.head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.mode} style={{ background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
              <td style={{ padding: '9px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: NEW_MODAL[row.mode].color, flexShrink: 0 }} />
                  <span style={{ color: '#1D1D1F', fontWeight: 500 }}>{row.label}</span>
                </div>
              </td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.trips)}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#6E6E73', fontVariantNumeric: 'tabular-nums' }}>{row.base}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: NEW_MODAL[row.mode].color, fontVariantNumeric: 'tabular-nums' }}>{row.peak}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{row.on_street}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{row.charging}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#6E6E73', fontVariantNumeric: 'tabular-nums' }}>{row.density}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── LEFT NAV ─────────────────────────────────────────────────────────────────
const NAV = [
  { href: '#overview',     label: 'Overview' },
  { href: '#demand',       label: 'Transport demand' },
  { href: '#modal-split',  label: 'Modal split' },
  { href: '#districts',    label: 'Districts' },
  { href: '#hourly',       label: 'Hourly distribution' },
  { href: '#baseline-tbl', label: 'Baseline table' },
  { href: '#fleet',        label: '— Fleet sizing' },
  { href: '#fleet-cards',  label: 'Mode cards' },
  { href: '#fleet-chart',  label: 'Base vs peak' },
  { href: '#replacement',  label: 'Replacement' },
  { href: '#dot-matrix',   label: 'Dot matrix' },
  { href: '#charging',     label: 'Charging points' },
  { href: '#fleet-tbl',    label: 'Fleet table' },
]

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DataPanel() {
  const [activeNav, setActiveNav] = useState('#overview')

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      background: '#F5F5F7', zIndex: 10, overflow: 'hidden',
    }}>

      {/* ── Left navigation sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0, overflowY: 'auto',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        padding: '24px 10px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 14px 10px' }}>
          Data
        </div>
        {NAV.map(({ href, label }) => {
          const isSection = label.startsWith('—')
          if (isSection) return (
            <div key={href} style={{ padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, color: '#0A7E45', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {label.replace('— ','')}
            </div>
          )
          return (
            <a key={href} href={href}
              onClick={() => setActiveNav(href)}
              style={{
                display: 'block', padding: '7px 14px', borderRadius: 8, fontSize: 13,
                fontWeight: activeNav === href ? 600 : 400,
                color: activeNav === href ? '#0A7E45' : '#6E6E73',
                background: activeNav === href ? 'rgba(10,126,69,0.08)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s ease',
              }}
            >{label}</a>
          )
        })}

        <div style={{ marginTop: 'auto', padding: '16px 14px 0', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 10, color: '#AEAEB2', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sources</div>
            <div>MiD 2017</div>
            <div>WOKS 2023/2025</div>
            <div>KBA 2023</div>
            <div>UITP benchmarks</div>
            <div>MOIA Hamburg</div>
          </div>
        </div>
      </div>

      {/* ── Main scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 80px' }}>

        {/* ── PART 1: BASELINE ── */}
        <div id="overview" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Part 1 · Baseline
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.025em' }}>
            Modal Distribution
          </h1>
          <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 6, lineHeight: 1.5 }}>
            9 central districts · {fmt(total_residents)} residents · {fmt(D_total)} estimated trips/day
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24, marginTop: 20 }}>
          <KPICard label="Residents"       value={fmt(total_residents)} sub="9 districts · WOKS 2023"  color="#0071E3" />
          <KPICard label="Workers in zone" value={fmt(WORKERS)}         sub="WOKS Arbeitsmarkt 2025"   color="#7C3AED" />
          <KPICard label="Daily visitors"  value={fmt(visitors)}        sub="MiD 2017 estimate"        color="#2D6A4F" />
          <KPICard label="Total trips/day" value={fmt(D_total)}         sub="MiD 2017 formula"         color="#E63946" />
        </div>

        <div id="demand" style={{ marginBottom: 16 }}>
          <SectionBlock title="Transport Demand" subtitle="Step-by-step demand calculation · MiD 2017 formula" accent="#0071E3">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Residents', val: total_residents, factor: `× ${T_RESIDENT}`, result: total_residents*T_RESIDENT, color: '#0071E3' },
                { label: 'Workers',   val: WORKERS,         factor: `× ${T_WORKER}`,   result: WORKERS*T_WORKER,          color: '#7C3AED' },
                { label: 'Visitors',  val: visitors,        factor: `× ${T_VISITOR}`,  result: visitors*T_VISITOR,        color: '#2D6A4F' },
              ].map(({ label, val, factor, result, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: '#F5F5F7', borderRadius: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#1D1D1F', width: 72 }}>{label}</span>
                  <span style={{ fontSize: 13, color: '#6E6E73', fontVariantNumeric: 'tabular-nums', width: 60 }}>{fmt(val)}</span>
                  <span style={{ fontSize: 13, color: '#AEAEB2', width: 44 }}>{factor}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>= {fmt(result)}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', background: '#1D1D1F', borderRadius: 10, marginTop: 4,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>D_total (trips/day)</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#E63946', fontVariantNumeric: 'tabular-nums' }}>{fmt(D_total)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#F5F5F7', borderRadius: 10, border: '1px dashed rgba(0,0,0,0.1)',
              }}>
                <span style={{ fontSize: 13, color: '#6E6E73' }}>D_internal (65% intra-zone)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{fmt(D_internal)}</span>
              </div>
            </div>
          </SectionBlock>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div id="modal-split">
            <SectionBlock title="Modal Share" subtitle="Share of daily trips · MiD 2017 + KBA 2023" accent="#E63946">
              <ModalShareChart />
            </SectionBlock>
          </div>
          <div id="districts">
            <SectionBlock title="District Population" subtitle="Residents per district · WOKS 2023" accent="#0071E3">
              <DistrictChart />
            </SectionBlock>
          </div>
        </div>

        <div id="hourly" style={{ marginBottom: 16 }}>
          <SectionBlock title="Hourly Trip Distribution" subtitle="Estimated weekday pattern · MiD 2017 · hover bars for values" accent="#1D70B8">
            <HourlyChart />
          </SectionBlock>
        </div>

        <div id="baseline-tbl" style={{ marginBottom: 4 }}>
          <SectionBlock title="Baseline Results" subtitle="All metrics from open statistical data">
            <ResultsTable rows={BASELINE_RESULTS} />
          </SectionBlock>
        </div>

        {/* ── PART 2: FLEET ── */}
        <Divider label="Part 2 · Post-Car Fleet Sizing" />

        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
            Post-Car Fleet Sizing
          </h2>
          <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 6, lineHeight: 1.5 }}>
            Wolfsburg city centre · {fmt(D_internal)} intra-zone trips/day · peak hour {fmt(peak_hour_trips)} trips
          </p>
        </div>

        <div style={{ marginBottom: 20, marginTop: 20 }}>
          <FleetSummaryGrid />
        </div>

        <div id="fleet-cards" style={{ marginBottom: 16 }}>
          <SectionBlock title="Fleet by Mode" subtitle="Base → peak units · daily trips · on-street at peak hour · charging points" accent="#0A7E45">
            <FleetModeCards />
          </SectionBlock>
        </div>

        <div id="fleet-chart" style={{ marginBottom: 16 }}>
          <SectionBlock title="Base vs Peak Fleet" subtitle="Base = daily demand / (turnover × capacity) · Peak = base × peak factor" accent="#27AE60">
            <FleetBaseVsPeakChart />
          </SectionBlock>
        </div>

        <div id="replacement" style={{ marginBottom: 16 }}>
          <SectionBlock title="Fleet Replacement Comparison" subtitle="49,648 private cars/day replaced by shared fleet" accent="#E63946">
            <ReplacementChart />
          </SectionBlock>
        </div>

        <div id="dot-matrix" style={{ marginBottom: 16 }}>
          <SectionBlock title="Dot Matrix" subtitle="Visual scale comparison — each dot = 10 vehicles" accent="#8E44AD">
            <DotMatrix />
          </SectionBlock>
        </div>

        <div id="charging" style={{ marginBottom: 16 }}>
          <SectionBlock title="Charging Points Needed" subtitle="30% of fleet simultaneously charging · e-bike 50% (short cycle)" accent="#2980B9">
            <ChargingChart />
          </SectionBlock>
        </div>

        <div id="fleet-tbl" style={{ marginBottom: 16 }}>
          <SectionBlock title="Fleet Results Table" subtitle="Full breakdown by mode · Source: Python script analysis/fleet_calculation.py">
            <FleetResultsTable />
          </SectionBlock>
        </div>

        {/* ── Sources ── */}
        <div style={{
          padding: '16px 20px', background: 'rgba(0,0,0,0.03)',
          borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: 12, color: '#AEAEB2', margin: 0, lineHeight: 1.8 }}>
            <strong style={{ color: '#6E6E73' }}>Data sources · Baseline:</strong>{' '}
            MiD 2017 (Mobilität in Deutschland, BMVI) · WOKS Wolfsburg 2023/2025 · KBA 2023<br />
            <strong style={{ color: '#6E6E73' }}>Data sources · Fleet:</strong>{' '}
            Nextbike operational data · UITP autonomous shuttle & bus benchmarks · MOIA Hamburg analogue · Share Now / Stadtmobil data<br />
            Python scripts:{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>analysis/modal_distribution.py</code>{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>analysis/fleet_calculation.py</code>
          </p>
        </div>

      </div>
    </div>
  )
}
