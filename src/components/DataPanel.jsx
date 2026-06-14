import React, { useState, useEffect, useRef, useCallback } from 'react'

// ─── BASELINE ─────────────────────────────────────────────────────────────────
const DISTRICT_POP = {
  'Stadtmitte': 2800, 'Schillerteich': 2100, 'Hellwinkel': 1900,
  'Heßlingen': 2200, 'Rothenfelde': 1800, 'Köhlerberg': 1400,
  'Alt-Wolfsburg': 2600, 'Sandkamp': 1100, 'Hochenstein': 1500,
}
const WORKERS = 18000, T_RESIDENT = 3.2, T_WORKER = 2.1, T_VISITOR = 1.5
const VISITOR_SHARE = 0.20, CAR_OCCUPANCY = 1.3

const MODAL = {
  private_car:    { share: 0.62, label: 'Private car',    color: '#111111' },
  public_transit: { share: 0.10, label: 'Public transit', color: '#555555' },
  walking:        { share: 0.20, label: 'Walking',        color: '#888888' },
  cycling:        { share: 0.08, label: 'Cycling',        color: '#aaaaaa' },
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

// ─── FLEET ────────────────────────────────────────────────────────────────────
const ZONE_AREA_KM2 = 4.0
const CARS_REPLACED = 49648

const MODE_META = {
  e_bike:             { label: 'E-Bike',       color: '#111111' },
  autonomous_shuttle: { label: 'Auto Shuttle', color: '#555555' },
  autonomous_bus:     { label: 'Auto Bus',     color: '#333333' },
  autonomous_pod:     { label: 'Auto Pod',     color: '#777777' },
  car_sharing_ev:     { label: 'Car-Share EV', color: '#999999' },
}

const FLEET_PARAMS = {
  e_bike:             { capacity: 1,    trip_h: 0.25, peak_factor: 1.20 },
  autonomous_shuttle: { capacity: 12,   trip_h: 0.25, peak_factor: 1.30 },
  autonomous_bus:     { capacity: 25,   trip_h: 0.40, peak_factor: 1.35 },
  autonomous_pod:     { capacity: 1.5,  trip_h: 0.20, peak_factor: 1.20 },
  car_sharing_ev:     { capacity: 3.5,  trip_h: 0.50, peak_factor: 1.15 },
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
const hub_zone_m2         = ZONE_AREA_KM2 * 1_000_000
const hub_s_area          = Math.PI * 200 ** 2
const hub_s_count         = ceil((hub_zone_m2 / hub_s_area) * 1.35)
const hub_m_area          = Math.PI * 400 ** 2
const hub_m_from_geometry = ceil((hub_zone_m2 / hub_m_area) * 1.35)
const hub_m_from_shuttle  = ceil(fleet.autonomous_shuttle.total / 3)
const hub_m_count         = Math.max(hub_m_from_geometry, hub_m_from_shuttle)
const hub_l_from_fleet    = ceil((fleet.autonomous_bus.total + fleet.car_sharing_ev.total) / 8)
const hub_l_count         = Math.min(Math.max(hub_l_from_fleet, 3), 6)

const HUB_COUNTS    = { hub_l: hub_l_count, hub_m: hub_m_count, hub_s: hub_s_count }
const HUB_COLORS_UI = { hub_l: '#111111', hub_m: '#555555', hub_s: '#999999' }
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

const hub_total_charging  = TIERS.reduce((s, t) => s + hub_charging_per[t] * HUB_COUNTS[t], 0)
const hub_total_footprint = TIERS.reduce((s, t) => s + hub_footprint_per[t] * HUB_COUNTS[t], 0)
const hub_footprint_pct   = (hub_total_footprint / hub_zone_m2 * 100).toFixed(2)

// ─── HUB AREA ─────────────────────────────────────────────────────────────────
const FOOTPRINT_PER_UNIT = { e_bike: 2.5, autonomous_pod: 10, autonomous_shuttle: 35, autonomous_bus: 60, car_sharing_ev: 15 }
const CIRCULATION_FACTOR = { hub_l: 1.60, hub_m: 1.40, hub_s: 1.20 }
const CHARGING_FP_M2     = { e_bike: 0.5, other: 4.0 }

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
  S_program_area[tier] = sub * 0.10
  S_hub_area[tier] = sub + S_program_area[tier]
}

const area_total_all_hubs = TIERS.reduce((s, t) => s + S_hub_area[t] * HUB_COUNTS[t], 0)
const area_pct_of_zone    = (area_total_all_hubs / hub_zone_m2 * 100).toFixed(2)

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const F = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const C = { bg: '#FAFAF9', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }
const fmt = n => Math.round(n).toLocaleString('de-DE')
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

const COMP_COLORS = { S_fleet_area: '#222222', S_circ_area: '#555555', S_charging_area: '#888888', S_program_area: '#bbbbbb' }
const COMP_LABELS = { S_fleet_area: 'Fleet parking', S_circ_area: 'Circulation', S_charging_area: 'Charging', S_program_area: 'Program' }
const COMP_KEYS   = ['S_fleet_area', 'S_circ_area', 'S_charging_area', 'S_program_area']
const AREA_MAPS   = { S_fleet_area, S_circ_area, S_charging_area, S_program_area }

const HUB_CARD_MODES = {
  hub_l: ['car_sharing_ev', 'autonomous_bus', 'autonomous_shuttle', 'autonomous_pod'],
  hub_m: ['autonomous_shuttle', 'autonomous_pod', 'e_bike'],
  hub_s: ['e_bike', 'autonomous_pod'],
}
const HUB_CARD_DESC = {
  hub_l: 'Large interchange · parking garage / transit node',
  hub_m: 'District hub · street-level, covered',
  hub_s: 'Micro-hub · on-street docking point',
}

const CSS_DP = `
.dp-bh{transform:scaleX(0);transform-origin:left center;transition:transform 900ms ${EASE}}
.dp-in .dp-bh{transform:scaleX(1)}
.dp-bv{transform:scaleY(0);transform-origin:bottom center;transition:transform 900ms ${EASE}}
.dp-in .dp-bv{transform:scaleY(1)}
`

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Eyebrow({ children }) {
  return <div style={{ fontFamily: F, fontSize: 11, fontWeight: 400, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{children}</div>
}

function SectionTitle({ children, size = 36 }) {
  return <h2 style={{ fontFamily: F, fontSize: size, fontWeight: 400, color: C.text1, margin: '0 0 24px', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{children}</h2>
}

function KCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: '20px 22px', border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: F, fontSize: 48, fontWeight: 300, color: color || C.text1, lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 400, color: C.text1, marginTop: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function DataTable({ head, rows, renderRow }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${C.text1}` }}>
            {head.map(({ label, align }) => (
              <th key={label} style={{ textAlign: align || 'left', padding: '8px 10px', fontWeight: 400, color: C.text3, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((row, i) => renderRow(row, i))}</tbody>
      </table>
    </div>
  )
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────
function ModalShareChart() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {Object.entries(MODAL).map(([key, { share, label, color }], i) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontFamily: F, fontSize: 13, color: C.text1 }}>{label}</span>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color }}>{(share * 100).toFixed(0)}%</span>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(share / 0.62) * 100}%`, height: '100%', background: color, borderRadius: 3, transitionDelay: `${i * 80}ms` }} />
          </div>
          <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginTop: 4 }}>{fmt(D_total * share)} trips/day</div>
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
          <div style={{ fontFamily: F, width: 112, fontSize: 12, color: C.text2, flexShrink: 0 }}>{name}</div>
          <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(pop / maxPop) * 100}%`, height: '100%', background: '#444444', borderRadius: 3, transitionDelay: `${i * 35}ms` }} />
          </div>
          <div style={{ fontFamily: F, fontSize: 11, color: C.text3, width: 44, textAlign: 'right', flexShrink: 0 }}>{pop.toLocaleString('de-DE')}</div>
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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72 }}>
        {HOUR_SHARE.map((s, h) => (
          <div key={h} className="dp-bv" title={`${h}:00 — ${fmt(D_total * s)} trips`} style={{
            flex: 1, height: `${(s / maxS) * 100}%`,
            background: isPeak(h) ? '#111111' : '#cccccc',
            borderRadius: '2px 2px 0 0',
            transitionDelay: `${h * 18}ms`,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>
        {[0, 4, 8, 12, 16, 20, 23].map(h => <span key={h} style={{ fontFamily: F, fontSize: 10, color: C.text3 }}>{h}h</span>)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[['#111111', 'Peak (7–9h, 16–18h)'], ['#cccccc', 'Off-peak']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
            <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowChart() {
  const flows = [
    { label: 'Inbound',            value: inbound_trips,      color: '#111111', sub: 'cross-boundary workers & visitors' },
    { label: 'Internal transport', value: transport_internal, color: '#555555', sub: 'requires a vehicle' },
    { label: 'Walking (filtered)', value: walking_filtered,   color: C.border,  sub: '60% of internal — not transported' },
  ]
  const maxVal = D_total
  const maxT = Math.max(...Object.values(fleet).map(x => x.trips))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ padding: '12px 18px', background: C.text1, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: F, fontSize: 13, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>D_total</span>
        <span style={{ fontFamily: F, fontSize: 22, fontWeight: 300, color: '#fff', letterSpacing: '-0.5px' }}>{fmt(D_total)} trips/day</span>
      </div>
      {flows.map(({ label, value, color, sub }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <div>
              <span style={{ fontFamily: F, fontSize: 13, color: C.text1 }}>{label}</span>
              <span style={{ fontFamily: F, fontSize: 11, color: C.text3, marginLeft: 8 }}>{sub}</span>
            </div>
            <span style={{ fontFamily: F, fontSize: 13, color }}>{fmt(value)}</span>
          </div>
          <div style={{ height: 7, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(value / maxVal) * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
          </div>
        </div>
      ))}
      <div style={{ padding: '12px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: F, fontSize: 13, color: C.text1 }}>D_transport (net)</span>
          <span style={{ fontFamily: F, fontSize: 11, color: C.text3, marginLeft: 8 }}>inbound + internal transport</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: F, fontSize: 22, fontWeight: 300, color: C.text1, letterSpacing: '-0.5px' }}>{fmt(D_transport)}</div>
          <div style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>−{reduction_pct}% vs D_total</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginBottom: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Trips/day by mode</div>
        {Object.entries(MODE_META).map(([mode, { label, color }]) => {
          const f = fleet[mode]
          return (
            <div key={mode} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: F, fontSize: 12, color: C.text2 }}>{label}</span>
                </div>
                <span style={{ fontFamily: F, fontSize: 12, color }}>{fmt(f.trips)}</span>
              </div>
              <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {Object.entries(MODE_META).map(([key, { label, color }]) => {
        const f = fleet[key]
        return (
          <div key={key} style={{ background: C.card, borderRadius: 10, padding: '16px', border: `1px solid ${C.border}`, borderTop: `2px solid ${color}` }}>
            <div style={{ fontFamily: F, fontSize: 10, fontWeight: 400, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
            <div style={{ fontFamily: F, fontSize: 28, fontWeight: 300, color: C.text1, letterSpacing: '-0.5px', lineHeight: 1 }}>{fmt(f.total)}</div>
            <div style={{ fontFamily: F, fontSize: 10, color: C.text3, marginTop: 2, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>total fleet</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[['On-street', f.on_street], ['Peak trips/h', f.peak_hour], ['Charging pts', f.charging]].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{lbl}</span>
                  <span style={{ fontFamily: F, fontSize: 11, color: C.text2 }}>{fmt(val)}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {modes.map(mode => {
        const { label, color } = MODE_META[mode]
        const { on_street, total } = fleet[mode]
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: F, fontSize: 13, color: C.text1 }}>{label}</span>
              <span style={{ fontFamily: F, fontSize: 12, color: C.text3 }}>
                <span style={{ color }}>{fmt(on_street)}</span>
                <span style={{ color: C.border }}> / </span>
                <span style={{ color: C.text1 }}>{fmt(total)}</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 18 }}>
              <div style={{ position: 'absolute', inset: 0, background: C.border, borderRadius: 4 }} />
              <div className="dp-bh" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(total / maxVal) * 100}%`, background: color, opacity: 0.25, borderRadius: 4 }} />
              <div className="dp-bh" style={{ position: 'absolute', left: 0, top: 3, bottom: 3, width: `${(on_street / maxVal) * 100}%`, background: color, borderRadius: 3 }} />
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        {[['solid', 'On-street at peak hour'], ['0.25', 'Total fleet (with reserve)']].map(([t, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 6, background: '#444', borderRadius: 2, opacity: t === 'solid' ? 1 : 0.25 }} />
            <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplacementChart() {
  const modes = Object.keys(MODE_META)
  const scaleMax = Math.max(CARS_REPLACED, total_fleet) * 1.1
  const BAR_W = 88
  const segments = modes.map(m => ({ mode: m, ...MODE_META[m], val: fleet[m].total }))
  return (
    <div style={{ display: 'flex', gap: 36, alignItems: 'flex-end' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: F, fontSize: 10, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Baseline</div>
        <div className="dp-bv" style={{ width: BAR_W, height: Math.round((CARS_REPLACED / scaleMax) * 220), background: '#222222', borderRadius: '5px 5px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10 }}>
          <span style={{ fontFamily: F, fontSize: 11, color: '#fff' }}>{fmt(CARS_REPLACED)}</span>
        </div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.text1, marginTop: 6 }}>Private cars</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: F, fontSize: 10, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Post-Car</div>
        <div className="dp-bv" style={{ width: BAR_W, height: Math.round((total_fleet / scaleMax) * 220), borderRadius: '5px 5px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
          {segments.map(({ mode, color, val }) => (
            <div key={mode} style={{ flex: val, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {val > 150 && <span style={{ fontFamily: F, fontSize: 9, color: '#fff' }}>{fmt(val)}</span>}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.text1, marginTop: 6 }}>Shared fleet</div>
        <div style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{fmt(total_fleet)} units</div>
      </div>
      <div style={{ flex: 1, paddingBottom: 24 }}>
        <div style={{ padding: '14px 18px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontFamily: F, fontSize: 32, fontWeight: 300, color: C.text1, letterSpacing: '-0.5px' }}>1 : {replacement_ratio}</div>
          <div style={{ fontFamily: F, fontSize: 12, color: C.text3, marginTop: 3 }}>shared vehicle replaces {replacement_ratio} private cars</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {segments.map(({ mode, color, label, val }) => (
            <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontFamily: F, fontSize: 12, color: C.text2, flex: 1 }}>{label}</span>
              <span style={{ fontFamily: F, fontSize: 12, color: C.text1 }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DotMatrix() {
  const UNIT = 10, COLS = 55
  const carDots   = Math.ceil(CARS_REPLACED / UNIT)
  const fleetDots = Math.ceil(total_fleet / UNIT)
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
        cells.push(<div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: colorFn(idx), flexShrink: 0 }} />)
      }
      rows.push(<div key={r} style={{ display: 'flex', gap: 3 }}>{cells}</div>)
    }
    return rows
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontFamily: F, fontSize: 11, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          Private Cars — {fmt(CARS_REPLACED)} <span style={{ fontWeight: 400 }}>(each dot = {UNIT} vehicles)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(carDots, () => '#222222')}</div>
      </div>
      <div>
        <div style={{ fontFamily: F, fontSize: 11, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          Post-Car Fleet — {fmt(total_fleet)} <span style={{ fontWeight: 400 }}>(each dot = {UNIT} vehicles)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(fleetDots, fleetColorFn)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {modeOrder.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_META[m].color }} />
              <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{MODE_META[m].label}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {modes.map((mode, i) => {
        const { label, color } = MODE_META[mode]
        const val = fleet[mode].charging
        return (
          <div key={mode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: F, fontSize: 13, color: C.text2 }}>{label}</span>
              <span style={{ fontFamily: F, fontSize: 13, color }}>{fmt(val)} pts</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <div className="dp-bh" style={{ width: `${(val / maxVal) * 100}%`, height: '100%', background: color, borderRadius: 3, transitionDelay: `${i * 60}ms` }} />
            </div>
          </div>
        )
      })}
      <div style={{ marginTop: 6, padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: F, fontSize: 13, color: C.text1, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total charging points</span>
        <span style={{ fontFamily: F, fontSize: 28, fontWeight: 300, color: C.text1, letterSpacing: '-0.5px' }}>{fmt(total_charging)}</span>
      </div>
    </div>
  )
}

function HubHeatmap() {
  const modes = Object.keys(MODE_META)
  const allVals = TIERS.flatMap(t => modes.map(m => fleet_per_hub[t][m] || 0))
  const maxVal  = Math.max(...allVals)
  const cellGray = val => {
    if (val === 0) return '#F5F5F3'
    const r = val / maxVal
    const v = Math.round(240 - r * 200)
    return `rgb(${v},${v},${v})`
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 120, textAlign: 'left', fontFamily: F, fontSize: 11, color: C.text3, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 8px 10px' }} />
            {TIERS.map(t => (
              <th key={t} style={{ textAlign: 'center', fontFamily: F, fontSize: 12, fontWeight: 400, color: HUB_COLORS_UI[t], padding: '0 0 10px' }}>
                {HUB_LABELS_UI[t]}<br />
                <span style={{ fontWeight: 400, color: C.text3, fontSize: 10 }}>{HUB_COUNTS[t]} hubs</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modes.map(mode => (
            <tr key={mode}>
              <td style={{ fontFamily: F, fontSize: 12, color: C.text2, padding: '0 8px 0 0', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color }} />
                  {MODE_META[mode].label}
                </div>
              </td>
              {TIERS.map(t => {
                const val = fleet_per_hub[t][mode] || 0
                const bg  = cellGray(val)
                const dark = val / maxVal > 0.45
                return (
                  <td key={t} style={{ textAlign: 'center', padding: '10px 6px', background: bg, borderRadius: 7, fontFamily: F, fontSize: 14, fontWeight: 400, color: dark ? '#fff' : (val > 0 ? C.text1 : C.text3), minWidth: 80 }}>
                    {val > 0 ? val : '–'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginTop: 10 }}>Units per single hub · incl. 20% reserve</div>
    </div>
  )
}

function HubBars() {
  const modes = Object.keys(MODE_META)
  const tierTotals = TIERS.map(t => modes.reduce((s, m) => s + (fleet_at_tier[t][m] || 0), 0))
  const maxTotal   = Math.max(...tierTotals)
  const BAR_H = 160
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      {TIERS.map((tier, ti) => {
        const total = tierTotals[ti]
        const barH  = Math.round((total / maxTotal) * BAR_H)
        return (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ height: BAR_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%' }}>
              <div className="dp-bv" style={{ height: barH, width: '100%', borderRadius: '7px 7px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                {modes.map(mode => {
                  const val = fleet_at_tier[tier][mode] || 0
                  if (val === 0) return null
                  const segH = (val / total) * barH
                  return (
                    <div key={mode} title={`${MODE_META[mode].label}: ${val}`} style={{ height: segH, background: MODE_META[mode].color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {segH > 18 && <span style={{ fontFamily: F, fontSize: 10, color: '#fff' }}>{val}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div style={{ fontFamily: F, fontSize: 13, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</div>
              <div style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{HUB_COUNTS[tier]} hubs · {fmt(total)} total</div>
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingBottom: 36 }}>
        {modes.map(mode => (
          <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 9, height: 9, background: MODE_META[mode].color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: F, fontSize: 12, color: C.text2 }}>{MODE_META[mode].label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HubCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {TIERS.map(tier => {
        const color = HUB_COLORS_UI[tier]
        return (
          <div key={tier} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ fontFamily: F, fontSize: 18, fontWeight: 400, color: C.text1, letterSpacing: '-0.3px' }}>{HUB_LABELS_UI[tier]}</span>
              </div>
              <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginTop: 4 }}>{HUB_COUNTS[tier]} hubs · {HUB_CARD_DESC[tier]}</div>
            </div>
            <div style={{ padding: '12px 18px' }}>
              {HUB_CARD_MODES[tier].map(mode => {
                const qty = fleet_per_hub[tier][mode] || 0
                if (qty === 0) return null
                return (
                  <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: MODE_META[mode].color }} />
                      <span style={{ fontFamily: F, fontSize: 12, color: C.text2 }}>{MODE_META[mode].label}</span>
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12, color: C.text1 }}>{qty}</span>
                  </div>
                )
              })}
              <div style={{ marginTop: 10 }}>
                {[['Charging points', hub_charging_per[tier]], ['Footprint', `${hub_footprint_per[tier].toLocaleString('de-DE')} m²`]].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{label}</span>
                    <span style={{ fontFamily: F, fontSize: 11, color: C.text1 }}>{value}</span>
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

function HubAreaBars() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {TIERS.map(tier => {
        const total = S_hub_area[tier]
        return (
          <div key={tier}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: HUB_COLORS_UI[tier] }} />
                <span style={{ fontFamily: F, fontSize: 13, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</span>
                <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>{HUB_COUNTS[tier]} hubs · {fmt(S_hub_area[tier] * HUB_COUNTS[tier])} m² total</span>
              </div>
              <span style={{ fontFamily: F, fontSize: 14, color: C.text1 }}>{Math.round(total)} m²</span>
            </div>
            <div style={{ height: 20, display: 'flex', borderRadius: 5, overflow: 'hidden', background: '#F0F0EE' }}>
              {COMP_KEYS.map(ck => {
                const val = AREA_MAPS[ck][tier]
                const pct = (val / total) * 100
                return (
                  <div key={ck} className="dp-bh" title={`${COMP_LABELS[ck]}: ${Math.round(val)} m²`} style={{
                    width: `${pct}%`, background: COMP_COLORS[ck],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {pct > 8 && <span style={{ fontFamily: F, fontSize: 9, color: 'white' }}>{Math.round(val)}</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
              {COMP_KEYS.map(ck => (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, background: COMP_COLORS[ck], borderRadius: 2 }} />
                  <span style={{ fontFamily: F, fontSize: 10, color: C.text3 }}>{COMP_LABELS[ck]}</span>
                  <span style={{ fontFamily: F, fontSize: 10, color: C.text2 }}>{Math.round(AREA_MAPS[ck][tier])} m²</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HubAreaDonut() {
  const modes = Object.keys(MODE_META)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {TIERS.map(tier => {
        const modeAreas = modes.map(m => ({ mode: m, val: (fleet_per_hub[tier][m] || 0) * FOOTPRINT_PER_UNIT[m] })).filter(x => x.val > 0)
        const total = modeAreas.reduce((s, x) => s + x.val, 0)
        if (total === 0) return <div key={tier} style={{ textAlign: 'center', padding: 20, color: C.text3, fontFamily: F, fontSize: 12 }}>{HUB_LABELS_UI[tier]}<br />no fleet area</div>
        const R = 48, r = 30, cx = 64, cy = 64
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
            <div style={{ fontFamily: F, fontSize: 12, color: HUB_COLORS_UI[tier], marginBottom: 5 }}>{HUB_LABELS_UI[tier]}</div>
            <svg width={128} height={128} style={{ overflow: 'visible' }}>
              {paths}
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fontWeight={300} fontFamily={F} fill={C.text1}>{Math.round(total)}</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fontFamily={F} fill={C.text3}>m² fleet</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '0 4px' }}>
              {modeAreas.map(({ mode, val }) => (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: MODE_META[mode].color }} />
                    <span style={{ fontFamily: F, fontSize: 10, color: C.text3 }}>{MODE_META[mode].label}</span>
                  </div>
                  <span style={{ fontFamily: F, fontSize: 10, color: C.text1 }}>{Math.round(val)} m²</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── SLIDE COMPONENTS ─────────────────────────────────────────────────────────
function S1_Overview() {
  return (
    <div>
      <Eyebrow>Part 1 · Baseline</Eyebrow>
      <h1 style={{ fontFamily: F, fontSize: 64, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px', lineHeight: 1.05 }}>Modal Distribution</h1>
      <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, maxWidth: 560, margin: '0 0 36px' }}>
        Nine central districts of Wolfsburg, accounting for {fmt(total_residents)} residents, {fmt(WORKERS)} daily workers,
        and an estimated {fmt(visitors)} visitors — totalling {fmt(D_total)} trips per day.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KCard label="Residents"       value={fmt(total_residents)} sub="9 districts · WOKS 2023"  color="#111111" />
        <KCard label="Workers in zone" value={fmt(WORKERS)}         sub="WOKS Arbeitsmarkt 2025"   color="#111111" />
        <KCard label="Daily visitors"  value={fmt(visitors)}        sub="MiD 2017 estimate"        color="#111111" />
        <KCard label="Total trips/day" value={fmt(D_total)}         sub="MiD 2017 formula"         color="#111111" />
      </div>
    </div>
  )
}

function S2_Demand() {
  return (
    <div>
      <Eyebrow>Step-by-step demand calculation · MiD 2017</Eyebrow>
      <SectionTitle>Transport Demand Formula</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Residents', val: total_residents, factor: `× ${T_RESIDENT}`, result: total_residents * T_RESIDENT, color: '#111111' },
          { label: 'Workers',   val: WORKERS,         factor: `× ${T_WORKER}`,   result: WORKERS * T_WORKER,          color: '#555555' },
          { label: 'Visitors',  val: visitors,        factor: `× ${T_VISITOR}`,  result: visitors * T_VISITOR,        color: '#888888' },
        ].map(({ label, val, factor, result, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: F, fontSize: 13, color: C.text2, width: 72 }}>{label}</span>
            <span style={{ fontFamily: F, fontSize: 13, color: C.text3, fontVariantNumeric: 'tabular-nums', width: 60 }}>{fmt(val)}</span>
            <span style={{ fontFamily: F, fontSize: 13, color: C.text3, width: 40 }}>{factor}</span>
            <span style={{ fontFamily: F, fontSize: 18, fontWeight: 300, color, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto', letterSpacing: '-0.3px' }}>= {fmt(result)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.text1, borderRadius: 8, marginTop: 4 }}>
          <span style={{ fontFamily: F, fontSize: 13, color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase' }}>D_total</span>
          <span style={{ fontFamily: F, fontSize: 28, fontWeight: 300, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{fmt(D_total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 8 }}>
          <span style={{ fontFamily: F, fontSize: 13, color: C.text3 }}>D_internal (65% intra-zone)</span>
          <span style={{ fontFamily: F, fontSize: 18, fontWeight: 300, color: C.text1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>{fmt(D_internal)}</span>
        </div>
      </div>
    </div>
  )
}

function S3_ModalDistricts() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
      <div>
        <Eyebrow>Share of daily trips · MiD 2017</Eyebrow>
        <SectionTitle>Modal Share</SectionTitle>
        <ModalShareChart />
      </div>
      <div>
        <Eyebrow>Residents per district · WOKS 2023</Eyebrow>
        <SectionTitle>District Population</SectionTitle>
        <DistrictChart />
      </div>
    </div>
  )
}

function S4_Hourly() {
  return (
    <div>
      <Eyebrow>Estimated weekday pattern · MiD 2017</Eyebrow>
      <SectionTitle>Hourly Trip Distribution</SectionTitle>
      <HourlyChart />
    </div>
  )
}

function S5_BaselineTable() {
  return (
    <div>
      <Eyebrow>All metrics from open statistical data</Eyebrow>
      <SectionTitle>Baseline Results</SectionTitle>
      <DataTable
        head={[{ label: 'Metric' }, { label: 'Value', align: 'right' }, { label: 'Source' }]}
        rows={BASELINE_RESULTS}
        renderRow={({ metric, value, source }, i) => (
          <tr key={metric} style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ padding: '10px 10px', color: C.text2 }}>{metric}</td>
            <td style={{ padding: '10px 10px', color: C.text1, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</td>
            <td style={{ padding: '10px 10px', color: C.text3 }}>{source}</td>
          </tr>
        )}
      />
    </div>
  )
}

function S6_FleetHero() {
  const cards = [
    { label: 'D_transport (net)',  value: fmt(D_transport),                                sub: `−${reduction_pct}% vs D_total` },
    { label: 'Total fleet',        value: fmt(total_fleet),                                 sub: 'all modes · peak hour' },
    { label: 'Cars replaced',      value: fmt(CARS_REPLACED),                              sub: 'baseline private cars/day' },
    { label: 'Replacement ratio',  value: `1 : ${replacement_ratio}`,                     sub: 'shared vehicle → private cars' },
    { label: 'Total charging pts', value: fmt(total_charging),                             sub: 'simultaneous' },
    { label: 'Walking filtered',   value: `${(WALKING_SHARE_INTERNAL * 100).toFixed(0)}%`, sub: 'internal trips not transported' },
  ]
  return (
    <div>
      <Eyebrow>Part 2 · Fleet Sizing</Eyebrow>
      <h2 style={{ fontFamily: F, fontSize: 56, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px', lineHeight: 1.05 }}>Post-Car Fleet</h2>
      <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, maxWidth: 560, margin: '0 0 32px' }}>
        Peak-hour demand determines how many vehicles must be on the street simultaneously.
        A walking filter removes {(WALKING_SHARE_INTERNAL * 100).toFixed(0)}% of internal trips,
        yielding {fmt(D_transport)} net trips/day served by vehicles.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cards.map(c => <KCard key={c.label} {...c} />)}
      </div>
    </div>
  )
}

function S7_Flow() {
  return (
    <div>
      <Eyebrow>D_total → inbound / internal transport / walking</Eyebrow>
      <SectionTitle>Trip Flow Decomposition</SectionTitle>
      <FlowChart />
    </div>
  )
}

function S8_ModeCards() {
  return (
    <div>
      <Eyebrow>On-street peak · total with reserve · trips/day</Eyebrow>
      <SectionTitle>Fleet by Mode</SectionTitle>
      <ModeCards />
    </div>
  )
}

function S9_OnStreet() {
  return (
    <div>
      <Eyebrow>On-street = (peak trips / capacity) × duration</Eyebrow>
      <SectionTitle>On-street Peak vs Total Fleet</SectionTitle>
      <OnStreetChart />
    </div>
  )
}

function S10_Replacement() {
  return (
    <div>
      <Eyebrow>49,648 private cars/day replaced by shared fleet</Eyebrow>
      <SectionTitle>Fleet Replacement</SectionTitle>
      <ReplacementChart />
    </div>
  )
}

function S11_DotMatrix() {
  return (
    <div>
      <Eyebrow>Visual scale comparison — each dot = 10 vehicles</Eyebrow>
      <SectionTitle>Dot Matrix</SectionTitle>
      <DotMatrix />
    </div>
  )
}

function S12_Charging() {
  return (
    <div>
      <Eyebrow>30% of fleet simultaneously charging · e-bike 50%</Eyebrow>
      <SectionTitle>Charging Points</SectionTitle>
      <ChargingChart />
    </div>
  )
}

function S13_FleetTable() {
  const rows = Object.entries(MODE_META).map(([mode, { label }]) => ({ mode, label, ...fleet[mode] }))
  return (
    <div>
      <Eyebrow>Full breakdown by mode</Eyebrow>
      <SectionTitle>Fleet Results Table</SectionTitle>
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
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[row.mode].color, flexShrink: 0 }} />
                <span style={{ color: C.text1 }}>{row.label}</span>
              </div>
            </td>
            <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.trips)}</td>
            <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text3, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.peak_hour)}</td>
            <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{row.on_street}</td>
            <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text1, fontVariantNumeric: 'tabular-nums' }}>{row.total}</td>
            <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{row.charging}</td>
          </tr>
        )}
      />
    </div>
  )
}

function S14_HubHero() {
  const cards = [
    { label: 'Hub L', value: String(hub_l_count), sub: 'large interchange hubs' },
    { label: 'Hub M', value: String(hub_m_count), sub: 'district mobility hubs' },
    { label: 'Hub S', value: String(hub_s_count), sub: 'neighbourhood micro-hubs' },
    { label: 'Total Charging', value: fmt(hub_total_charging), sub: 'charging points (all hubs)' },
    { label: 'Hub Footprint', value: fmt(hub_total_footprint), sub: `m²  (${hub_footprint_pct}% of zone)` },
    { label: 'Total Fleet', value: fmt(total_fleet), sub: 'vehicles + bikes' },
  ]
  return (
    <div>
      <Eyebrow>Part 3 · Hub Network</Eyebrow>
      <h2 style={{ fontFamily: F, fontSize: 56, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px', lineHeight: 1.05 }}>Hub Count &amp; Distribution</h2>
      <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, maxWidth: 560, margin: '0 0 32px' }}>
        Three hub tiers serve different functions: {hub_l_count} large interchange hubs anchor the zone,
        {hub_m_count} district hubs provide mid-scale coverage, and {hub_s_count} micro-hubs
        ensure walkable access within 200 m across the {ZONE_AREA_KM2} km² zone.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cards.map(c => <KCard key={c.label} {...c} />)}
      </div>
    </div>
  )
}

function S15_Heatmap() {
  return (
    <div>
      <Eyebrow>Units on a single hub · incl. 20% reserve</Eyebrow>
      <SectionTitle>Fleet per Hub — Heatmap</SectionTitle>
      <HubHeatmap />
    </div>
  )
}

function S16_HubBars() {
  return (
    <div>
      <Eyebrow>All vehicles assigned to each tier · stacked by mode</Eyebrow>
      <SectionTitle>Total Fleet by Hub Tier</SectionTitle>
      <HubBars />
    </div>
  )
}

function S17_HubCards() {
  return (
    <div>
      <Eyebrow>Vehicle mix, charging and footprint per single hub</Eyebrow>
      <SectionTitle>Hub Profile Cards</SectionTitle>
      <HubCards />
    </div>
  )
}

function S18_HubInfra() {
  const modes = Object.keys(MODE_META)
  return (
    <div>
      <Eyebrow>Tier total · per-hub allocation · charging · footprint</Eyebrow>
      <SectionTitle>Infrastructure Table</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${C.text1}` }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 400, color: C.text3, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Mode</th>
              {TIERS.map(t => (
                <th key={t} colSpan={2} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 400, color: HUB_COLORS_UI[t], fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', borderLeft: `1px solid ${C.border}` }}>
                  {HUB_LABELS_UI[t]} ({HUB_COUNTS[t]})
                </th>
              ))}
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: '5px 10px' }} />
              {TIERS.map(t => [
                <th key={`${t}-total`} style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: C.text3, fontWeight: 400, borderLeft: `1px solid ${C.border}` }}>Tier total</th>,
                <th key={`${t}-hub`}   style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: C.text3, fontWeight: 400 }}>Per hub</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {modes.map(mode => (
              <tr key={mode} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color, flexShrink: 0 }} />
                    <span style={{ color: C.text1 }}>{MODE_META[mode].label}</span>
                  </div>
                </td>
                {TIERS.map(t => [
                  <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: C.text3, borderLeft: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums' }}>{fleet_at_tier[t][mode] || 0}</td>,
                  <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', color: fleet_per_hub[t][mode] > 0 ? HUB_COLORS_UI[t] : C.text3, fontVariantNumeric: 'tabular-nums' }}>{fleet_per_hub[t][mode] > 0 ? fleet_per_hub[t][mode] : '–'}</td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function S19_AreaHero() {
  const cards = [
    { label: 'Hub L area', value: `${Math.round(S_hub_area.hub_l)} m²`, sub: `per hub · ${hub_l_count} hubs` },
    { label: 'Hub M area', value: `${Math.round(S_hub_area.hub_m)} m²`, sub: `per hub · ${hub_m_count} hubs` },
    { label: 'Hub S area', value: `${Math.round(S_hub_area.hub_s)} m²`, sub: `per hub · ${hub_s_count} hubs` },
    { label: 'Total footprint', value: `${fmt(area_total_all_hubs)} m²`, sub: `${area_pct_of_zone}% of 4 km² zone` },
    { label: 'Total hectares', value: `${(area_total_all_hubs / 10000).toFixed(2)} ha`, sub: 'combined hub land use' },
    { label: 'Circ. factor', value: `×${CIRCULATION_FACTOR.hub_s}–×${CIRCULATION_FACTOR.hub_l}`, sub: 'fleet area multiplier by tier' },
  ]
  return (
    <div>
      <Eyebrow>Part 4 · Hub Area</Eyebrow>
      <h2 style={{ fontFamily: F, fontSize: 48, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px', lineHeight: 1.05 }}>
        S_hub = S_fleet + S_circ + S_charging + S_program
      </h2>
      <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, maxWidth: 560, margin: '0 0 32px' }}>
        Each hub tier has a distinct spatial footprint. Combined, all {hub_l_count + hub_m_count + hub_s_count} hubs
        require {fmt(area_total_all_hubs)} m² — just {area_pct_of_zone}% of the zone.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cards.map(c => <KCard key={c.label} {...c} />)}
      </div>
    </div>
  )
}

function S20_AreaBars() {
  return (
    <div>
      <Eyebrow>Fleet · circulation · charging · program per hub</Eyebrow>
      <SectionTitle>Area Breakdown</SectionTitle>
      <HubAreaBars />
    </div>
  )
}

function S21_AreaDetails() {
  const map = { S_fleet_area, S_circ_area, S_charging_area, S_program_area, S_hub_area }
  const tableRows = [
    { label: 'S_fleet',     key: 'S_fleet_area',    formula: 'Σ(units × m²/unit)',          accent: false },
    { label: 'S_circ',      key: 'S_circ_area',     formula: 'S_fleet × (factor − 1)',       accent: false },
    { label: 'S_charging',  key: 'S_charging_area', formula: 'Σ(chargers × station m²)',     accent: false },
    { label: 'S_program',   key: 'S_program_area',  formula: '10% of (fleet+circ+charging)', accent: false },
    { label: 'S_hub TOTAL', key: 'S_hub_area',      formula: 'Sum of all components',        accent: true  },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
      <div>
        <Eyebrow>How S_fleet is distributed across vehicle types</Eyebrow>
        <SectionTitle size={28}>Fleet Parking by Mode</SectionTitle>
        <HubAreaDonut />
      </div>
      <div>
        <Eyebrow>Full breakdown · circulation factors · per-hub and total</Eyebrow>
        <SectionTitle size={28}>Hub Area Table</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F, fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${C.text1}` }}>
                <th style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 400, color: C.text3, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Component</th>
                {TIERS.map(t => <th key={t} style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 400, color: HUB_COLORS_UI[t], fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{HUB_LABELS_UI[t]}</th>)}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ label, key, formula, accent }) => (
                <tr key={label} style={{ borderBottom: `1px solid ${C.border}`, background: accent ? '#F5F5F3' : 'transparent' }}>
                  <td style={{ padding: '8px', fontWeight: accent ? 400 : 400, color: C.text1 }}>{label}</td>
                  {TIERS.map(t => <td key={t} style={{ padding: '8px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{Math.round(map[key][t])} m²</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Methodology CTA — last main slide
function S22_MethodCTA({ onOpenMeth }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
      <div style={{ fontFamily: F, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 20 }}>Analysis complete · 4 parts</div>
      <h2 style={{ fontFamily: F, fontSize: 56, fontWeight: 400, color: C.text1, margin: '0 0 16px', letterSpacing: '-0.5px', lineHeight: 1.05, maxWidth: 520 }}>
        How were these numbers made?
      </h2>
      <p style={{ fontFamily: F, fontSize: 15, color: C.text2, lineHeight: 1.75, maxWidth: 440, margin: '0 0 48px' }}>
        Every calculation is deterministic — no simulation required.
        The methodology appendix explains each formula step by step.
      </p>
      <button
        onClick={onOpenMeth}
        style={{
          fontFamily: F, fontSize: 13, fontWeight: 400, color: '#fff',
          background: C.text1, border: 'none', borderRadius: 8,
          padding: '14px 32px', cursor: 'pointer', letterSpacing: '0.06em',
          textTransform: 'uppercase', transition: `all 0.3s cubic-bezier(0.16,1,0.3,1)`,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = C.text1; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        Open Methodology →
      </button>
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 1, height: 40, background: C.border }} />
        <span style={{ fontFamily: F, fontSize: 11, color: C.text3 }}>5 sections continue below</span>
        <div style={{ width: 1, height: 40, background: C.border }} />
      </div>
    </div>
  )
}

// ─── METHODOLOGY SLIDES ───────────────────────────────────────────────────────
function FormulaBox({ label, formula, result, note }) {
  return (
    <div style={{ background: '#F5F5F3', borderRadius: 8, padding: '13px 16px', border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: F, fontSize: 10, fontWeight: 400, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{formula}</div>
      {result && <div style={{ fontFamily: F, fontSize: 13, color: C.text1, marginTop: 5 }}>{result}</div>}
      {note && <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginTop: 3 }}>{note}</div>}
    </div>
  )
}

function M1_Hero() {
  return (
    <div>
      <Eyebrow>Appendix · Methods</Eyebrow>
      <h2 style={{ fontFamily: F, fontSize: 56, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px', lineHeight: 1.05 }}>How the Numbers Were Made</h2>
      <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, maxWidth: 560 }}>
        Each section builds on publicly available data and standard urban transport benchmarks.
        The calculations are deterministic — no simulation or model calibration is required.
      </p>
    </div>
  )
}

function M2_Baseline() {
  return (
    <div>
      <Eyebrow>Part 1 · Baseline</Eyebrow>
      <SectionTitle>Transport Demand</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 600 }}>
          Population figures come from <strong>WOKS 2023</strong> for the nine central districts.
          Worker count ({fmt(WORKERS)}) is from <strong>WOKS Arbeitsmarktbericht 2025</strong>.
          Visitor volume is estimated as 20% of combined residents and workers (MiD 2017 pattern for mid-size German cities).
          Trip generation rates from <strong>MiD 2017 (BMVI)</strong>: residents 3.2 trips/day, workers 2.1, visitors 1.5.
          Modal split uses MiD 2017 baseline with private-car share raised to 62% from <strong>KBA 2023</strong>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormulaBox label="D_total formula" formula={`residents × 3.2 + workers × 2.1 + visitors × 1.5`} result={`= ${fmt(D_total)} trips/day`} />
          <FormulaBox label="Visitors estimate" formula={`(${fmt(total_residents)} + ${fmt(WORKERS)}) × 20%`} result={`= ${fmt(visitors)} visitors/day`} />
          <FormulaBox label="Peak hour (8–9 h)" formula={`D_total × 8.5% MiD profile`} result={`= ${fmt(peak_hour_trips)} trips/h`} />
          <FormulaBox label="Private cars/day" formula={`D_total × 62% ÷ 1.3 occupancy`} result={`= ${fmt(car_vehicles_per_day)} vehicles`} />
        </div>
      </div>
    </div>
  )
}

function M3_Fleet() {
  return (
    <div>
      <Eyebrow>Part 2 · Fleet Sizing</Eyebrow>
      <SectionTitle>From Trips to Vehicles</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 600 }}>
          D_total splits into <strong>inbound</strong> and <strong>internal</strong> flows.
          Inbound covers workers commuting from outside (50% of worker trips) and visitors arriving from outside (80% of visitor trips).
          Of internal trips, 60% are assumed walkable and filtered out.
          Fleet size follows a <strong>peak-hour utilisation formula</strong>: vehicles on-street at peak =
          peak trips ÷ capacity × trip duration. A reserve factor (1.15–1.35) converts to total fleet.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormulaBox label="Net transport demand" formula={`inbound + internal transport\n(after walking filter)`} result={`D_transport = ${fmt(D_transport)}`} />
          <FormulaBox label="Walking filtered out" formula={`internal trips × 60% walkable`} result={`= ${fmt(walking_filtered)} trips/day`} />
          <FormulaBox label="On-street fleet (per mode)" formula={`⌈(peak_trips ÷ capacity) × trip_h⌉`} result={`e.g. e-bike: ${fleet.e_bike.on_street} units`} />
          <FormulaBox label="Total fleet (per mode)" formula={`on_street × peak_factor`} result={`total: ${fmt(total_fleet)} vehicles`} />
        </div>
      </div>
    </div>
  )
}

function M4_Hubs() {
  return (
    <div>
      <Eyebrow>Part 3 · Hub Network</Eyebrow>
      <SectionTitle>Hub Counts from Geometry</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 600 }}>
          Hub counts derive from <strong>coverage geometry</strong>, not fleet demand alone.
          A 1.35× overlap factor accounts for irregular street grids and dead zones.
          Hub L is constrained by existing infrastructure (max 6 large parking structures).
          Hub M is the maximum of geometric estimate (r = 400 m) and shuttle-fleet requirement.
          Hub S follows purely from geometry: enough micro-hubs so no resident is more than 200 m from a docking point.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <FormulaBox label="Hub S" formula={`⌈(4,000,000 m² ÷ π×200²) × 1.35⌉`} result={`= ${hub_s_count} hubs`} note="200 m walking radius" />
          <FormulaBox label="Hub M" formula={`max(geometry r=400m,\nshuttle_fleet ÷ 3)`} result={`= ${hub_m_count} hubs`} note="400 m, shuttle coverage" />
          <FormulaBox label="Hub L" formula={`min(⌈(bus+car-share) ÷ 8⌉, 6)`} result={`= ${hub_l_count} hubs`} note="capped — existing garages" />
        </div>
      </div>
    </div>
  )
}

function M5_Area() {
  return (
    <div>
      <Eyebrow>Part 4 · Hub Area</Eyebrow>
      <SectionTitle>Spatial Footprint Formula</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormulaBox label="S_fleet — parking footprint" formula={`Σ (units_per_hub × m²/vehicle)`} note="2.5 m² e-bike · 10 m² pod · 35 m² shuttle · 60 m² bus · 15 m² car" />
          <FormulaBox label="S_circ — circulation" formula={`S_fleet × (factor − 1)`} note="×1.6 Hub L · ×1.4 Hub M · ×1.2 Hub S" />
          <FormulaBox label="S_charging — charging stations" formula={`Σ ⌈units × rate⌉ × station_m²`} note="0.5 m² e-bike dock · 4 m² EV charger" />
          <FormulaBox label="S_program — shelter & services" formula={`(S_fleet + S_circ + S_charging) × 10%`} note="waiting areas, info points, shelter" />
        </div>
        <p style={{ fontFamily: F, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 600 }}>
          Total land use across all {hub_l_count + hub_m_count + hub_s_count} hubs is{' '}
          <strong>{fmt(area_total_all_hubs)} m²</strong> ({(area_total_all_hubs / 10000).toFixed(2)} ha),
          equivalent to {area_pct_of_zone}% of the 4 km² project zone.
        </p>
        <div style={{ padding: '16px 20px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <p style={{ fontFamily: F, fontSize: 11, color: C.text3, margin: 0, lineHeight: 1.9 }}>
            <strong style={{ color: C.text2 }}>Baseline:</strong> MiD 2017 (BMVI) · WOKS Wolfsburg 2023/2025 · KBA 2023<br />
            <strong style={{ color: C.text2 }}>Fleet:</strong> Nextbike operational data · UITP autonomous shuttle &amp; bus benchmarks · MOIA Hamburg · Share Now / Stadtmobil<br />
            <strong style={{ color: C.text2 }}>Hub geometry:</strong> Coverage radius 200 m (S) / 400 m (M) · 1.35× overlap factor · max 6 Hub L (existing parking garages)<br />
            <strong style={{ color: C.text2 }}>Hub area:</strong> Footprint/unit + circulation factor + charging stations + 10% program
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE REGISTRY ───────────────────────────────────────────────────────────
const MAIN_SLIDES = [
  { id: 's1',  part: 'Part 1',  label: 'Overview',            Component: S1_Overview },
  { id: 's2',  part: 'Part 1',  label: 'Demand formula',      Component: S2_Demand },
  { id: 's3',  part: 'Part 1',  label: 'Modal & Districts',   Component: S3_ModalDistricts },
  { id: 's4',  part: 'Part 1',  label: 'Hourly distribution', Component: S4_Hourly },
  { id: 's5',  part: 'Part 1',  label: 'Baseline table',      Component: S5_BaselineTable },
  { id: 's6',  part: 'Part 2',  label: 'Fleet overview',      Component: S6_FleetHero },
  { id: 's7',  part: 'Part 2',  label: 'Trip flow',           Component: S7_Flow },
  { id: 's8',  part: 'Part 2',  label: 'Mode cards',          Component: S8_ModeCards },
  { id: 's9',  part: 'Part 2',  label: 'On-street vs total',  Component: S9_OnStreet },
  { id: 's10', part: 'Part 2',  label: 'Replacement',         Component: S10_Replacement },
  { id: 's11', part: 'Part 2',  label: 'Dot matrix',          Component: S11_DotMatrix },
  { id: 's12', part: 'Part 2',  label: 'Charging points',     Component: S12_Charging },
  { id: 's13', part: 'Part 2',  label: 'Fleet table',         Component: S13_FleetTable },
  { id: 's14', part: 'Part 3',  label: 'Hub overview',        Component: S14_HubHero },
  { id: 's15', part: 'Part 3',  label: 'Hub heatmap',         Component: S15_Heatmap },
  { id: 's16', part: 'Part 3',  label: 'Fleet by tier',       Component: S16_HubBars },
  { id: 's17', part: 'Part 3',  label: 'Hub profiles',        Component: S17_HubCards },
  { id: 's18', part: 'Part 3',  label: 'Infrastructure',      Component: S18_HubInfra },
  { id: 's19', part: 'Part 4',  label: 'Area overview',       Component: S19_AreaHero },
  { id: 's20', part: 'Part 4',  label: 'Area breakdown',      Component: S20_AreaBars },
  { id: 's21', part: 'Part 4',  label: 'Area details',        Component: S21_AreaDetails },
  { id: 's22', part: 'End',     label: 'Methodology →',       Component: null, cta: true },
]

const METH_SLIDES = [
  { id: 'm1', label: 'Introduction',       Component: M1_Hero },
  { id: 'm2', label: 'Transport Demand',   Component: M2_Baseline },
  { id: 'm3', label: 'Fleet Sizing',       Component: M3_Fleet },
  { id: 'm4', label: 'Hub Network',        Component: M4_Hubs },
  { id: 'm5', label: 'Hub Area & Sources', Component: M5_Area },
]

// ─── NAV DOTS ─────────────────────────────────────────────────────────────────
function NavDots({ total, current, onSelect }) {
  return (
    <div style={{
      position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 7, zIndex: 20,
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          onClick={() => onSelect(i)}
          title={`Slide ${i + 1}`}
          style={{
            width: 5, height: 5, borderRadius: '50%', cursor: 'pointer',
            background: i === current ? '#111111' : 'rgba(0,0,0,0.18)',
            transform: i === current ? 'scale(1.6)' : 'scale(1)',
            transition: `all 0.3s ${EASE}`,
          }}
        />
      ))}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DataPanel() {
  const [slide, setSlide] = useState(0)
  const [showMeth, setShowMeth] = useState(false)
  const [methSlide, setMethSlide] = useState(0)
  const [modeTransition, setModeTransition] = useState(false)
  const containerRef = useRef(null)
  const slideRef = useRef(null)
  const lastNav = useRef(0)
  const COOLDOWN = 750

  const slides = showMeth ? METH_SLIDES : MAIN_SLIDES
  const current = showMeth ? methSlide : slide
  const setCurrent = showMeth ? setMethSlide : setSlide

  const navigate = useCallback((dir) => {
    const now = Date.now()
    if (now - lastNav.current < COOLDOWN) return
    lastNav.current = now
    setCurrent(c => {
      const next = c + dir
      if (next < 0 || next >= slides.length) return c
      return next
    })
  }, [slides.length, setCurrent])

  const openMeth = useCallback(() => {
    setModeTransition(true)
    setTimeout(() => {
      setShowMeth(true)
      setMethSlide(0)
      setTimeout(() => setModeTransition(false), 50)
    }, 300)
  }, [])

  const closeMeth = useCallback(() => {
    setModeTransition(true)
    setTimeout(() => {
      setShowMeth(false)
      setTimeout(() => setModeTransition(false), 50)
    }, 300)
  }, [])

  // Wheel navigation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = e => {
      // Allow internal scroll only if slide content scrolls and not at boundary
      const activeSlide = slideRef.current
      if (activeSlide) {
        const { scrollTop, scrollHeight, clientHeight } = activeSlide
        const canScroll = scrollHeight > clientHeight + 4
        const goingDown = e.deltaY > 0
        if (canScroll) {
          if (goingDown && scrollTop + clientHeight < scrollHeight - 4) return
          if (!goingDown && scrollTop > 4) return
        }
      }
      e.preventDefault()
      navigate(e.deltaY > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [navigate])

  // Keyboard navigation
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navigate(1) }
      if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); navigate(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const currentSlideInfo = slides[current]
  const currentPart = !showMeth ? (MAIN_SLIDES[slide]?.part || '') : 'Methodology'

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.bg, zIndex: 10, overflow: 'hidden' }}>
      <style>{CSS_DP}</style>

      {/* Left strip */}
      <div style={{
        width: 160, flexShrink: 0, background: C.bg,
        borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        padding: '32px 16px 24px',
      }}>
        <div style={{ fontFamily: F, fontSize: 10, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 24 }}>
          Capacity Analysis
        </div>

        {showMeth ? (
          <button
            onClick={closeMeth}
            style={{ fontFamily: F, fontSize: 12, color: C.text2, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: 20 }}
          >
            ← Back to Analysis
          </button>
        ) : null}

        <div style={{ fontFamily: F, fontSize: 13, color: C.text1, marginBottom: 4 }}>
          {showMeth ? 'Methodology' : currentPart}
        </div>
        <div style={{ fontFamily: F, fontSize: 11, color: C.text3, marginBottom: 32 }}>
          {currentSlideInfo?.label}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrent(i)}
              style={{
                fontFamily: F, fontSize: 11, color: i === current ? C.text1 : C.text3,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 0', textAlign: 'left',
                borderLeft: `2px solid ${i === current ? C.text1 : 'transparent'}`,
                paddingLeft: 8, transition: `all 0.2s ease`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontFamily: F, fontSize: 10, color: C.text3, lineHeight: 1.7 }}>
            {['MiD 2017', 'WOKS 2023/2025', 'KBA 2023', 'UITP', 'MOIA Hamburg'].map(s => <div key={s}>{s}</div>)}
          </div>
        </div>
      </div>

      {/* Slides area */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Slide track */}
        <div
          style={{
            position: 'absolute',
            left: 0, right: 0,
            top: `${-current * 100}%`,
            transition: `top 0.7s ${EASE}`,
            opacity: modeTransition ? 0 : 1,
            transitionProperty: modeTransition ? 'opacity' : 'top, opacity',
          }}
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              ref={i === current ? slideRef : null}
              className={i === current ? 'dp-in' : ''}
              style={{
                position: 'absolute',
                top: `${i * 100}%`,
                left: 0, right: 0,
                height: '100%',
                overflowY: s.cta ? 'hidden' : 'auto',
              }}
            >
              <div style={{ padding: '52px 56px 64px', maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box', ...(s.cta ? { height: '100%' } : {}) }}>
                {s.cta ? <S22_MethodCTA onOpenMeth={openMeth} /> : <s.Component />}
              </div>
            </div>
          ))}
        </div>

        {/* Nav dots */}
        <NavDots
          total={slides.length}
          current={current}
          onSelect={setCurrent}
        />

        {/* Slide counter */}
        <div style={{
          position: 'absolute', bottom: 24, left: 40,
          fontFamily: F, fontSize: 11, color: C.text3, letterSpacing: '0.08em',
        }}>
          {current + 1} / {slides.length}
        </div>

        {/* Arrow hint (hidden after first slide) */}
        {current < slides.length - 1 && (
          <div style={{
            position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
            fontFamily: F, fontSize: 11, color: C.text3, letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6,
          }}>
            <span>↓</span>
            <span>scroll or arrow key</span>
          </div>
        )}
      </div>
    </div>
  )
}
