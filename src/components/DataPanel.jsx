import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'

// ─── BASELINE ─────────────────────────────────────────────────────────────────
const DISTRICT_POP = {
  'Stadtmitte': 2800, 'Schillerteich': 2100, 'Hellwinkel': 1900,
  'Heßlingen': 2200, 'Rothenfelde': 1800, 'Köhlerberg': 1400,
  'Alt-Wolfsburg': 2600, 'Sandkamp': 1100, 'Hochenstein': 1500,
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
const HOUR_SUM   = HOUR_RAW.reduce((a, b) => a + b, 0)
const HOUR_SHARE = HOUR_RAW.map(s => s / HOUR_SUM)

const total_residents      = Object.values(DISTRICT_POP).reduce((a, b) => a + b, 0)
const visitors             = (total_residents + WORKERS) * VISITOR_SHARE
const D_total              = total_residents * T_RESIDENT + WORKERS * T_WORKER + visitors * T_VISITOR
const D_internal           = D_total * 0.65
const car_trips            = D_total * MODAL.private_car.share
const transit_trips        = D_total * MODAL.public_transit.share
const walk_trips           = D_total * MODAL.walking.share
const cycling_trips        = D_total * MODAL.cycling.share
const car_vehicles_per_day = car_trips / CAR_OCCUPANCY
const peak_hour_trips      = Math.round(D_total * HOUR_SHARE[8])

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

// ─── FLEET v2 ─────────────────────────────────────────────────────────────────
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

const inbound_worker_trips   = WORKERS * T_WORKER * 0.50
const inbound_visitor_trips  = visitors * T_VISITOR * 0.80
const inbound_trips          = inbound_worker_trips + inbound_visitor_trips
const resident_trips         = total_residents * T_RESIDENT
const internal_worker_trips  = WORKERS * T_WORKER * 0.50
const internal_visitor_trips = visitors * T_VISITOR * 0.20
const internal_other_trips   = internal_worker_trips + internal_visitor_trips
const all_internal_trips     = resident_trips + internal_other_trips
const WALKING_SHARE_INTERNAL = 0.60
const transport_internal     = all_internal_trips * (1 - WALKING_SHARE_INTERNAL)
const walking_filtered       = all_internal_trips * WALKING_SHARE_INTERNAL
const D_transport            = inbound_trips + transport_internal
const reduction_pct          = ((D_total - D_transport) / D_total * 100).toFixed(1)

const INBOUND_MODAL  = { autonomous_bus: 0.35, autonomous_shuttle: 0.25, car_sharing_ev: 0.25, autonomous_pod: 0.15 }
const INTERNAL_MODAL = { e_bike: 0.45, autonomous_pod: 0.35, autonomous_shuttle: 0.20 }

const trips_by_mode = {}
for (const [m, s] of Object.entries(INBOUND_MODAL))
  trips_by_mode[m] = (trips_by_mode[m] || 0) + inbound_trips * s
for (const [m, s] of Object.entries(INTERNAL_MODAL))
  trips_by_mode[m] = (trips_by_mode[m] || 0) + transport_internal * s

const mode_shares        = Object.fromEntries(Object.entries(trips_by_mode).map(([m, t]) => [m, t / D_transport]))
const peak_trips_by_mode = Object.fromEntries(Object.entries(mode_shares).map(([m, s]) => [m, peak_hour_trips * s]))

const fleet = {}
for (const mode of Object.keys(MODE_META)) {
  const p = FLEET_PARAMS[mode]
  const pt = peak_trips_by_mode[mode] || 0
  const on_street = ceil((pt / p.capacity) * p.trip_h)
  const fleet_total_mode = ceil(on_street * p.peak_factor)
  const charging = mode === 'e_bike' ? ceil(fleet_total_mode * 0.50) : ceil(fleet_total_mode * 0.30)
  fleet[mode] = {
    trips: trips_by_mode[mode] || 0, peak_hour: pt, on_street,
    total: fleet_total_mode, charging,
    inbound: inbound_trips * (INBOUND_MODAL[mode] || 0),
    internal: transport_internal * (INTERNAL_MODAL[mode] || 0),
  }
}

const total_fleet     = Object.values(fleet).reduce((s, f) => s + f.total, 0)
const total_charging  = Object.values(fleet).reduce((s, f) => s + f.charging, 0)
const total_on_street = Object.values(fleet).reduce((s, f) => s + f.on_street, 0)
const replacement_ratio = (CARS_REPLACED / total_fleet).toFixed(1)

// ─── HUB NETWORK ─────────────────────────────────────────────────────────────
const HUB_S_RADIUS = 200
const HUB_M_RADIUS = 400
const hub_zone_m2  = ZONE_AREA_KM2 * 1_000_000

const hub_s_area       = Math.PI * HUB_S_RADIUS ** 2
const hub_s_count      = ceil((hub_zone_m2 / hub_s_area) * 1.35)
const hub_m_area          = Math.PI * HUB_M_RADIUS ** 2
const hub_m_from_geometry = ceil((hub_zone_m2 / hub_m_area) * 1.35)
const hub_m_from_shuttle  = ceil(fleet.autonomous_shuttle.total / 3)
const hub_m_count         = Math.max(hub_m_from_geometry, hub_m_from_shuttle)
const hub_l_from_fleet    = ceil((fleet.autonomous_bus.total + fleet.car_sharing_ev.total) / 8)
const hub_l_count         = Math.min(Math.max(hub_l_from_fleet, 3), 6)

const HUB_COUNTS    = { hub_l: hub_l_count, hub_m: hub_m_count, hub_s: hub_s_count }
const HUB_COLORS_UI = { hub_l: '#1A1A1A', hub_m: '#2D6A4F', hub_s: '#95B8A0' }
const HUB_LABELS_UI = { hub_l: 'Hub L', hub_m: 'Hub M', hub_s: 'Hub S' }
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

// ─── HUB AREA ─────────────────────────────────────────────────────────────────
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
    return sum + chargers * (mode === 'e_bike' ? CHARGING_FP_M2.e_bike : CHARGING_FP_M2.other)
  }, 0)
  const sub = S_fleet_area[tier] + S_circ_area[tier] + S_charging_area[tier]
  S_program_area[tier] = sub * PROGRAM_SHARE_AREA
  S_hub_area[tier] = sub + S_program_area[tier]
}

const area_total_all_hubs = TIERS.reduce((s, t) => s + S_hub_area[t] * HUB_COUNTS[t], 0)
const area_pct_of_zone    = (area_total_all_hubs / hub_zone_m2 * 100).toFixed(2)

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const SANS  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SERIF = SANS
const C = { bg: '#FFFFFF', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }
const fmt = n => Math.round(n).toLocaleString('de-DE')

const CSS_ANIM = `
.dp-a{opacity:0;transform:translateY(22px);transition:opacity 700ms cubic-bezier(.4,0,.2,1),transform 700ms cubic-bezier(.4,0,.2,1)}
.dp-a.dp-v{opacity:1;transform:translateY(0)}
.dp-bh{transform:scaleX(0);transform-origin:left center;transition:transform 850ms cubic-bezier(.4,0,.2,1)}
.dp-a.dp-v .dp-bh{transform:scaleX(1)}
.dp-bv{transform:scaleY(0);transform-origin:bottom center;transition:transform 850ms cubic-bezier(.4,0,.2,1)}
.dp-a.dp-v .dp-bv{transform:scaleY(1)}
`

// ─── BASE COMPONENTS ─────────────────────────────────────────────────────────
function Sect({ id, eyebrow, title, children }) {
  return (
    <div id={id} className="dp-a" style={{ padding: '44px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 520, marginBottom: 28 }}>
        {eyebrow && <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{eyebrow}</div>}
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: C.text1, margin: 0, lineHeight: 1.35 }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function KCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, borderRadius: 0, padding: '20px 22px', border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: color || C.text1, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1, marginTop: 8 }}>{label}</div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function Rule({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '56px 0 44px' }}>
      <div style={{ width: 28, height: 2, background: C.text1 }} />
      <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

function DataTable({ head, rows, renderRow }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            {head.map(({ label, align }) => (
              <th key={label} style={{ textAlign: align || 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((row, i) => renderRow(row, i))}</tbody>
      </table>
    </div>
  )
}

// ─── PART 1 CHARTS ────────────────────────────────────────────────────────────
function ModalShareChart() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {Object.entries(MODAL).map(([key, { share, label, color }], i) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{label}</span>
            <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color }}>{(share * 100).toFixed(0)}%</span>
          </div>
          <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(share / 0.62) * 100}%`, height: '100%', background: color, borderRadius: 4, transitionDelay: `${i * 80}ms` }} />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 4 }}>{fmt(D_total * share)} trips/day</div>
        </div>
      ))}
    </div>
  )
}

function DistrictChart() {
  const maxPop = Math.max(...Object.values(DISTRICT_POP))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {Object.entries(DISTRICT_POP).sort(([, a], [, b]) => b - a).map(([name, pop], i) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: SANS, width: 112, fontSize: 13, color: C.text2, flexShrink: 0 }}>{name}</div>
          <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(pop / maxPop) * 100}%`, height: '100%', background: '#2980B9', borderRadius: 3, transitionDelay: `${i * 35}ms` }} />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, width: 44, textAlign: 'right', flexShrink: 0 }}>{pop.toLocaleString('de-DE')}</div>
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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
        {HOUR_SHARE.map((s, h) => (
          <div key={h} className="dp-bv" title={`${h}:00 — ${fmt(D_total * s)} trips`} style={{
            flex: 1, height: `${(s / maxS) * 100}%`,
            background: isPeak(h) ? '#E63946' : '#2980B9',
            borderRadius: '2px 2px 0 0', opacity: 0.82,
            transitionDelay: `${h * 18}ms`,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 5 }}>
        {[0, 4, 8, 12, 16, 20, 23].map(h => <span key={h} style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{h}h</span>)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[['#E63946', 'Peak (7–9h, 16–18h)'], ['#2980B9', 'Off-peak']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BaselineTable() {
  return (
    <DataTable
      head={[{ label: 'Metric' }, { label: 'Value', align: 'right' }, { label: 'Source' }]}
      rows={BASELINE_RESULTS}
      renderRow={({ metric, value, source }, i) => (
        <tr key={metric} style={{ borderBottom: `1px solid ${C.border}` }}>
          <td style={{ padding: '10px 10px', color: C.text2 }}>{metric}</td>
          <td style={{ padding: '10px 10px', color: C.text1, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</td>
          <td style={{ padding: '10px 10px', color: C.text3 }}>{source}</td>
        </tr>
      )}
    />
  )
}

// ─── PART 2 CHARTS ────────────────────────────────────────────────────────────
function FlowChart() {
  const flows = [
    { label: 'Inbound',            value: inbound_trips,      color: '#E63946', sub: 'cross-boundary workers & visitors' },
    { label: 'Internal transport', value: transport_internal, color: '#2980B9', sub: 'requires a vehicle' },
    { label: 'Walking (filtered)', value: walking_filtered,   color: C.border,  sub: '60% of internal — not transported' },
  ]
  const maxVal = D_total
  const maxT = Math.max(...Object.values(fleet).map(x => x.trips))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '14px 18px', background: C.text1, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, color: '#fff' }}>D_total</span>
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: '#E63946' }}>{fmt(D_total)} trips/day</span>
      </div>
      {flows.map(({ label, value, color, sub }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text1, fontWeight: 500 }}>{label}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginLeft: 8 }}>{sub}</span>
            </div>
            <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color }}>{fmt(value)}</span>
          </div>
          <div style={{ height: 9, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(value / maxVal) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <div style={{ padding: '14px 18px', background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: '#0A7E45' }}>D_transport (net)</span>
          <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginLeft: 8 }}>inbound + internal transport</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, color: '#0A7E45' }}>{fmt(D_transport)}</div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>−{reduction_pct}% vs D_total</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text3, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trips/day by mode</div>
        {Object.entries(MODE_META).map(([mode, { label, color }]) => {
          const f = fleet[mode]
          return (
            <div key={mode} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{label}</span>
                  {f.inbound > 0 && <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3, padding: '1px 6px', border: `1px solid ${C.border}` }}>inbound</span>}
                  {f.internal > 0 && <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3, padding: '1px 6px', border: `1px solid ${C.border}` }}>internal</span>}
                </div>
                <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color }}>{fmt(f.trips)}</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(f.inbound / maxT) * 100}%`, background: color, opacity: 0.35 }} />
                <div style={{ width: `${(f.internal / maxT) * 100}%`, background: color, opacity: 0.9 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModeCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      {Object.entries(MODE_META).map(([key, { label, color }]) => {
        const f = fleet[key]
        return (
          <div key={key} style={{ background: C.card, borderRadius: 0, padding: '16px 16px', border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
            <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: C.text1, letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(f.total)}</div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 2, marginBottom: 12 }}>total fleet</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[['On-street', f.on_street], ['Peak trips/h', f.peak_hour], ['Charging pts', f.charging]].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{lbl}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text2 }}>{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OnStreetChart() {
  const modes = Object.keys(MODE_META)
  const maxVal = Math.max(...modes.map(m => fleet[m].total))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {modes.map(mode => {
        const { label, color } = MODE_META[mode]
        const { on_street, total } = fleet[mode]
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{label}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>
                <span style={{ fontWeight: 700, color }}>{fmt(on_street)}</span>
                <span style={{ color: C.border }}> / </span>
                <span style={{ fontWeight: 700, color: C.text1 }}>{fmt(total)}</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 20 }}>
              <div style={{ position: 'absolute', inset: 0, background: C.border, borderRadius: 5 }} />
              <div className="dp-bh" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(total / maxVal) * 100}%`, background: color, opacity: 0.28, borderRadius: 5 }} />
              <div className="dp-bh" style={{ position: 'absolute', left: 0, top: 3, bottom: 3, width: `${(on_street / maxVal) * 100}%`, background: color, borderRadius: 4 }} />
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        {[['solid', 'On-street at peak hour'], ['transparent 28%', 'Total fleet (with reserve)']].map(([t, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 8, background: '#444', borderRadius: 2, opacity: t === 'solid' ? 1 : 0.28 }} />
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplacementChart() {
  const modes = Object.keys(MODE_META)
  const scaleMax = Math.max(CARS_REPLACED, total_fleet) * 1.1
  const BAR_W = 96
  const segments = modes.map(m => ({ mode: m, ...MODE_META[m], val: fleet[m].total }))
  return (
    <div style={{ display: 'flex', gap: 36, alignItems: 'flex-end' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Baseline</div>
        <div className="dp-bv" style={{ width: BAR_W, height: Math.round((CARS_REPLACED / scaleMax) * 260), background: '#E63946', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10 }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(CARS_REPLACED)}</span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: '#111111', fontWeight: 600, marginTop: 6 }}>Private cars</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Post-Car</div>
        <div className="dp-bv" style={{ width: BAR_W, height: Math.round((total_fleet / scaleMax) * 260), borderRadius: '6px 6px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
          {segments.map(({ mode, color, val }) => (
            <div key={mode} style={{ flex: val, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {val > 150 && <span style={{ fontFamily: SANS, fontSize: 13, color: '#fff', fontWeight: 600 }}>{fmt(val)}</span>}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.text1, fontWeight: 600, marginTop: 6 }}>Shared fleet</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{fmt(total_fleet)} units</div>
      </div>
      <div style={{ flex: 1, paddingBottom: 28 }}>
        <div style={{ padding: '14px 18px', background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 0, marginBottom: 16 }}>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: '#0A7E45', letterSpacing: '-0.02em' }}>1 : {replacement_ratio}</div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: '#2D6A4F', marginTop: 3 }}>shared vehicle replaces {replacement_ratio} private cars</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {segments.map(({ mode, color, label, val }) => (
            <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2, flex: 1 }}>{label}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1 }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DotMatrix() {
  const UNIT = 10, COLS = 60
  const carDots  = Math.ceil(CARS_REPLACED / UNIT)
  const fleetDots= Math.ceil(total_fleet / UNIT)
  const modeOrder = Object.keys(MODE_META)
  const modeDots  = modeOrder.map(m => Math.ceil(fleet[m].total / UNIT))
  const fleetColorFn = idx => {
    let acc = 0
    for (let i = 0; i < modeOrder.length; i++) { acc += modeDots[i]; if (idx < acc) return MODE_META[modeOrder[i]].color }
    return C.border
  }
  const renderDots = (count, colorFn) => {
    const rows = []
    for (let r = 0; r < Math.ceil(count / COLS); r++) {
      const cells = []
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c
        if (idx >= count) break
        cells.push(<div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: colorFn(idx), flexShrink: 0 }} />)
      }
      rows.push(<div key={r} style={{ display: 'flex', gap: 3 }}>{cells}</div>)
    }
    return rows
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 8 }}>
          Private Cars — {fmt(CARS_REPLACED)} <span style={{ fontWeight: 400, color: C.text3 }}>(each dot = {UNIT} vehicles)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(carDots, () => '#E63946')}</div>
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 8 }}>
          Post-Car Fleet — {fmt(total_fleet)} <span style={{ fontWeight: 400, color: C.text3 }}>(each dot = {UNIT} vehicles)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(fleetDots, fleetColorFn)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {modeOrder.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: MODE_META[m].color }} />
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{MODE_META[m].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChargingChart() {
  const modes = Object.keys(MODE_META)
  const maxVal = Math.max(...modes.map(m => fleet[m].charging))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {modes.map((mode, i) => {
        const { label, color } = MODE_META[mode]
        const val = fleet[mode].charging
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{label}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color }}>{fmt(val)} pts</span>
            </div>
            <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
              <div className="dp-bh" style={{ width: `${(val / maxVal) * 100}%`, height: '100%', background: color, borderRadius: 4, transitionDelay: `${i * 60}ms` }} />
            </div>
          </div>
        )
      })}
      <div style={{ marginTop: 8, padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1 }}>Total charging points</span>
        <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: '#0A7E45' }}>{fmt(total_charging)}</span>
      </div>
    </div>
  )
}

function FleetSummaryGrid() {
  const cards = [
    { label: 'D_transport (net)',  value: fmt(D_transport),                               sub: `−${reduction_pct}% vs D_total`,               color: '#0A7E45' },
    { label: 'Total fleet',        value: fmt(total_fleet),                                sub: 'all modes · peak hour',                        color: '#2980B9' },
    { label: 'Cars replaced',      value: fmt(CARS_REPLACED),                             sub: 'baseline private cars/day',                    color: '#E63946' },
    { label: 'Replacement ratio',  value: `1 : ${replacement_ratio}`,                    sub: 'shared vehicle → private cars',                color: '#8E44AD' },
    { label: 'Total charging pts', value: fmt(total_charging),                            sub: 'simultaneous',                                 color: '#E67E22' },
    { label: 'Walking filtered',   value: `${(WALKING_SHARE_INTERNAL * 100).toFixed(0)}%`, sub: 'internal trips not transported',              color: '#2D6A4F' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {cards.map(({ label, value, sub, color }) => <KCard key={label} label={label} value={value} sub={sub} color={color} />)}
    </div>
  )
}

function FleetTable() {
  const rows = Object.entries(MODE_META).map(([mode, { label }]) => ({ mode, label, ...fleet[mode] }))
  return (
    <DataTable
      head={[
        { label: 'Mode' }, { label: 'Trips/day', align: 'right' }, { label: 'Peak hour', align: 'right' },
        { label: 'On-street', align: 'right' }, { label: 'Fleet total', align: 'right' }, { label: 'Charging pts', align: 'right' },
      ]}
      rows={rows}
      renderRow={(row, i) => (
        <tr key={row.mode} style={{ borderBottom: `1px solid ${C.border}` }}>
          <td style={{ padding: '10px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_META[row.mode].color, flexShrink: 0 }} />
              <span style={{ color: C.text1, fontWeight: 500 }}>{row.label}</span>
            </div>
          </td>
          <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.trips)}</td>
          <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text3, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.peak_hour)}</td>
          <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{row.on_street}</td>
          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: MODE_META[row.mode].color, fontVariantNumeric: 'tabular-nums' }}>{row.total}</td>
          <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{row.charging}</td>
        </tr>
      )}
    />
  )
}

// ─── PART 3 CHARTS ────────────────────────────────────────────────────────────
function HubSummaryGrid() {
  const cards = [
    { label: 'Hub L — total area', value: `${fmt(Math.round(S_hub_area.hub_l * HUB_COUNTS.hub_l))} m²`, sub: 'multi-level parking garages (repurposed)', color: HUB_COLORS_UI.hub_l },
    { label: 'Hub M — total area', value: `${fmt(Math.round(S_hub_area.hub_m * HUB_COUNTS.hub_m))} m²`, sub: 'underground parking (repurposed)', color: HUB_COLORS_UI.hub_m },
    { label: 'Hub S — total area', value: `${fmt(Math.round(S_hub_area.hub_s * HUB_COUNTS.hub_s))} m²`, sub: 'on-street docking points', color: HUB_COLORS_UI.hub_s },
    { label: 'Combined footprint', value: `${fmt(area_total_all_hubs)} m²`, sub: `${area_pct_of_zone}% of zone · ${(area_total_all_hubs / 10000).toFixed(2)} ha`, color: '#E67E22' },
    { label: 'Total fleet', value: fmt(total_fleet), sub: 'vehicles + bikes (all tiers)', color: '#8E44AD' },
    { label: 'Fleet replacement', value: `1 : ${replacement_ratio}`, sub: `replaces ${fmt(CARS_REPLACED)} private cars/day`, color: '#0A7E45' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {cards.map(c => <KCard key={c.label} {...c} />)}
    </div>
  )
}

function HubHeatmap() {
  const modes = Object.keys(MODE_META)
  const allVals = TIERS.flatMap(t => modes.map(m => fleet_per_hub[t][m] || 0))
  const maxVal  = Math.max(...allVals)
  const cellColor = val => {
    if (val === 0) return '#F5F5F3'
    const r = val / maxVal
    return `rgb(${Math.round(255 + (45 - 255) * r)},${Math.round(255 + (106 - 255) * r)},${Math.round(255 + (79 - 255) * r)})`
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 120, textAlign: 'left', fontFamily: SANS, fontSize: 13, color: C.text3, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 8px 10px' }} />
            {TIERS.map(t => (
              <th key={t} style={{ textAlign: 'center', fontFamily: SANS, fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[t], padding: '0 0 10px', letterSpacing: '-0.01em' }}>
                {HUB_LABELS_UI[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modes.map(mode => (
            <tr key={mode}>
              <td style={{ fontFamily: SANS, fontSize: 13, color: C.text2, padding: '0 8px 0 0', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_META[mode].color }} />
                  {MODE_META[mode].label}
                </div>
              </td>
              {TIERS.map(t => {
                const val = fleet_per_hub[t][mode] || 0
                const bg  = cellColor(val)
                const dark = val / maxVal > 0.5
                return (
                  <td key={t} style={{ textAlign: 'center', padding: '10px 6px', background: bg, borderRadius: 0, fontFamily: SANS, fontSize: 14, fontWeight: 700, color: dark ? '#fff' : (val > 0 ? C.text1 : C.text3), minWidth: 80 }}>
                    {val > 0 ? val : '–'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 10 }}>Units per single hub · incl. 20% reserve</div>
    </div>
  )
}

function HubBars() {
  const modes = Object.keys(MODE_META)
  const tierTotals = TIERS.map(t => modes.reduce((s, m) => s + (fleet_at_tier[t][m] || 0), 0))
  const maxTotal   = Math.max(...tierTotals)
  const BAR_H = 180
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      {TIERS.map((tier, ti) => {
        const total = tierTotals[ti]
        const barH  = Math.round((total / maxTotal) * BAR_H)
        return (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ height: BAR_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%' }}>
              <div className="dp-bv" style={{ height: barH, width: '100%', borderRadius: '8px 8px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                {modes.map(mode => {
                  const val = fleet_at_tier[tier][mode] || 0
                  if (val === 0) return null
                  const segH = (val / total) * barH
                  return (
                    <div key={mode} title={`${MODE_META[mode].label}: ${val}`} style={{ height: segH, background: MODE_META[mode].color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {segH > 20 && <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: '#fff' }}>{val}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{fmt(total)} total fleet</div>
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 40 }}>
        {modes.map(mode => (
          <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, background: MODE_META[mode].color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{MODE_META[mode].label}</span>
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
  hub_l: 'Large interchange · multi-level parking garage',
  hub_m: 'District hub · underground parking',
  hub_s: 'Micro-hub · on-street docking point',
}
const HUB_CARD_SUSTAINABILITY = {
  hub_l: 'Adaptive reuse of existing multi-storey car parks — no new land required, structure repurposed as EV depot + transit node.',
  hub_m: 'Underground parking converted to shared-fleet depot — recovers street-level space, retains structural shell.',
  hub_s: 'Replaces on-street car parking bays — minimal construction, embedded in existing pavement.',
}

function HubCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {TIERS.map(tier => {
        const color = HUB_COLORS_UI[tier]
        const modes = Object.keys(MODE_META)
        const tierTotal = modes.reduce((s, m) => s + (fleet_at_tier[tier][m] || 0), 0)
        return (
          <div key={tier} style={{ background: C.card, borderRadius: 0, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: C.text1 }}>{HUB_LABELS_UI[tier]}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 5 }}>{HUB_CARD_DESC[tier]}</div>
            </div>
            <div style={{ padding: '14px 20px' }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Approximate vehicle mix</div>
              {HUB_CARD_MODES[tier].map(mode => {
                const total = fleet_at_tier[tier][mode] || 0
                if (total === 0) return null
                return (
                  <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color }} />
                      <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{MODE_META[mode].label}</span>
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1 }}>{fmt(total)}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0 6px', borderTop: `2px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1 }}>Total fleet (tier)</span>
                <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color }}>≈ {fmt(tierTotal)}</span>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#F8F8F6', borderRadius: 0, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: '#0A7E45', marginBottom: 4 }}>Sustainability approach</div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, lineHeight: 1.6 }}>{HUB_CARD_SUSTAINABILITY[tier]}</div>
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mode</th>
            {TIERS.map(t => (
              <th key={t} colSpan={2} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: HUB_COLORS_UI[t], fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', borderLeft: `1px solid ${C.border}` }}>
                {HUB_LABELS_UI[t]}
              </th>
            ))}
          </tr>
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FFFFFF' }}>
            <th style={{ padding: '5px 10px' }} />
            {TIERS.map(t => [
              <th key={`${t}-total`} style={{ textAlign: 'right', padding: '5px 6px', fontSize: 13, color: C.text3, fontWeight: 600, borderLeft: `1px solid ${C.border}` }}>Tier total</th>,
              <th key={`${t}-hub`}   style={{ textAlign: 'right', padding: '5px 6px', fontSize: 13, color: C.text3, fontWeight: 600 }}>Per hub</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {modes.map((mode, i) => (
            <tr key={mode} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '9px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_META[mode].color, flexShrink: 0 }} />
                  <span style={{ color: C.text1, fontWeight: 500 }}>{MODE_META[mode].label}</span>
                </div>
              </td>
              {TIERS.map(t => [
                <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: C.text3, borderLeft: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums' }}>{fleet_at_tier[t][mode] || 0}</td>,
                <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: fleet_per_hub[t][mode] > 0 ? HUB_COLORS_UI[t] : C.text3, fontVariantNumeric: 'tabular-nums' }}>{fleet_per_hub[t][mode] > 0 ? fleet_per_hub[t][mode] : '–'}</td>,
              ])}
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${C.border}`, background: '#FFFFFF' }}>
            <td style={{ padding: '9px 10px', fontWeight: 600, color: '#2980B9', fontSize: 13 }}>Charging pts / hub</td>
            {TIERS.map(t => [
              <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: C.text3, borderLeft: `1px solid ${C.border}` }}>–</td>,
              <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: '#2980B9' }}>{hub_charging_per[t]}</td>,
            ])}
          </tr>
          <tr style={{ background: '#FFFFFF' }}>
            <td style={{ padding: '9px 10px', fontWeight: 600, color: '#E67E22', fontSize: 13 }}>Footprint / hub (m²)</td>
            {TIERS.map(t => [
              <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: C.text3, borderLeft: `1px solid ${C.border}` }}>–</td>,
              <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: '#E67E22' }}>{fmt(hub_footprint_per[t])}</td>,
            ])}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── PART 4 CHARTS ────────────────────────────────────────────────────────────
const COMP_COLORS_AREA = { S_fleet_area: '#2D6A4F', S_circ_area: '#52A882', S_charging_area: '#2980B9', S_program_area: '#BDC3C7' }
const COMP_LABELS_AREA = { S_fleet_area: 'Fleet parking', S_circ_area: 'Circulation', S_charging_area: 'Charging stations', S_program_area: 'Program / shelter' }
const COMP_KEYS_AREA = ['S_fleet_area', 'S_circ_area', 'S_charging_area', 'S_program_area']
const AREA_MAPS = { S_fleet_area, S_circ_area, S_charging_area, S_program_area }

function HubAreaSummaryGrid() {
  const cards = [
    { label: 'Hub L area', value: `${fmt(Math.round(S_hub_area.hub_l * HUB_COUNTS.hub_l))} m²`, sub: `combined · ${Math.round(S_hub_area.hub_l)} m² per site`, color: HUB_COLORS_UI.hub_l },
    { label: 'Hub M area', value: `${fmt(Math.round(S_hub_area.hub_m * HUB_COUNTS.hub_m))} m²`, sub: `combined · ${Math.round(S_hub_area.hub_m)} m² per site`, color: HUB_COLORS_UI.hub_m },
    { label: 'Hub S area', value: `${fmt(Math.round(S_hub_area.hub_s * HUB_COUNTS.hub_s))} m²`, sub: `combined · ${Math.round(S_hub_area.hub_s)} m² per site`, color: HUB_COLORS_UI.hub_s },
    { label: 'Total footprint', value: `${fmt(area_total_all_hubs)} m²`, sub: `${area_pct_of_zone}% of 4 km² zone`, color: '#E67E22' },
    { label: 'Total hectares', value: `${(area_total_all_hubs / 10000).toFixed(2)} ha`, sub: 'combined hub land use', color: '#7C3AED' },
    { label: 'Circ. factor', value: `×${CIRCULATION_FACTOR.hub_s}–×${CIRCULATION_FACTOR.hub_l}`, sub: 'fleet area multiplier by tier', color: '#2980B9' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {cards.map(c => <KCard key={c.label} {...c} />)}
    </div>
  )
}

function HubAreaBars() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      {TIERS.map(tier => {
        const total = S_hub_area[tier]
        return (
          <div key={tier}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: HUB_COLORS_UI[tier] }} />
                <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</span>
                <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{fmt(S_hub_area[tier] * HUB_COUNTS[tier])} m² combined · {Math.round(S_hub_area[tier])} m² per site</span>
              </div>
              <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: C.text1 }}>{Math.round(total)} m²</span>
            </div>
            <div style={{ height: 22, display: 'flex', borderRadius: 6, overflow: 'hidden', background: C.border }}>
              {COMP_KEYS_AREA.map(ck => {
                const val = AREA_MAPS[ck][tier]
                const pct = (val / total) * 100
                return (
                  <div key={ck} className="dp-bh" title={`${COMP_LABELS_AREA[ck]}: ${Math.round(val)} m²`} style={{
                    width: `${pct}%`, background: COMP_COLORS_AREA[ck],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {pct > 8 && <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: 'white' }}>{Math.round(val)}</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              {COMP_KEYS_AREA.map(ck => (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, background: COMP_COLORS_AREA[ck], borderRadius: 2 }} />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{COMP_LABELS_AREA[ck]}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text2 }}>{Math.round(AREA_MAPS[ck][tier])} m²</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div style={{ padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1 }}>All hubs combined</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#E67E22' }}>{fmt(area_total_all_hubs)} m²</div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{area_pct_of_zone}% of zone · {(area_total_all_hubs / 10000).toFixed(2)} ha</div>
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
        const modeAreas = modes.map(m => ({ mode: m, val: (fleet_per_hub[tier][m] || 0) * FOOTPRINT_PER_UNIT[m] })).filter(x => x.val > 0)
        const total = modeAreas.reduce((s, x) => s + x.val, 0)
        if (total === 0) return <div key={tier} style={{ textAlign: 'center', padding: 20, color: C.text3, fontFamily: SANS, fontSize: 13 }}>{HUB_LABELS_UI[tier]}<br />no fleet area</div>
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
          paths.push(<path key={mode} d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z`} fill={MODE_META[mode].color} stroke="white" strokeWidth={1.5} />)
          angle += sweep
        })
        return (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 400, color: HUB_COLORS_UI[tier], marginBottom: 6 }}>{HUB_LABELS_UI[tier]}</div>
            <svg width={136} height={136} style={{ overflow: 'visible' }}>
              {paths}
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize={14} fontWeight={400} fontFamily="Georgia, serif" fill={C.text1}>{Math.round(total)}</text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={10} fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fill={C.text3}>m² fleet</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '0 8px' }}>
              {modeAreas.map(({ mode, val }) => (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color }} />
                    <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>{MODE_META[mode].label}</span>
                  </div>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1 }}>{Math.round(val)} m²</span>
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
  const map = { S_fleet_area, S_circ_area, S_charging_area, S_program_area, S_hub_area }
  const tableRows = [
    { label: 'S_fleet',     key: 'S_fleet_area',    formula: 'Σ(units × m²/unit)',          accent: false },
    { label: 'S_circ',      key: 'S_circ_area',     formula: 'S_fleet × (factor − 1)',       accent: false },
    { label: 'S_charging',  key: 'S_charging_area', formula: 'Σ(chargers × station m²)',     accent: false },
    { label: 'S_program',   key: 'S_program_area',  formula: '10% of (fleet+circ+charging)', accent: false },
    { label: 'S_hub TOTAL', key: 'S_hub_area',      formula: 'Sum of all components',        accent: true  },
  ]
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Component</th>
            {TIERS.map(t => <th key={t} style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, color: HUB_COLORS_UI[t], fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{HUB_LABELS_UI[t]}</th>)}
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Formula</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(({ label, key, formula, accent }) => (
            <tr key={label} style={{ borderTop: accent ? `2px solid ${C.border}` : undefined, borderBottom: `1px solid ${C.border}`, background: '#FFFFFF' }}>
              <td style={{ padding: '10px 10px', fontWeight: accent ? 700 : 500, color: accent ? '#0A7E45' : C.text1 }}>{label}</td>
              {TIERS.map(t => <td key={t} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: accent ? 700 : 400, color: accent ? HUB_COLORS_UI[t] : C.text2, fontVariantNumeric: 'tabular-nums' }}>{Math.round(map[key][t])} m²</td>)}
              <td style={{ padding: '10px 10px', color: C.text3, fontSize: 13 }}>{formula}</td>
            </tr>
          ))}
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FFFFFF' }}>
            <td style={{ padding: '10px 10px', color: C.text3, fontSize: 13 }}>Circ. factor</td>
            {TIERS.map(t => <td key={t} style={{ padding: '10px 10px', textAlign: 'right', color: C.text3, fontSize: 13 }}>×{CIRCULATION_FACTOR[t]}</td>)}
            <td style={{ padding: '10px 10px', color: C.text3, fontSize: 13 }}>driveways + maneuvering</td>
          </tr>
          <tr style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: '10px 10px', fontWeight: 600, color: C.text1 }}>All hubs (×count)</td>
            {TIERS.map(t => <td key={t} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: C.text1, fontVariantNumeric: 'tabular-nums' }}>{fmt(S_hub_area[t] * HUB_COUNTS[t])} m²</td>)}
            <td style={{ padding: '10px 10px', color: C.text3, fontSize: 13 }}>S_hub × hub count</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── PART 5 COST COMPARISON ──────────────────────────────────────────────────
const COST_ROWS = [
  { item: 'Vehicle acquisition / financing', private: 380, shared: 0,   note: 'Depreciation on new VW Golf (~€30k / 7 yr) or lease' },
  { item: 'Insurance (Vollkasko)',           private: 100, shared: 0,   note: 'Full comprehensive, Wolfsburg risk zone' },
  { item: 'Fuel (1,500 km/month, petrol)',   private: 195, shared: 0,   note: 'Daily driver avg — €0.13/km incl. road losses' },
  { item: 'Maintenance, tyres, repairs',     private: 95,  shared: 0,   note: 'ADAC average, higher for daily use — amortised' },
  { item: 'Parking (permit + daily paid)',   private: 75,  shared: 0,   note: 'Resident permit + frequent city-centre parking' },
  { item: 'Annual fees (TÜV, KFZ-Steuer)',   private: 22,  shared: 0,   note: '€105 tax + €155 TÜV biennial, annualised' },
  { item: 'Autonomous shuttle / pod',        private: 0,   shared: 70,  note: '20 trips/month × €3.50 avg (MOIA Hamburg comparable)' },
  { item: 'Car-share EV (personal trips)',   private: 0,   shared: 90,  note: '10 trips × 30 min × €0.30/min — longer/cargo runs' },
  { item: 'Autonomous bus',                  private: 0,   shared: 25,  note: '10 trips/month × €2.50' },
  { item: 'E-bike access',                   private: 0,   shared: 5,   note: 'Low-cost subscription or free at hub S' },
]
const COST_PRIVATE_TOTAL = COST_ROWS.reduce((s, r) => s + r.private, 0)
const COST_SHARED_TOTAL  = COST_ROWS.reduce((s, r) => s + r.shared,  0)
const COST_SAVING_MONTH  = COST_PRIVATE_TOTAL - COST_SHARED_TOTAL
const COST_SAVING_YEAR   = COST_SAVING_MONTH * 12

function CostComparison() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Monthly cost item</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 700, color: '#E63946', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Private car</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 700, color: '#0A7E45', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Shared mobility</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Basis</th>
            </tr>
          </thead>
          <tbody>
            {COST_ROWS.map(({ item, private: priv, shared, note }) => (
              <tr key={item} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '9px 10px', color: C.text1, fontWeight: 500 }}>{item}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: priv > 0 ? '#E63946' : C.text3, fontWeight: priv > 0 ? 700 : 400 }}>
                  {priv > 0 ? `€ ${priv}` : '—'}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: shared > 0 ? '#0A7E45' : C.text3, fontWeight: shared > 0 ? 700 : 400 }}>
                  {shared > 0 ? `€ ${shared}` : '—'}
                </td>
                <td style={{ padding: '9px 10px', color: C.text3, fontSize: 13 }}>{note}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${C.border}`, background: '#FFFFFF' }}>
              <td style={{ padding: '12px 10px', fontWeight: 700, color: C.text1, fontSize: 14 }}>Monthly total</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#E63946', fontVariantNumeric: 'tabular-nums' }}>€ {COST_PRIVATE_TOTAL}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#0A7E45', fontVariantNumeric: 'tabular-nums' }}>€ {COST_SHARED_TOTAL}</td>
              <td style={{ padding: '12px 10px', color: C.text3 }}>ADAC 2024 · MiD 2017 · MOIA Hamburg</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <KCard label="Monthly saving" value={`€ ${COST_SAVING_MONTH}`} sub="shared vs. private car" color="#0A7E45" />
        <KCard label="Annual saving"  value={`€ ${COST_SAVING_YEAR.toLocaleString('de-DE')}`} sub="freed household budget" color="#2980B9" />
        <KCard label="Cost reduction" value={`${Math.round((COST_SAVING_MONTH / COST_PRIVATE_TOTAL) * 100)}%`} sub="of monthly transport spend" color="#8E44AD" />
      </div>

      <div style={{ padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, fontSize: 13, fontFamily: SANS, color: C.text3, lineHeight: 1.7 }}>
        <strong style={{ color: C.text2 }}>Important caveats:</strong> This comparison assumes a <em>daily car user</em> — ~1,500 km/month, driving every day, with 10 bus trips/month on top. Private car costs follow ADAC Autokostenrechner 2024 (VW Golf 1.5 TSI). Shared mobility figures use MOIA Hamburg per-ride pricing and Share Now per-minute rates. The shared scenario covers the same mobility needs via autonomous shuttle/pod (short trips), car-share EV (longer/personal trips), and bus. Costs exclude the time value of driving, parking search, and vehicle maintenance administration.
      </div>
    </div>
  )
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
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
  { href: '#cost',         label: '— Cost Comparison' },
  { href: '#cost-tbl',     label: 'Shared vs. private' },
  { href: '#methodology',  label: '— Methodology' },
  { href: '#method-p1',    label: 'Baseline' },
  { href: '#method-p2',    label: 'Fleet sizing' },
  { href: '#method-p3',    label: 'Hub network' },
  { href: '#method-p4',    label: 'Hub area' },
]

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DataPanel() {
  const { fromLanding } = useAppStore()
  const [activeNav, setActiveNav] = useState('#overview')
  const scrollRef = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setProgress(scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const timer = setTimeout(() => {
      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('dp-v') }),
        { threshold: 0.10, rootMargin: '0px 0px -40px 0px', root: el }
      )
      el.querySelectorAll('.dp-a').forEach(node => obs.observe(node))
      return () => obs.disconnect()
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: fromLanding ? 0 : 'var(--nav-w)', right: 0, display: 'flex', background: C.bg, zIndex: 10, overflow: 'hidden' }}>
      <style>{CSS_ANIM}</style>

      {/* Left nav */}
      <nav style={{ width: 200, flexShrink: 0, overflowY: 'auto', background: '#FFFFFF', borderRight: `1px solid ${C.border}`, padding: '32px 14px 32px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '0 10px 16px' }}>
          Data Analysis
        </div>
        {NAV.map(({ href, label }) => {
          const isSect = label.startsWith('—')
          if (isSect) return (
            <div key={href} style={{ padding: '12px 10px 5px', fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {label.replace('— ', '')}
            </div>
          )
          const active = activeNav === href
          return (
            <a key={href} href={href} onClick={() => setActiveNav(href)} style={{
              display: 'block', padding: '6px 10px',
              fontFamily: SANS, fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? C.text1 : C.text3,
              textDecoration: 'none',
            }}>
              {label}
            </a>
          )
        })}
        <div style={{ marginTop: 'auto', padding: '20px 10px 0', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: C.text2 }}>Sources</div>
            {['MiD 2017', 'WOKS 2023/2025', 'KBA 2023', 'UITP benchmarks', 'MOIA Hamburg'].map(s => <div key={s}>{s}</div>)}
          </div>
        </div>
      </nav>

      {/* Main scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Progress bar */}
        <div style={{ position: 'sticky', top: 0, height: 3, background: C.border, zIndex: 50 }}>
          <div style={{ height: '100%', background: C.text1, width: `${progress * 100}%`, transition: 'width 80ms linear' }} />
        </div>

        <div style={{ padding: '52px 56px 100px' }}>

          {/* ── PART 1 ── */}
          <div id="overview" className="dp-a" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Part 1 · Baseline
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 400, color: C.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Modal Distribution
            </h1>
            <p style={{ fontFamily: SERIF, fontSize: 17, color: C.text2, marginTop: 14, lineHeight: 1.7, maxWidth: 520, marginBottom: 0 }}>
              Nine central districts of Wolfsburg, accounting for {fmt(total_residents)} residents,
              {' '}{fmt(WORKERS)} daily workers, and an estimated {fmt(visitors)} visitors — totalling{' '}
              {fmt(D_total)} trips per day under MiD 2017 modal assumptions.
            </p>
          </div>

          <div className="dp-a" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 32, marginBottom: 4 }}>
            <KCard label="Residents"        value={fmt(total_residents)} sub="9 districts · WOKS 2023"   color="#2980B9" />
            <KCard label="Workers in zone"  value={fmt(WORKERS)}         sub="WOKS Arbeitsmarkt 2025"    color="#8E44AD" />
            <KCard label="Daily visitors"   value={fmt(visitors)}        sub="MiD 2017 estimate"         color="#2D6A4F" />
            <KCard label="Total trips/day"  value={fmt(D_total)}         sub="MiD 2017 formula"          color="#E63946" />
          </div>

          <Sect id="demand" eyebrow="Step-by-step demand calculation · MiD 2017" title="Transport Demand Formula">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Residents', val: total_residents, factor: `× ${T_RESIDENT}`, result: total_residents * T_RESIDENT, color: '#2980B9' },
                { label: 'Workers',   val: WORKERS,         factor: `× ${T_WORKER}`,   result: WORKERS * T_WORKER,          color: '#8E44AD' },
                { label: 'Visitors',  val: visitors,        factor: `× ${T_VISITOR}`,  result: visitors * T_VISITOR,        color: '#2D6A4F' },
              ].map(({ label, val, factor, result, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.bg, borderRadius: 0, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2, width: 72 }}>{label}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3, fontVariantNumeric: 'tabular-nums', width: 60 }}>{fmt(val)}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3, width: 40 }}>{factor}</span>
                  <span style={{ fontFamily: SERIF, fontSize: 16, color, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>= {fmt(result)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.text1, borderRadius: 0, marginTop: 4 }}>
                <span style={{ fontFamily: SERIF, fontSize: 15, color: '#fff' }}>D_total</span>
                <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: '#E63946', fontVariantNumeric: 'tabular-nums' }}>{fmt(D_total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 0 }}>
                <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>D_internal (65% intra-zone)</span>
                <span style={{ fontFamily: SERIF, fontSize: 16, color: C.text1, fontVariantNumeric: 'tabular-nums' }}>{fmt(D_internal)}</span>
              </div>
            </div>
          </Sect>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
            <Sect id="modal-split" eyebrow="Share of daily trips · MiD 2017 + KBA 2023" title="Modal Share">
              <ModalShareChart />
            </Sect>
            <Sect id="districts" eyebrow="Residents per district · WOKS 2023" title="District Population">
              <DistrictChart />
            </Sect>
          </div>

          <Sect id="hourly" eyebrow="Estimated weekday pattern · MiD 2017 · hover bars for values" title="Hourly Trip Distribution">
            <HourlyChart />
          </Sect>

          <Sect id="baseline-tbl" eyebrow="All metrics from open statistical data" title="Baseline Results">
            <BaselineTable />
          </Sect>

          {/* ── PART 2 ── */}
          <Rule label="Part 2 · Post-Car Fleet Sizing" />

          <div id="fleet" className="dp-a" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Part 2 · Fleet Sizing</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: C.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Post-Car Fleet</h2>
            <p style={{ fontFamily: SERIF, fontSize: 17, color: C.text2, marginTop: 14, lineHeight: 1.7, maxWidth: 520, marginBottom: 0 }}>
              If private cars are replaced by a shared fleet, peak-hour demand determines
              how many vehicles must be on the street simultaneously. A flow decomposition
              first separates inbound from internal trips, then filters out {(WALKING_SHARE_INTERNAL * 100).toFixed(0)}% as walkable,
              yielding a net transport demand of {fmt(D_transport)} trips/day.
            </p>
          </div>

          <div className="dp-a" style={{ marginTop: 28, marginBottom: 4 }}>
            <FleetSummaryGrid />
          </div>

          <Sect id="flow" eyebrow="D_total → inbound / internal transport / walking" title="Trip Flow Decomposition">
            <FlowChart />
          </Sect>

          <Sect id="fleet-cards" eyebrow="On-street peak · total with reserve · trips/day" title="Fleet by Mode">
            <ModeCards />
          </Sect>

          <Sect id="fleet-chart" eyebrow="On-street = (peak trips / capacity) × duration" title="On-street Peak vs Total Fleet">
            <OnStreetChart />
          </Sect>

          <Sect id="replacement" eyebrow="49,648 private cars/day replaced by shared fleet" title="Fleet Replacement">
            <ReplacementChart />
          </Sect>

          <Sect id="dot-matrix" eyebrow="Visual scale comparison — each dot = 10 vehicles" title="Dot Matrix">
            <DotMatrix />
          </Sect>

          <Sect id="charging" eyebrow="30% of fleet simultaneously charging · e-bike 50%" title="Charging Points">
            <ChargingChart />
          </Sect>

          <Sect id="fleet-tbl" eyebrow="Full breakdown by mode" title="Fleet Results Table">
            <FleetTable />
          </Sect>

          {/* ── PART 3 ── */}
          <Rule label="Part 3 · Hub Network" />

          <div id="hubs" className="dp-a" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Part 3 · Hub Network</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: C.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Hub Network &amp; Fleet</h2>
            <p style={{ fontFamily: SERIF, fontSize: 17, color: C.text2, marginTop: 14, lineHeight: 1.7, maxWidth: 520, marginBottom: 0 }}>
              Three hub tiers serve different functions: large interchange hubs (Hub L) anchor the zone
              at existing multi-level parking structures; district hubs (Hub M) occupy repurposed underground
              car parks; and neighbourhood micro-hubs (Hub S) replace on-street parking across the {ZONE_AREA_KM2} km² zone.
              Together they accumulate a total fleet of {fmt(total_fleet)} vehicles and bikes.
            </p>
          </div>

          <div id="hub-summary" className="dp-a" style={{ marginTop: 28, marginBottom: 4 }}>
            <HubSummaryGrid />
          </div>

          <Sect id="hub-heatmap" eyebrow="Units on a single hub · incl. 20% reserve" title="Fleet per Hub — Heatmap">
            <HubHeatmap />
          </Sect>

          <Sect id="hub-bars" eyebrow="All vehicles assigned to each tier · stacked by mode" title="Total Fleet by Hub Tier">
            <HubBars />
          </Sect>

          <Sect id="hub-cards" eyebrow="Vehicle mix, charging and footprint per single hub" title="Hub Profile Cards">
            <HubCards />
          </Sect>

          <Sect id="hub-infra" eyebrow="Tier total · per-hub allocation · charging · footprint" title="Infrastructure Table">
            <HubInfraTable />
          </Sect>

          {/* ── PART 4 ── */}
          <Rule label="Part 4 · Hub Area Calculation" />

          <div id="hub-area" className="dp-a" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Part 4 · Hub Area</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: C.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              S_hub = S_fleet + S_circ + S_charging + S_program
            </h2>
            <p style={{ fontFamily: SERIF, fontSize: 17, color: C.text2, marginTop: 14, lineHeight: 1.7, maxWidth: 520, marginBottom: 0 }}>
              Each hub tier has a distinct spatial footprint determined by its vehicle mix,
              circulation requirements, and program elements. Combined, the hub network
              requires {fmt(area_total_all_hubs)} m² — just {area_pct_of_zone}% of the zone,
              or {(area_total_all_hubs / 10000).toFixed(2)} hectares.
            </p>
          </div>

          <div id="hub-area-sum" className="dp-a" style={{ marginTop: 28, marginBottom: 4 }}>
            <HubAreaSummaryGrid />
          </div>

          <Sect id="hub-area-bar" eyebrow="Fleet · circulation · charging · program per hub" title="Area Breakdown">
            <HubAreaBars />
          </Sect>

          <Sect id="hub-area-pie" eyebrow="How S_fleet is distributed across vehicle types" title="Fleet Parking Area by Mode">
            <HubAreaFleetDonut />
          </Sect>

          <Sect id="hub-area-tbl" eyebrow="Full breakdown · circulation factors · per-hub and total" title="Hub Area Table">
            <HubAreaTable />
          </Sect>

          {/* ── PART 5 COST COMPARISON ── */}
          <Rule label="Cost Comparison" />

          <div id="cost" className="dp-a" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Part 5 · Economics</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: C.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Shared vs. Private Car</h2>
            <p style={{ fontFamily: SERIF, fontSize: 17, color: C.text2, marginTop: 14, lineHeight: 1.7, maxWidth: 520, marginBottom: 0 }}>
              A direct cost comparison for a daily car user — driving every day (~1,500 km/month),
              with 10 bus trips per month on top. Private-car figures follow{' '}
              <strong style={{ color: C.text1 }}>ADAC Autokostenrechner 2024</strong> (VW Golf 1.5 TSI, new).
              Shared-mobility costs are benchmarked from <strong style={{ color: C.text1 }}>MOIA Hamburg</strong> per-trip pricing
              and <strong style={{ color: C.text1 }}>Share Now</strong> per-minute rates.
            </p>
          </div>

          <Sect id="cost-tbl" eyebrow="Monthly breakdown · approximate values · ADAC 2024 / MOIA Hamburg" title="Monthly Cost Breakdown">
            <CostComparison />
          </Sect>

          {/* ── METHODOLOGY ── */}
          <Rule label="Methodology" />

          <div id="methodology" className="dp-a" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Appendix · Methods</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: C.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>How the Numbers Were Made</h2>
            <p style={{ fontFamily: SERIF, fontSize: 17, color: C.text2, marginTop: 14, lineHeight: 1.7, maxWidth: 520, marginBottom: 0 }}>
              Each section builds on publicly available data and standard urban transport benchmarks.
              The calculations are deterministic — no simulation or model calibration is required.
            </p>
          </div>

          <Sect id="method-p1" eyebrow="Part 1 · Baseline" title="Transport Demand">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: '0 0 16px' }}>
                  Population figures come from the <strong style={{ color: C.text1 }}>WOKS 2023</strong> statistical report for the nine central Wolfsburg districts.
                  Worker count ({fmt(WORKERS)}) is from <strong style={{ color: C.text1 }}>WOKS Arbeitsmarktbericht 2025</strong>.
                  Visitor volume is estimated as 20% of the combined residents and workers, following the MiD 2017 trip-generation pattern for mid-size German cities.
                </p>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: 0 }}>
                  Trip generation rates are national averages from <strong style={{ color: C.text1 }}>MiD 2017 (BMVI)</strong>:
                  residents make 3.2 trips/day, workers 2.1, visitors 1.5.
                  Modal split uses the MiD 2017 baseline with the private-car share raised
                  by +4 percentage points to 62%, reflecting Wolfsburg's above-average car ownership
                  from <strong style={{ color: C.text1 }}>KBA 2023</strong>.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'D_total formula', formula: `residents × 3.2 + workers × 2.1 + visitors × 1.5`, result: `= ${fmt(D_total)} trips/day` },
                  { label: 'Visitors estimate', formula: `(${fmt(total_residents)} + ${fmt(WORKERS)}) × 20%`, result: `= ${fmt(visitors)} visitors/day` },
                  { label: 'Peak hour (8–9 h)', formula: `D_total × 8.5% MiD profile`, result: `= ${fmt(peak_hour_trips)} trips/h` },
                  { label: 'Private cars/day', formula: `D_total × 62% ÷ 1.3 occupancy`, result: `= ${fmt(car_vehicles_per_day)} vehicles` },
                ].map(({ label, formula, result }) => (
                  <div key={label} style={{ background: '#FFFFFF', borderRadius: 0, padding: '13px 16px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{formula}</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1, marginTop: 5 }}>{result}</div>
                  </div>
                ))}
              </div>
            </div>
          </Sect>

          <Sect id="method-p2" eyebrow="Part 2 · Fleet Sizing" title="From Trips to Vehicles">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: '0 0 16px' }}>
                  D_total is first split into <strong style={{ color: C.text1 }}>inbound</strong> and <strong style={{ color: C.text1 }}>internal</strong> flows.
                  Inbound covers workers commuting from outside the zone (50% of worker trips)
                  and visitors arriving from outside (80% of visitor trips).
                  Internal flows include all resident trips plus the remaining worker and visitor movements within the zone.
                  Of internal trips, 60% are assumed walkable and filtered out — consistent with
                  MiD 2017 short-distance walking rates for dense urban cores.
                </p>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: 0 }}>
                  Each transport mode is assigned a fixed share of the remaining demand via two allocation matrices:
                  one for inbound flows (dominated by autonomous bus and shuttle),
                  one for internal flows (dominated by e-bike and autonomous pod).
                  Fleet size follows a <strong style={{ color: C.text1 }}>peak-hour utilisation formula</strong>: the number of vehicles
                  simultaneously on the street at peak hour equals peak trips divided by vehicle capacity, multiplied by average trip duration.
                  A mode-specific reserve factor (1.15–1.35) converts on-street count to total fleet.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Net transport demand', formula: `inbound trips + internal transport\n(after walking filter)`, result: `D_transport = ${fmt(D_transport)}` },
                  { label: 'Walking filtered out', formula: `internal trips × 60% walkable`, result: `= ${fmt(walking_filtered)} trips/day` },
                  { label: 'On-street fleet (per mode)', formula: `⌈(peak_trips ÷ capacity) × trip_h⌉`, result: `e.g. e-bike: ${fleet.e_bike.on_street} units` },
                  { label: 'Total fleet (per mode)', formula: `on_street × peak_factor`, result: `total: ${fmt(total_fleet)} vehicles` },
                ].map(({ label, formula, result }) => (
                  <div key={label} style={{ background: '#FFFFFF', borderRadius: 0, padding: '13px 16px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{formula}</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1, marginTop: 5 }}>{result}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: 0 }}>
                  Charging point requirements are benchmarked from operator data:
                  50% of e-bikes charge simultaneously (Nextbike operational standard),
                  30% for all other modes (UITP autonomous vehicle guidelines, MOIA Hamburg analogue,
                  Share Now fleet operations).
                  The baseline car count ({fmt(CARS_REPLACED)} private vehicles/day) is derived from KBA 2023
                  car registration data for Wolfsburg, divided by average car utilisation.
                </p>
              </div>
            </div>
          </Sect>

          <Sect id="method-p3" eyebrow="Part 3 · Hub Network" title="Hub Counts from Geometry">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: '0 0 16px' }}>
                  Hub counts are derived from <strong style={{ color: C.text1 }}>coverage geometry</strong>, not from fleet demand alone.
                  The starting point is the 4 km² zone area and the maximum acceptable walking distance to a hub.
                  A 1.35× overlap factor accounts for irregular street grids and dead zones between circles.
                </p>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: 0 }}>
                  <strong style={{ color: C.text1 }}>Hub L</strong> count is constrained by existing infrastructure —
                  there are at most 6 large parking structures in the zone that can be repurposed as interchange hubs.
                  The fleet-driven estimate (⌈(bus + car-share fleet) ÷ 8⌉) is capped at this maximum.
                  <strong style={{ color: C.text1 }}> Hub M</strong> is the maximum of the geometric estimate (r = 400 m coverage) and the
                  shuttle-fleet requirement (one Hub M per 3 shuttles).
                  <strong style={{ color: C.text1 }}> Hub S</strong> follows purely from geometry: enough micro-hubs to ensure
                  no resident is more than 200 m from a docking point.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { tier: 'Hub S', color: HUB_COLORS_UI.hub_s, formula: `⌈(4,000,000 m² ÷ π×200²) × 1.35⌉`, result: `= ${hub_s_count} hubs`, note: '200 m walking radius' },
                  { tier: 'Hub M', color: HUB_COLORS_UI.hub_m, formula: `max(geometry r=400m,\nshuttle_fleet ÷ 3)`, result: `= ${hub_m_count} hubs`, note: '400 m, shuttle coverage' },
                  { tier: 'Hub L', color: HUB_COLORS_UI.hub_l, formula: `min(⌈(bus+car-share) ÷ 8⌉, 6)`, result: `= ${hub_l_count} hubs`, note: 'capped — existing garages' },
                ].map(({ tier, color, formula, result, note }) => (
                  <div key={tier} style={{ background: '#FFFFFF', borderRadius: 0, padding: '13px 16px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color, marginBottom: 8 }}>{tier}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{formula}</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1, marginTop: 5 }}>{result}</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 3 }}>{note}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: 0 }}>
                  Fleet is assigned to tiers via a fixed distribution matrix — for example, all buses and car-share EVs
                  concentrate at Hub L, while 70% of e-bikes are distributed to Hub S micro-hubs.
                  Per-hub vehicle count adds a 20% operational reserve on top of the tier allocation,
                  rounding up to ensure no hub is under-provisioned at peak demand.
                </p>
              </div>
            </div>
          </Sect>

          <Sect id="method-p4" eyebrow="Part 4 · Hub Area" title="Spatial Footprint Formula">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: '0 0 16px' }}>
                  Hub area is the sum of four components. Footprint values per vehicle type are drawn from
                  standard parking and depot design references: 2.5 m² for an e-bike rack,
                  10 m² for a compact pod, 35 m² for a minibus, 60 m² for a full-size bus, 15 m² for a car.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'S_fleet — parking footprint', formula: `Σ (units_per_hub × m²/vehicle)`, note: 'standard depot footprint values per type' },
                  { label: 'S_circ — circulation', formula: `S_fleet × (factor − 1)`, note: '×1.6 Hub L · ×1.4 Hub M · ×1.2 Hub S' },
                  { label: 'S_charging — charging stations', formula: `Σ ⌈units × rate⌉ × station_m²`, note: '0.5 m² e-bike dock · 4 m² EV charger' },
                  { label: 'S_program — shelter & services', formula: `(S_fleet + S_circ + S_charging) × 10%`, note: 'waiting areas, info points, shelter' },
                ].map(({ label, formula, note }) => (
                  <div key={label} style={{ background: '#FFFFFF', borderRadius: 0, padding: '13px 16px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{formula}</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 5 }}>{note}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxWidth: 600 }}>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: '0 0 16px' }}>
                  The circulation factor captures driveways, turning radii, and pedestrian paths
                  within the hub perimeter — it is applied as a multiplier to fleet area only,
                  not to charging or program. Program space covers sheltered waiting zones,
                  real-time information displays, and minor service areas.
                </p>
                <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, lineHeight: 1.75, margin: 0 }}>
                  Total land use across the entire hub network is{' '}
                  <strong style={{ color: C.text1 }}>{fmt(area_total_all_hubs)} m²</strong> ({(area_total_all_hubs / 10000).toFixed(2)} ha),
                  equivalent to {area_pct_of_zone}% of the 4 km² project zone —
                  comparable to a single urban block. The concentration of area in Hub L
                  ({Math.round(S_hub_area.hub_l * hub_l_count / area_total_all_hubs * 100)}% of total footprint)
                  reflects the bus and car-share depot requirements at large interchange nodes.
                </p>
              </div>
            </div>
          </Sect>

          {/* Sources */}
          <div className="dp-a" style={{ marginTop: 20, padding: '20px 24px', background: C.card, borderRadius: 0, border: `1px solid ${C.border}` }}>
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.text3, margin: 0, lineHeight: 1.9 }}>
              <strong style={{ color: C.text2 }}>Baseline:</strong> MiD 2017 (BMVI) · WOKS Wolfsburg 2023/2025 · KBA 2023<br />
              <strong style={{ color: C.text2 }}>Fleet:</strong> Nextbike operational data · UITP autonomous shuttle &amp; bus benchmarks · MOIA Hamburg · Share Now / Stadtmobil<br />
              <strong style={{ color: C.text2 }}>Hub geometry:</strong> Coverage radius 200 m (S) / 400 m (M) · 1.35× overlap factor · max 6 Hub L (existing parking garages)<br />
              <strong style={{ color: C.text2 }}>Hub area:</strong> Footprint/unit + circulation factor + charging stations + 10% program<br />
              <strong style={{ color: C.text2 }}>Scripts:</strong>{' '}
              {['modal_distribution.py', 'fleet_calculation.py', 'hub_calculation.py', 'hub_area.py'].map(s => (
                <code key={s} style={{ background: '#F0EFED', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 13, marginRight: 6 }}>{s}</code>
              ))}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
