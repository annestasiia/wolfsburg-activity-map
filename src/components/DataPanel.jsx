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

// ─── FLEET CALCULATION v2 (Post-Car Wolfsburg) ───────────────────────────────
const ZONE_AREA_KM2 = 4.0
const CARS_REPLACED = 49648

const MODE_META = {
  e_bike:             { label: 'E-Bike',       color: '#27AE60' },
  autonomous_shuttle: { label: 'Auto Shuttle', color: '#8E44AD' },
  autonomous_bus:     { label: 'Auto Bus',     color: '#2C3E50' },
  autonomous_pod:     { label: 'Auto Pod',     color: '#2980B9' },
  car_sharing_ev:     { label: 'Car-Share EV', color: '#E67E22' },
}

const FLEET_PARAMS = {
  e_bike:             { capacity: 1,    trip_h: 0.25, peak_factor: 1.20, source: 'Nextbike operational data' },
  autonomous_shuttle: { capacity: 12,   trip_h: 0.25, peak_factor: 1.30, source: 'UITP benchmarks' },
  autonomous_bus:     { capacity: 25,   trip_h: 0.40, peak_factor: 1.35, source: 'UITP urban bus benchmarks' },
  autonomous_pod:     { capacity: 1.5,  trip_h: 0.20, peak_factor: 1.20, source: 'MOIA Hamburg analogue' },
  car_sharing_ev:     { capacity: 3.5,  trip_h: 0.50, peak_factor: 1.15, source: 'Share Now / Stadtmobil data' },
}

const ceil = Math.ceil

// Step 1 — trip flow decomposition
const inbound_worker_trips  = WORKERS * T_WORKER  * 0.50
const inbound_visitor_trips = visitors * T_VISITOR * 0.80
const inbound_trips         = inbound_worker_trips + inbound_visitor_trips

const resident_trips        = total_residents * T_RESIDENT
const internal_worker_trips = WORKERS * T_WORKER  * 0.50
const internal_visitor_trips= visitors * T_VISITOR * 0.20
const internal_other_trips  = internal_worker_trips + internal_visitor_trips
const all_internal_trips    = resident_trips + internal_other_trips

const WALKING_SHARE_INTERNAL = 0.60
const transport_internal    = all_internal_trips * (1 - WALKING_SHARE_INTERNAL)
const walking_filtered      = all_internal_trips * WALKING_SHARE_INTERNAL
const D_transport           = inbound_trips + transport_internal
const reduction_pct         = ((D_total - D_transport) / D_total * 100).toFixed(1)

// Step 2 — modal split by flow type
const INBOUND_MODAL  = { autonomous_bus: 0.35, autonomous_shuttle: 0.25, car_sharing_ev: 0.25, autonomous_pod: 0.15 }
const INTERNAL_MODAL = { e_bike: 0.45, autonomous_pod: 0.35, autonomous_shuttle: 0.20 }

const trips_by_mode = {}
for (const [m, s] of Object.entries(INBOUND_MODAL))
  trips_by_mode[m] = (trips_by_mode[m] || 0) + inbound_trips * s
for (const [m, s] of Object.entries(INTERNAL_MODAL))
  trips_by_mode[m] = (trips_by_mode[m] || 0) + transport_internal * s

// Step 3 — fleet from peak hour
const mode_shares       = Object.fromEntries(Object.entries(trips_by_mode).map(([m, t]) => [m, t / D_transport]))
const peak_trips_by_mode= Object.fromEntries(Object.entries(mode_shares).map(([m, s]) => [m, peak_hour_trips * s]))

const fleet = {}
for (const mode of Object.keys(MODE_META)) {
  const p          = FLEET_PARAMS[mode]
  const pt         = peak_trips_by_mode[mode] || 0
  const on_street  = ceil((pt / p.capacity) * p.trip_h)
  const fleet_total_mode = ceil(on_street * p.peak_factor)
  const charging   = mode === 'e_bike' ? ceil(fleet_total_mode * 0.50) : ceil(fleet_total_mode * 0.30)
  fleet[mode] = {
    trips:      trips_by_mode[mode] || 0,
    peak_hour:  pt,
    on_street,
    total:      fleet_total_mode,
    charging,
    inbound:    inbound_trips * (INBOUND_MODAL[mode] || 0),
    internal:   transport_internal * (INTERNAL_MODAL[mode] || 0),
  }
}

const total_fleet     = Object.values(fleet).reduce((s, f) => s + f.total, 0)
const total_charging  = Object.values(fleet).reduce((s, f) => s + f.charging, 0)
const total_on_street = Object.values(fleet).reduce((s, f) => s + f.on_street, 0)
const replacement_ratio = (CARS_REPLACED / total_fleet).toFixed(1)

// ─── HUB NETWORK (Step 3 · coverage + fleet distribution) ────────────────────
const HUB_S_RADIUS = 200
const HUB_M_RADIUS = 400
const hub_zone_m2  = ZONE_AREA_KM2 * 1_000_000

const hub_s_area       = Math.PI * HUB_S_RADIUS ** 2
const hub_s_count      = ceil((hub_zone_m2 / hub_s_area) * 1.35)

const hub_m_area          = Math.PI * HUB_M_RADIUS ** 2
const hub_m_from_geometry = ceil((hub_zone_m2 / hub_m_area) * 1.35)
const hub_m_from_shuttle  = ceil(fleet.autonomous_shuttle.total / 3)
const hub_m_count         = Math.max(hub_m_from_geometry, hub_m_from_shuttle)

const hub_l_from_fleet = ceil((fleet.autonomous_bus.total + fleet.car_sharing_ev.total) / 8)
const hub_l_count      = Math.min(Math.max(hub_l_from_fleet, 3), 6)

const HUB_COUNTS  = { hub_l: hub_l_count, hub_m: hub_m_count, hub_s: hub_s_count }
const HUB_COLORS_UI = { hub_l: '#1A1A1A', hub_m: '#2D6A4F', hub_s: '#95B8A0' }
const HUB_LABELS_UI = { hub_l: 'Hub L',  hub_m: 'Hub M',   hub_s: 'Hub S' }
const TIERS = ['hub_l', 'hub_m', 'hub_s']

const HUB_DISTRIBUTION = {
  car_sharing_ev:     { hub_l: 1.00, hub_m: 0.00, hub_s: 0.00 },
  autonomous_bus:     { hub_l: 1.00, hub_m: 0.00, hub_s: 0.00 },
  autonomous_shuttle: { hub_l: 0.50, hub_m: 0.50, hub_s: 0.00 },
  autonomous_pod:     { hub_l: 0.30, hub_m: 0.50, hub_s: 0.20 },
  e_bike:             { hub_l: 0.00, hub_m: 0.30, hub_s: 0.70 },
}

const fleet_at_tier = {}
const fleet_per_hub = {}
for (const tier of TIERS) {
  fleet_at_tier[tier] = {}
  fleet_per_hub[tier] = {}
  for (const mode of Object.keys(MODE_META)) {
    const share = HUB_DISTRIBUTION[mode]?.[tier] || 0
    fleet_at_tier[tier][mode] = ceil(fleet[mode].total * share)
    fleet_per_hub[tier][mode] = ceil(fleet_at_tier[tier][mode] / HUB_COUNTS[tier] * 1.20)
  }
}

const HUB_CHARGING_RATE = { e_bike: 0.50, autonomous_pod: 0.30, autonomous_shuttle: 0.30, autonomous_bus: 0.30, car_sharing_ev: 0.30 }
const HUB_FOOTPRINT_M2  = { e_bike: 2, autonomous_pod: 8, autonomous_shuttle: 30, autonomous_bus: 55, car_sharing_ev: 12 }

const hub_charging_per  = {}
const hub_footprint_per = {}
for (const tier of TIERS) {
  hub_charging_per[tier]  = Object.keys(MODE_META).reduce((sum, mode) =>
    sum + ceil((fleet_per_hub[tier][mode] || 0) * HUB_CHARGING_RATE[mode]), 0)
  hub_footprint_per[tier] = Object.keys(MODE_META).reduce((sum, mode) =>
    sum + (fleet_per_hub[tier][mode] || 0) * HUB_FOOTPRINT_M2[mode], 0)
}

const hub_total_charging  = TIERS.reduce((s, t) => s + hub_charging_per[t]  * HUB_COUNTS[t], 0)
const hub_total_footprint = TIERS.reduce((s, t) => s + hub_footprint_per[t] * HUB_COUNTS[t], 0)
const hub_footprint_pct   = (hub_total_footprint / hub_zone_m2 * 100).toFixed(2)

// ─── HUB AREA  S_hub = S_fleet + S_circ + S_charging + S_program ──────────────
const FOOTPRINT_PER_UNIT = { e_bike: 2.5, autonomous_pod: 10, autonomous_shuttle: 35, autonomous_bus: 60, car_sharing_ev: 15 }
const CIRCULATION_FACTOR = { hub_l: 1.60, hub_m: 1.40, hub_s: 1.20 }
const CHARGING_FP_M2     = { e_bike: 0.5, other: 4.0 }
const PROGRAM_SHARE_AREA = 0.10

const S_fleet_area    = {}
const S_circ_area     = {}
const S_charging_area = {}
const S_program_area  = {}
const S_hub_area      = {}

for (const tier of TIERS) {
  S_fleet_area[tier] = Object.keys(MODE_META).reduce(
    (sum, mode) => sum + (fleet_per_hub[tier][mode] || 0) * FOOTPRINT_PER_UNIT[mode], 0)
  S_circ_area[tier] = S_fleet_area[tier] * (CIRCULATION_FACTOR[tier] - 1)
  S_charging_area[tier] = Object.keys(MODE_META).reduce((sum, mode) => {
    const n = fleet_per_hub[tier][mode] || 0
    const chargers = ceil(n * HUB_CHARGING_RATE[mode])
    const fp = mode === 'e_bike' ? CHARGING_FP_M2.e_bike : CHARGING_FP_M2.other
    return sum + chargers * fp
  }, 0)
  const sub = S_fleet_area[tier] + S_circ_area[tier] + S_charging_area[tier]
  S_program_area[tier] = sub * PROGRAM_SHARE_AREA
  S_hub_area[tier] = sub + S_program_area[tier]
}

const area_total_all_hubs = TIERS.reduce((s, t) => s + S_hub_area[t] * HUB_COUNTS[t], 0)
const area_pct_of_zone    = (area_total_all_hubs / hub_zone_m2 * 100).toFixed(2)

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
function FlowDecompositionChart() {
  const flows = [
    { label: 'Inbound',          value: inbound_trips,      color: '#E63946', sub: 'cross-boundary' },
    { label: 'Internal transport',value: transport_internal, color: '#2980B9', sub: 'needs vehicle' },
    { label: 'Walking (filtered)',value: walking_filtered,   color: '#AEAEB2', sub: '60% of internal' },
  ]
  const maxVal = D_total
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* D_total bar */}
      <div style={{ padding: '10px 14px', background: '#1D1D1F', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>D_total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#E63946' }}>{fmt(D_total)} trips/day</span>
      </div>

      {/* Three flows */}
      {flows.map(({ label, value, color, sub }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <div>
              <span style={{ fontSize: 13, color: '#1D1D1F', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 8 }}>{sub}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt(value)}</span>
          </div>
          <div style={{ height: 10, background: '#E8E8ED', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(value/maxVal)*100}%`, height: '100%', background: color, borderRadius: 5 }} />
          </div>
        </div>
      ))}

      {/* D_transport result */}
      <div style={{ padding: '10px 14px', background: 'rgba(10,126,69,0.07)', border: '1px solid rgba(10,126,69,0.20)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0A7E45' }}>D_transport (net)</span>
          <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 8 }}>inbound + internal transport</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0A7E45' }}>{fmt(D_transport)}</div>
          <div style={{ fontSize: 11, color: '#AEAEB2' }}>−{reduction_pct}% vs D_total</div>
        </div>
      </div>

      {/* Mode trip split */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6E6E73', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Trips/day by mode
        </div>
        {Object.entries(MODE_META).map(([mode, { label, color }]) => {
          const f    = fleet[mode]
          const maxT = Math.max(...Object.values(fleet).map(x => x.trips))
          return (
            <div key={mode} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 13, color: '#1D1D1F' }}>{label}</span>
                  {f.inbound > 0 && <span style={{ fontSize: 10, color: '#E63946', background: 'rgba(230,57,70,0.08)', padding: '1px 6px', borderRadius: 4 }}>inbound</span>}
                  {f.internal > 0 && <span style={{ fontSize: 10, color: '#2980B9', background: 'rgba(41,128,185,0.08)', padding: '1px 6px', borderRadius: 4 }}>internal</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt(f.trips)}</span>
              </div>
              <div style={{ height: 7, background: '#E8E8ED', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                {f.inbound > 0 && <div style={{ width: `${(f.inbound/maxT)*100}%`, background: color, opacity: 0.45 }} />}
                {f.internal > 0 && <div style={{ width: `${(f.internal/maxT)*100}%`, background: color, opacity: 0.90 }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FleetModeCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {Object.entries(MODE_META).map(([key, { label, color }]) => {
        const f = fleet[key]
        return (
          <div key={key} style={{
            background: '#fff', borderRadius: 14, padding: '14px 14px',
            border: `1.5px solid ${color}30`, borderTop: `3px solid ${color}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(f.total)}</div>
            <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 2, marginBottom: 10 }}>total fleet</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['On-street peak', f.on_street],
                ['Peak/hour trips', f.peak_hour],
                ['Charging pts',   f.charging],
                ['Trips/day',      f.trips],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#6E6E73' }}>{lbl}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#3D3D3F' }}>{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FleetOnStreetVsTotalChart() {
  const modes  = Object.keys(MODE_META)
  const maxVal = Math.max(...modes.map(m => fleet[m].total))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {modes.map(mode => {
        const { label, color } = MODE_META[mode]
        const { on_street, total } = fleet[mode]
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#1D1D1F', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 12, color: '#6E6E73' }}>
                <span style={{ fontWeight: 700, color }}>{fmt(on_street)}</span>
                <span style={{ color: '#AEAEB2' }}> on-street  →  </span>
                <span style={{ fontWeight: 700, color: '#1D1D1F' }}>{fmt(total)}</span>
                <span style={{ color: '#AEAEB2' }}> total</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 20 }}>
              <div style={{ position: 'absolute', inset: 0, background: '#E8E8ED', borderRadius: 5 }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(total/maxVal)*100}%`, background: color, opacity: 0.30, borderRadius: 5 }} />
              <div style={{ position: 'absolute', left: 0, top: 3, bottom: 3, width: `${(on_street/maxVal)*100}%`, background: color, borderRadius: 4 }} />
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        {[['solid','On-street at peak hour'],['light (wide)','Total fleet (with reserve)']].map(([t,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 8, background: '#6E6E73', borderRadius: 2, opacity: t==='light (wide)' ? 0.30 : 1 }} />
            <span style={{ fontSize: 11, color: '#6E6E73' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplacementChart() {
  const modes = Object.keys(MODE_META)
  const scaleMax = Math.max(CARS_REPLACED, total_fleet) * 1.08
  const barW = 110

  const segments = modes.map(m => ({ mode: m, ...MODE_META[m], val: fleet[m].total }))

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
  const modeOrder = Object.keys(MODE_META)
  const modeDots  = modeOrder.map(m => Math.ceil(fleet[m].total / UNIT))
  const fleetColorFn = (idx) => {
    let acc = 0
    for (let i = 0; i < modeOrder.length; i++) {
      acc += modeDots[i]
      if (idx < acc) return MODE_META[modeOrder[i]].color
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
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: MODE_META[m].color }} />
              <span style={{ fontSize: 11, color: '#6E6E73' }}>{MODE_META[m].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChargingChart() {
  const modes  = Object.keys(MODE_META)
  const maxVal = Math.max(...modes.map(m => fleet[m].charging))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {modes.map(mode => {
        const { label, color } = MODE_META[mode]
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
    { label: 'D_transport (net)',    value: fmt(D_transport),       sub: `−${reduction_pct}% vs D_total`, color: '#0A7E45' },
    { label: 'Total fleet',          value: fmt(total_fleet),       sub: 'all modes · peak',           color: '#0071E3' },
    { label: 'Cars replaced',        value: fmt(CARS_REPLACED),     sub: 'baseline private cars/day',  color: '#E63946' },
    { label: 'Replacement ratio',    value: `1 : ${replacement_ratio}`, sub: 'shared → private cars', color: '#7C3AED' },
    { label: 'Total charging pts',   value: fmt(total_charging),    sub: 'simultaneous',               color: '#8E44AD' },
    { label: 'Walking filtered',     value: `${(WALKING_SHARE_INTERNAL*100).toFixed(0)}%`, sub: 'of internal trips · not transported', color: '#2D6A4F' },
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
  const rows = Object.entries(MODE_META).map(([mode, { label }]) => ({ mode, label, ...fleet[mode] }))
  const cols = [
    { key: 'label',     head: 'Mode',              align: 'left'  },
    { key: 'trips',     head: 'Trips/day',          align: 'right' },
    { key: 'peak_hour', head: 'Peak hour',          align: 'right' },
    { key: 'on_street', head: 'On-street (peak)',   align: 'right' },
    { key: 'total',     head: 'Fleet total',        align: 'right' },
    { key: 'charging',  head: 'Charging pts',       align: 'right' },
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
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: MODE_META[row.mode].color, flexShrink: 0 }} />
                  <span style={{ color: '#1D1D1F', fontWeight: 500 }}>{row.label}</span>
                </div>
              </td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.trips)}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#6E6E73', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.peak_hour)}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{row.on_street}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: MODE_META[row.mode].color, fontVariantNumeric: 'tabular-nums' }}>{row.total}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{row.charging}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── HUB COMPONENTS ──────────────────────────────────────────────────────────
function HubSummaryGrid() {
  const cards = [
    { label: 'Hub L', value: hub_l_count, sub: 'large interchange hubs',  color: HUB_COLORS_UI.hub_l },
    { label: 'Hub M', value: hub_m_count, sub: 'district mobility hubs',   color: HUB_COLORS_UI.hub_m },
    { label: 'Hub S', value: hub_s_count, sub: 'neighbourhood micro-hubs', color: HUB_COLORS_UI.hub_s },
    { label: 'Total Charging', value: fmt(hub_total_charging), sub: 'charging points (all hubs)', color: '#2980B9', raw: true },
    { label: 'Hub Footprint',  value: fmt(hub_total_footprint), sub: `m²  (${hub_footprint_pct}% of zone)`, color: '#E67E22', raw: true },
    { label: 'Total Fleet',    value: fmt(total_fleet), sub: 'vehicles + bikes', color: '#8E44AD', raw: true },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {cards.map(({ label, value, sub, color, raw }) => (
        <div key={label} style={{
          background: '#fff', borderRadius: 14, padding: '16px 18px',
          border: `1px solid ${color}22`,
          borderTop: `3px solid ${color}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 26, fontWeight: 300, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {raw ? value : value}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginTop: 6 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>
  )
}

function HubHeatmapChart() {
  const modes = Object.keys(MODE_META)
  const allVals = TIERS.flatMap(t => modes.map(m => fleet_per_hub[t][m] || 0))
  const maxVal  = Math.max(...allVals)

  const cellColor = (val) => {
    if (val === 0) return '#F5F5F7'
    const ratio = val / maxVal
    // interpolate white → #2D6A4F
    const r = Math.round(255 + (45  - 255) * ratio)
    const g = Math.round(255 + (106 - 255) * ratio)
    const b = Math.round(255 + (79  - 255) * ratio)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 120, textAlign: 'left', fontSize: 11, color: '#AEAEB2', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '0 8px 8px' }} />
            {TIERS.map(t => (
              <th key={t} style={{
                textAlign: 'center', fontSize: 12, fontWeight: 700,
                color: HUB_COLORS_UI[t], padding: '0 0 8px',
                letterSpacing: '-0.01em',
              }}>
                {HUB_LABELS_UI[t]}<br />
                <span style={{ fontWeight: 400, color: '#AEAEB2', fontSize: 10 }}>{HUB_COUNTS[t]} hubs</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modes.map(mode => (
            <tr key={mode}>
              <td style={{ fontSize: 12, color: '#1D1D1F', padding: '0 8px 0 0', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_META[mode].color, flexShrink: 0 }} />
                  {MODE_META[mode].label}
                </div>
              </td>
              {TIERS.map(t => {
                const val = fleet_per_hub[t][mode] || 0
                const bg  = cellColor(val)
                const isDark = val / maxVal > 0.5
                return (
                  <td key={t} style={{
                    textAlign: 'center', padding: '10px 6px',
                    background: bg, borderRadius: 8,
                    fontSize: 14, fontWeight: 700,
                    color: isDark ? '#fff' : (val > 0 ? '#1A1A1A' : '#AEAEB2'),
                    minWidth: 80,
                  }}>
                    {val > 0 ? val : '–'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 10 }}>Units per single hub · incl. 20% reserve</div>
    </div>
  )
}

function HubStackedBarChart() {
  const modes = Object.keys(MODE_META)
  const tierTotals = TIERS.map(t => modes.reduce((s, m) => s + (fleet_at_tier[t][m] || 0), 0))
  const maxTotal   = Math.max(...tierTotals)
  const BAR_H = 180

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      {TIERS.map((tier, ti) => {
        const total = tierTotals[ti]
        const barH  = Math.round((total / maxTotal) * BAR_H)
        let offset  = 0
        return (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            {/* Bar */}
            <div style={{ height: BAR_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%' }}>
              <div style={{ height: barH, width: '100%', borderRadius: '8px 8px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                {modes.map(mode => {
                  const val = fleet_at_tier[tier][mode] || 0
                  if (val === 0) return null
                  const segH = (val / total) * barH
                  return (
                    <div key={mode} title={`${MODE_META[mode].label}: ${val}`} style={{
                      height: segH, background: MODE_META[mode].color, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {segH > 20 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{val}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            {/* X label */}
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</div>
              <div style={{ fontSize: 11, color: '#6E6E73' }}>{HUB_COUNTS[tier]} hubs · {fmt(total)} total</div>
            </div>
          </div>
        )
      })}
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 40 }}>
        {modes.map(mode => (
          <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, background: MODE_META[mode].color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#3D3D3F' }}>{MODE_META[mode].label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const HUB_CARD_MODES = {
  hub_l: ['car_sharing_ev', 'autonomous_bus', 'autonomous_shuttle', 'autonomous_pod'],
  hub_m: ['autonomous_shuttle', 'autonomous_pod', 'e_bike'],
  hub_s: ['e_bike', 'autonomous_pod'],
}
const HUB_CARD_DESC = {
  hub_l: 'Large interchange hub · parking garage / transit node',
  hub_m: 'District mobility hub · street-level, covered',
  hub_s: 'Neighbourhood micro-hub · on-street docking',
}

function HubProfileCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {TIERS.map(tier => {
        const color = HUB_COLORS_UI[tier]
        const cardModes = HUB_CARD_MODES[tier]
        return (
          <div key={tier} style={{
            background: '#fff', borderRadius: 16,
            border: `1.5px solid ${color}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ background: color, padding: '14px 18px' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                {HUB_LABELS_UI[tier]}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                {HUB_COUNTS[tier]} hubs
              </div>
            </div>
            {/* Description */}
            <div style={{ padding: '12px 18px 0', fontSize: 11, color: '#6E6E73', lineHeight: 1.5 }}>
              {HUB_CARD_DESC[tier]}
            </div>
            {/* Fleet rows */}
            <div style={{ padding: '12px 18px' }}>
              {cardModes.map(mode => {
                const qty = fleet_per_hub[tier][mode] || 0
                if (qty === 0) return null
                return (
                  <div key={mode} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_META[mode].color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#1D1D1F' }}>{MODE_META[mode].label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>{qty}</span>
                  </div>
                )
              })}
              {/* Infrastructure */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                {[
                  { label: 'Charging points', value: hub_charging_per[tier] },
                  { label: 'Footprint',        value: `${hub_footprint_per[tier].toLocaleString('de-DE')} m²` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontSize: 12, color: '#6E6E73' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HubInfraTable() {
  const modes = Object.keys(MODE_META)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E8ED' }}>
            <th style={{ textAlign: 'left',  padding: '8px 10px', fontWeight: 600, color: '#6E6E73', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Mode</th>
            {TIERS.map(t => (
              <th key={t} colSpan={2} style={{
                textAlign: 'center', padding: '8px 6px',
                fontWeight: 700, color: HUB_COLORS_UI[t], fontSize: 11,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                borderLeft: '1px solid #E8E8ED',
              }}>
                {HUB_LABELS_UI[t]} ({HUB_COUNTS[t]} hubs)
              </th>
            ))}
          </tr>
          <tr style={{ borderBottom: '1px solid #E8E8ED', background: 'rgba(0,0,0,0.02)' }}>
            <th style={{ padding: '5px 10px' }} />
            {TIERS.map(t => [
              <th key={`${t}-total`} style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: '#6E6E73', fontWeight: 600, borderLeft: '1px solid #E8E8ED' }}>Tier total</th>,
              <th key={`${t}-hub`}   style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: '#6E6E73', fontWeight: 600 }}>Per hub</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {modes.map((mode, i) => (
            <tr key={mode} style={{ background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
              <td style={{ padding: '9px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: MODE_META[mode].color, flexShrink: 0 }} />
                  <span style={{ color: '#1D1D1F', fontWeight: 500 }}>{MODE_META[mode].label}</span>
                </div>
              </td>
              {TIERS.map(t => [
                <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: '#6E6E73', borderLeft: '1px solid rgba(0,0,0,0.04)', fontVariantNumeric: 'tabular-nums' }}>
                  {fleet_at_tier[t][mode] || 0}
                </td>,
                <td key={`${t}-hub`} style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: fleet_per_hub[t][mode] > 0 ? HUB_COLORS_UI[t] : '#AEAEB2', fontVariantNumeric: 'tabular-nums' }}>
                  {fleet_per_hub[t][mode] > 0 ? fleet_per_hub[t][mode] : '–'}
                </td>,
              ])}
            </tr>
          ))}
          {/* Charging row */}
          <tr style={{ borderTop: '2px solid #E8E8ED', background: 'rgba(41,128,185,0.04)' }}>
            <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 600, color: '#2980B9' }}>Charging pts / hub</td>
            {TIERS.map(t => [
              <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: '#AEAEB2', borderLeft: '1px solid rgba(0,0,0,0.04)' }}>–</td>,
              <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: '#2980B9' }}>{hub_charging_per[t]}</td>,
            ])}
          </tr>
          {/* Footprint row */}
          <tr style={{ background: 'rgba(230,126,34,0.04)' }}>
            <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 600, color: '#E67E22' }}>Footprint / hub (m²)</td>
            {TIERS.map(t => [
              <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: '#AEAEB2', borderLeft: '1px solid rgba(0,0,0,0.04)' }}>–</td>,
              <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: '#E67E22' }}>{fmt(hub_footprint_per[t])}</td>,
            ])}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── HUB AREA COMPONENTS ─────────────────────────────────────────────────────
const COMP_COLORS_AREA = {
  S_fleet_area:    '#2D6A4F',
  S_circ_area:     '#52A882',
  S_charging_area: '#2980B9',
  S_program_area:  '#BDC3C7',
}
const COMP_LABELS_AREA = {
  S_fleet_area:    'Fleet parking',
  S_circ_area:     'Circulation',
  S_charging_area: 'Charging stations',
  S_program_area:  'Program / shelter',
}
const COMP_KEYS_AREA = ['S_fleet_area', 'S_circ_area', 'S_charging_area', 'S_program_area']
const AREA_MAPS = { S_fleet_area, S_circ_area, S_charging_area, S_program_area }

function HubAreaSummaryGrid() {
  const cards = [
    { label: 'Hub L area',       value: `${Math.round(S_hub_area.hub_l)} m²`,   sub: `per hub · ${hub_l_count} hubs`,    color: HUB_COLORS_UI.hub_l },
    { label: 'Hub M area',       value: `${Math.round(S_hub_area.hub_m)} m²`,   sub: `per hub · ${hub_m_count} hubs`,    color: HUB_COLORS_UI.hub_m },
    { label: 'Hub S area',       value: `${Math.round(S_hub_area.hub_s)} m²`,   sub: `per hub · ${hub_s_count} hubs`,    color: HUB_COLORS_UI.hub_s },
    { label: 'Total footprint',  value: `${fmt(area_total_all_hubs)} m²`,        sub: `${area_pct_of_zone}% of 4 km² zone`, color: '#E67E22' },
    { label: '≈ hectares',       value: `${(area_total_all_hubs/10000).toFixed(2)} ha`,  sub: 'combined hub land use',     color: '#7C3AED' },
    { label: 'Circulation share',value: `${Math.round((CIRCULATION_FACTOR.hub_l-1)*100)}–${Math.round((CIRCULATION_FACTOR.hub_s-1)*100)}%`, sub: 'of fleet area (by tier)', color: '#2980B9' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {cards.map(({ label, value, sub, color }) => (
        <div key={label} style={{
          background: '#fff', borderRadius: 14, padding: '16px 18px',
          border: `1px solid ${color}22`, borderTop: `3px solid ${color}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 300, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginTop: 6 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>
  )
}

function HubAreaBreakdownBars() {
  const maxTotal = Math.max(...TIERS.map(t => S_hub_area[t]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {TIERS.map(tier => {
        const total = S_hub_area[tier]
        let left = 0
        return (
          <div key={tier}>
            {/* Label row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: HUB_COLORS_UI[tier] }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</span>
                <span style={{ fontSize: 11, color: '#AEAEB2' }}>{HUB_COUNTS[tier]} hubs · {fmt(S_hub_area[tier] * HUB_COUNTS[tier])} m² total</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F' }}>{Math.round(total)} m²</span>
            </div>
            {/* Stacked bar */}
            <div style={{ height: 22, display: 'flex', borderRadius: 6, overflow: 'hidden', background: '#F5F5F7' }}>
              {COMP_KEYS_AREA.map(ck => {
                const val = AREA_MAPS[ck][tier]
                const pct = (val / total) * 100
                return (
                  <div key={ck} title={`${COMP_LABELS_AREA[ck]}: ${Math.round(val)} m²`} style={{
                    width: `${pct}%`, background: COMP_COLORS_AREA[ck],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {pct > 8 && <span style={{ fontSize: 9, fontWeight: 700, color: 'white' }}>{Math.round(val)}</span>}
                  </div>
                )
              })}
            </div>
            {/* Sub-breakdown text */}
            <div style={{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap' }}>
              {COMP_KEYS_AREA.map(ck => (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, background: COMP_COLORS_AREA[ck], borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: '#6E6E73' }}>{COMP_LABELS_AREA[ck]}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#3D3D3F' }}>{Math.round(AREA_MAPS[ck][tier])} m²</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {/* Legend */}
      <div style={{ marginTop: 4, padding: '12px 16px', background: 'rgba(230,126,34,0.06)', borderRadius: 10, border: '1px solid rgba(230,126,34,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>All hubs combined</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#E67E22' }}>{fmt(area_total_all_hubs)} m²</div>
            <div style={{ fontSize: 11, color: '#AEAEB2' }}>{area_pct_of_zone}% of zone · {(area_total_all_hubs/10000).toFixed(2)} ha</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HubAreaFleetDonut() {
  const modes = Object.keys(MODE_META)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {TIERS.map(tier => {
        const modeAreas = modes.map(m => ({
          mode: m, val: (fleet_per_hub[tier][m] || 0) * FOOTPRINT_PER_UNIT[m],
        })).filter(x => x.val > 0)
        const total = modeAreas.reduce((s, x) => s + x.val, 0)
        if (total === 0) return (
          <div key={tier} style={{ textAlign: 'center', padding: 20, color: '#AEAEB2', fontSize: 12 }}>
            {HUB_LABELS_UI[tier]}<br />no fleet area
          </div>
        )
        // SVG donut
        const R = 52, r = 32, cx = 68, cy = 68
        let angle = -Math.PI / 2
        const paths = []
        modeAreas.forEach(({ mode, val }) => {
          const sweep = (val / total) * 2 * Math.PI
          const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle)
          const x2 = cx + R * Math.cos(angle + sweep), y2 = cy + R * Math.sin(angle + sweep)
          const xi1 = cx + r * Math.cos(angle), yi1 = cy + r * Math.sin(angle)
          const xi2 = cx + r * Math.cos(angle + sweep), yi2 = cy + r * Math.sin(angle + sweep)
          const large = sweep > Math.PI ? 1 : 0
          paths.push(
            <path key={mode}
              d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z`}
              fill={MODE_META[mode].color} stroke="white" strokeWidth={1.5}
            />
          )
          angle += sweep
        })
        return (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[tier], marginBottom: 6 }}>
              {HUB_LABELS_UI[tier]}
            </div>
            <svg width={136} height={136} style={{ overflow: 'visible' }}>
              {paths}
              <text x={cx} y={cy-6} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1D1D1F">
                {Math.round(total)}
              </text>
              <text x={cx} y={cy+9} textAnchor="middle" fontSize={9} fill="#AEAEB2">m² fleet</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '0 8px' }}>
              {modeAreas.map(({ mode, val }) => (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color }} />
                    <span style={{ fontSize: 11, color: '#6E6E73' }}>{MODE_META[mode].label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F' }}>{Math.round(val)} m²</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HubAreaTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E8ED' }}>
            {['Component', 'Hub L', 'Hub M', 'Hub S', 'Formula'].map((h, i) => (
              <th key={h} style={{
                textAlign: i === 0 || i === 4 ? 'left' : 'right',
                padding: '8px 10px', fontWeight: 600, color: '#6E6E73', fontSize: 11,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'S_fleet',    keys: 'S_fleet_area',    formula: 'Σ(units × m²/unit)',          accent: false },
            { label: 'S_circ',     keys: 'S_circ_area',     formula: 'S_fleet × (factor − 1)',       accent: false },
            { label: 'S_charging', keys: 'S_charging_area', formula: 'Σ(chargers × station m²)',     accent: false },
            { label: 'S_program',  keys: 'S_program_area',  formula: '10% of (fleet+circ+charging)', accent: false },
            { label: 'S_hub TOTAL', keys: 'S_hub_area',     formula: 'Sum of all components',        accent: true  },
          ].map(({ label, keys, formula, accent }) => {
            const map = { S_fleet_area, S_circ_area, S_charging_area, S_program_area, S_hub_area }
            const vals = map[keys]
            return (
              <tr key={label} style={{ background: accent ? 'rgba(10,126,69,0.05)' : 'transparent', borderTop: accent ? '2px solid #E8E8ED' : undefined }}>
                <td style={{ padding: '9px 10px', fontWeight: accent ? 700 : 500, color: accent ? '#0A7E45' : '#1D1D1F' }}>{label}</td>
                {TIERS.map(t => (
                  <td key={t} style={{ padding: '9px 10px', textAlign: 'right', fontWeight: accent ? 700 : 400, color: accent ? HUB_COLORS_UI[t] : '#3D3D3F', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(vals[t])} m²
                  </td>
                ))}
                <td style={{ padding: '9px 10px', color: '#AEAEB2', fontSize: 11 }}>{formula}</td>
              </tr>
            )
          })}
          {/* Circulation factors row */}
          <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
            <td style={{ padding: '9px 10px', color: '#6E6E73', fontSize: 12 }}>Circulation factor</td>
            {TIERS.map(t => (
              <td key={t} style={{ padding: '9px 10px', textAlign: 'right', color: '#6E6E73', fontSize: 12 }}>× {CIRCULATION_FACTOR[t]}</td>
            ))}
            <td style={{ padding: '9px 10px', color: '#AEAEB2', fontSize: 11 }}>driveways + maneuvering</td>
          </tr>
          {/* Per-hub × count row */}
          <tr style={{ borderTop: '1px solid #E8E8ED' }}>
            <td style={{ padding: '9px 10px', fontWeight: 600, color: '#1D1D1F' }}>All hubs (× count)</td>
            {TIERS.map(t => (
              <td key={t} style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(S_hub_area[t] * HUB_COUNTS[t])} m²
              </td>
            ))}
            <td style={{ padding: '9px 10px', color: '#AEAEB2', fontSize: 11 }}>S_hub × hub count</td>
          </tr>
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
  { href: '#flow',         label: 'Trip flow' },
  { href: '#fleet-cards',  label: 'Mode cards' },
  { href: '#fleet-chart',  label: 'On-street vs total' },
  { href: '#replacement',  label: 'Replacement' },
  { href: '#dot-matrix',   label: 'Dot matrix' },
  { href: '#charging',     label: 'Charging points' },
  { href: '#fleet-tbl',    label: 'Fleet table' },
  { href: '#hubs',         label: '— Hub Network' },
  { href: '#hub-summary',  label: 'Hub summary' },
  { href: '#hub-heatmap',  label: 'Fleet heatmap' },
  { href: '#hub-bars',     label: 'Fleet by tier' },
  { href: '#hub-cards',    label: 'Hub profiles' },
  { href: '#hub-infra',    label: 'Infrastructure' },
  { href: '#hub-area',     label: '— Hub Areas' },
  { href: '#hub-area-sum', label: 'Area summary' },
  { href: '#hub-area-bar', label: 'Area breakdown' },
  { href: '#hub-area-pie', label: 'Fleet footprint' },
  { href: '#hub-area-tbl', label: 'Area table' },
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

        <div id="flow" style={{ marginBottom: 16 }}>
          <SectionBlock title="Trip Flow Decomposition" subtitle="D_total → inbound / internal transport / walking · modal split by flow type" accent="#2980B9">
            <FlowDecompositionChart />
          </SectionBlock>
        </div>

        <div id="fleet-cards" style={{ marginBottom: 16 }}>
          <SectionBlock title="Fleet by Mode" subtitle="On-street peak · total with reserve · trips/day · charging points" accent="#0A7E45">
            <FleetModeCards />
          </SectionBlock>
        </div>

        <div id="fleet-chart" style={{ marginBottom: 16 }}>
          <SectionBlock title="On-street Peak vs Total Fleet" subtitle="On-street = (peak trips / capacity) × duration · Total = on-street × peak factor" accent="#27AE60">
            <FleetOnStreetVsTotalChart />
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

        {/* ── PART 3: HUB NETWORK ── */}
        <Divider label="Part 3 · Hub Network" />

        <div id="hubs" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Part 3 · Hub Network
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
            Hub Count &amp; Fleet Distribution
          </h2>
          <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 6, lineHeight: 1.5 }}>
            {hub_l_count} large · {hub_m_count} district · {hub_s_count} micro-hubs · zone {ZONE_AREA_KM2} km²
          </p>
        </div>

        <div id="hub-summary" style={{ marginBottom: 20, marginTop: 20 }}>
          <HubSummaryGrid />
        </div>

        <div id="hub-heatmap" style={{ marginBottom: 16 }}>
          <SectionBlock title="Fleet per Hub — Heatmap" subtitle="Units on a single hub · incl. 20% reserve · darker = more vehicles" accent="#2D6A4F">
            <HubHeatmapChart />
          </SectionBlock>
        </div>

        <div id="hub-bars" style={{ marginBottom: 16 }}>
          <SectionBlock title="Total Fleet by Hub Tier" subtitle="All vehicles assigned to each tier · stacked by mode" accent="#1A1A1A">
            <HubStackedBarChart />
          </SectionBlock>
        </div>

        <div id="hub-cards" style={{ marginBottom: 16 }}>
          <SectionBlock title="Hub Profile Cards" subtitle="Vehicle mix, charging points and footprint per single hub" accent="#95B8A0">
            <HubProfileCards />
          </SectionBlock>
        </div>

        <div id="hub-infra" style={{ marginBottom: 16 }}>
          <SectionBlock title="Infrastructure Table" subtitle="Tier total · per-hub allocation · charging points · footprint" accent="#E67E22">
            <HubInfraTable />
          </SectionBlock>
        </div>

        {/* ── PART 4: HUB AREAS ── */}
        <Divider label="Part 4 · Hub Area Calculation" />

        <div id="hub-area" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Part 4 · Hub Area Calculation
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
            S_hub = S_fleet + S_circ + S_charging + S_program
          </h2>
          <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 6, lineHeight: 1.5 }}>
            {fmt(area_total_all_hubs)} m² total · {area_pct_of_zone}% of zone · {(area_total_all_hubs/10000).toFixed(2)} ha
          </p>
        </div>

        <div id="hub-area-sum" style={{ marginBottom: 20, marginTop: 20 }}>
          <HubAreaSummaryGrid />
        </div>

        <div id="hub-area-bar" style={{ marginBottom: 16 }}>
          <SectionBlock title="Area Breakdown per Hub" subtitle="S_fleet · circulation · charging · program — hover bars for values" accent="#2D6A4F">
            <HubAreaBreakdownBars />
          </SectionBlock>
        </div>

        <div id="hub-area-pie" style={{ marginBottom: 16 }}>
          <SectionBlock title="Fleet Parking Area by Mode" subtitle="How S_fleet is distributed across vehicle types per hub tier" accent="#8E44AD">
            <HubAreaFleetDonut />
          </SectionBlock>
        </div>

        <div id="hub-area-tbl" style={{ marginBottom: 16 }}>
          <SectionBlock title="Hub Area Table" subtitle="Full breakdown · circulation factors · per-hub × total area" accent="#E67E22">
            <HubAreaTable />
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
            Nextbike operational data · UITP autonomous shuttle &amp; bus benchmarks · MOIA Hamburg analogue · Share Now / Stadtmobil data<br />
            <strong style={{ color: '#6E6E73' }}>Hub geometry:</strong>{' '}
            Coverage radius 200m (S) / 400m (M) · 1.35× overlap · max 6 Hub L (parking garages)<br />
            <strong style={{ color: '#6E6E73' }}>Hub area:</strong>{' '}
            Footprint per unit + circulation factor + charging stations + 10% program<br />
            Python scripts:{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>analysis/modal_distribution.py</code>{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>analysis/fleet_calculation.py</code>{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>analysis/hub_calculation.py</code>{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>analysis/hub_area.py</code>
          </p>
        </div>

      </div>
    </div>
  )
}
