import React, { useState, useEffect, useRef } from 'react'

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
const SERIF = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const C = { bg: '#FAFAF9', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }
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
    <div id={id} className="dp-a" style={{ padding: '30px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 500, marginBottom: 16 }}>
        {eyebrow && <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{eyebrow}</div>}
        <h2 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, color: C.text1, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function KCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 300, color: color || C.text1, lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 400, color: C.text1, marginTop: 7, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function Rule({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '56px 0 44px' }}>
      <div style={{ width: 28, height: 2, background: C.text1 }} />
      <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 400, color: C.text1, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
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
              <th key={label} style={{ textAlign: align || 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</th>
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
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 4 }}>{fmt(D_total * share)} trips/day</div>
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
          <div style={{ fontFamily: SANS, width: 112, fontSize: 12, color: C.text2, flexShrink: 0 }}>{name}</div>
          <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(pop / maxPop) * 100}%`, height: '100%', background: '#2980B9', borderRadius: 3, transitionDelay: `${i * 35}ms` }} />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, width: 44, textAlign: 'right', flexShrink: 0 }}>{pop.toLocaleString('de-DE')}</div>
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
        {[0, 4, 8, 12, 16, 20, 23].map(h => <span key={h} style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>{h}h</span>)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[['#E63946', 'Peak (7–9h, 16–18h)'], ['#2980B9', 'Off-peak']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
            <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{l}</span>
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
      <div style={{ padding: '14px 18px', background: C.text1, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, color: '#fff' }}>D_total</span>
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: '#E63946' }}>{fmt(D_total)} trips/day</span>
      </div>
      {flows.map(({ label, value, color, sub }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.text1, fontWeight: 500 }}>{label}</span>
              <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginLeft: 8 }}>{sub}</span>
            </div>
            <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color }}>{fmt(value)}</span>
          </div>
          <div style={{ height: 9, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
            <div className="dp-bh" style={{ width: `${(value / maxVal) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <div style={{ padding: '14px 18px', background: 'rgba(10,126,69,0.05)', border: '1px solid rgba(10,126,69,0.16)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: '#0A7E45' }}>D_transport (net)</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginLeft: 8 }}>inbound + internal transport</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, color: '#0A7E45' }}>{fmt(D_transport)}</div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>−{reduction_pct}% vs D_total</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trips/day by mode</div>
        {Object.entries(MODE_META).map(([mode, { label, color }]) => {
          const f = fleet[mode]
          return (
            <div key={mode} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{label}</span>
                  {f.inbound > 0 && <span style={{ fontFamily: SANS, fontSize: 10, color: '#E63946', background: 'rgba(230,57,70,0.07)', padding: '1px 6px', borderRadius: 4 }}>inbound</span>}
                  {f.internal > 0 && <span style={{ fontFamily: SANS, fontSize: 10, color: '#2980B9', background: 'rgba(41,128,185,0.07)', padding: '1px 6px', borderRadius: 4 }}>internal</span>}
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
          <div key={key} style={{ background: C.card, borderRadius: 10, padding: '16px 16px', border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}` }}>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
            <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: C.text1, letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(f.total)}</div>
            <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, marginTop: 2, marginBottom: 12 }}>total fleet</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[['On-street', f.on_street], ['Peak trips/h', f.peak_hour], ['Charging pts', f.charging]].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{lbl}</span>
                  <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: C.text2 }}>{fmt(val)}</span>
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
              <span style={{ fontFamily: SANS, fontSize: 12, color: C.text3 }}>
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
            <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{l}</span>
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
        <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Baseline</div>
        <div className="dp-bv" style={{ width: BAR_W, height: Math.round((CARS_REPLACED / scaleMax) * 260), background: '#E63946', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10 }}>
          <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: '#fff' }}>{fmt(CARS_REPLACED)}</span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: '#E63946', fontWeight: 600, marginTop: 6 }}>Private cars</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Post-Car</div>
        <div className="dp-bv" style={{ width: BAR_W, height: Math.round((total_fleet / scaleMax) * 260), borderRadius: '6px 6px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
          {segments.map(({ mode, color, val }) => (
            <div key={mode} style={{ flex: val, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {val > 150 && <span style={{ fontFamily: SANS, fontSize: 9, color: '#fff', fontWeight: 600 }}>{fmt(val)}</span>}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: C.text1, fontWeight: 600, marginTop: 6 }}>Shared fleet</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{fmt(total_fleet)} units</div>
      </div>
      <div style={{ flex: 1, paddingBottom: 28 }}>
        <div style={{ padding: '14px 18px', background: 'rgba(10,126,69,0.05)', border: '1px solid rgba(10,126,69,0.14)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: '#0A7E45', letterSpacing: '-0.02em' }}>1 : {replacement_ratio}</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: '#2D6A4F', marginTop: 3 }}>shared vehicle replaces {replacement_ratio} private cars</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {segments.map(({ mode, color, label, val }) => (
            <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontFamily: SANS, fontSize: 12, color: C.text2, flex: 1 }}>{label}</span>
              <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.text1 }}>{fmt(val)}</span>
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
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: '#E63946', marginBottom: 8 }}>
          Private Cars — {fmt(CARS_REPLACED)} <span style={{ fontWeight: 400, color: C.text3 }}>(each dot = {UNIT} vehicles)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(carDots, () => '#E63946')}</div>
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.text1, marginBottom: 8 }}>
          Post-Car Fleet — {fmt(total_fleet)} <span style={{ fontWeight: 400, color: C.text3 }}>(each dot = {UNIT} vehicles)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(fleetDots, fleetColorFn)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {modeOrder.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: MODE_META[m].color }} />
              <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{MODE_META[m].label}</span>
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
      <div style={{ marginTop: 8, padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
    { label: 'Hub L', value: String(hub_l_count), sub: 'large interchange hubs', color: HUB_COLORS_UI.hub_l },
    { label: 'Hub M', value: String(hub_m_count), sub: 'district mobility hubs', color: HUB_COLORS_UI.hub_m },
    { label: 'Hub S', value: String(hub_s_count), sub: 'neighbourhood micro-hubs', color: HUB_COLORS_UI.hub_s },
    { label: 'Total Charging', value: fmt(hub_total_charging), sub: 'charging points (all hubs)', color: '#2980B9' },
    { label: 'Hub Footprint', value: fmt(hub_total_footprint), sub: `m²  (${hub_footprint_pct}% of zone)`, color: '#E67E22' },
    { label: 'Total Fleet', value: fmt(total_fleet), sub: 'vehicles + bikes', color: '#8E44AD' },
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
            <th style={{ width: 120, textAlign: 'left', fontFamily: SANS, fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 8px 10px' }} />
            {TIERS.map(t => (
              <th key={t} style={{ textAlign: 'center', fontFamily: SANS, fontSize: 12, fontWeight: 700, color: HUB_COLORS_UI[t], padding: '0 0 10px', letterSpacing: '-0.01em' }}>
                {HUB_LABELS_UI[t]}<br />
                <span style={{ fontWeight: 400, color: C.text3, fontSize: 10 }}>{HUB_COUNTS[t]} hubs</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modes.map(mode => (
            <tr key={mode}>
              <td style={{ fontFamily: SANS, fontSize: 12, color: C.text2, padding: '0 8px 0 0', whiteSpace: 'nowrap' }}>
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
                  <td key={t} style={{ textAlign: 'center', padding: '10px 6px', background: bg, borderRadius: 8, fontFamily: SANS, fontSize: 14, fontWeight: 700, color: dark ? '#fff' : (val > 0 ? C.text1 : C.text3), minWidth: 80 }}>
                    {val > 0 ? val : '–'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 10 }}>Units per single hub · incl. 20% reserve</div>
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
                      {segH > 20 && <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: '#fff' }}>{val}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: HUB_COLORS_UI[tier] }}>{HUB_LABELS_UI[tier]}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{HUB_COUNTS[tier]} hubs · {fmt(total)} total</div>
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 40 }}>
        {modes.map(mode => (
          <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, background: MODE_META[mode].color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.text2 }}>{MODE_META[mode].label}</span>
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
  hub_l: 'Large interchange · parking garage / transit node',
  hub_m: 'District hub · street-level, covered',
  hub_s: 'Micro-hub · on-street docking point',
}

function HubCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {TIERS.map(tier => {
        const color = HUB_COLORS_UI[tier]
        return (
          <div key={tier} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: C.text1 }}>{HUB_LABELS_UI[tier]}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.text3, marginTop: 5 }}>{HUB_COUNTS[tier]} hubs · {HUB_CARD_DESC[tier]}</div>
            </div>
            <div style={{ padding: '14px 20px' }}>
              {HUB_CARD_MODES[tier].map(mode => {
                const qty = fleet_per_hub[tier][mode] || 0
                if (qty === 0) return null
                return (
                  <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color }} />
                      <span style={{ fontFamily: SANS, fontSize: 13, color: C.text2 }}>{MODE_META[mode].label}</span>
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1 }}>{qty}</span>
                  </div>
                )
              })}
              <div style={{ marginTop: 12 }}>
                {[['Charging points', hub_charging_per[tier]], ['Footprint', `${hub_footprint_per[tier].toLocaleString('de-DE')} m²`]].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: C.text3 }}>{label}</span>
                    <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: C.text1 }}>{value}</span>
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mode</th>
            {TIERS.map(t => (
              <th key={t} colSpan={2} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: HUB_COLORS_UI[t], fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', borderLeft: `1px solid ${C.border}` }}>
                {HUB_LABELS_UI[t]} ({HUB_COUNTS[t]})
              </th>
            ))}
          </tr>
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFAF9' }}>
            <th style={{ padding: '5px 10px' }} />
            {TIERS.map(t => [
              <th key={`${t}-total`} style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: C.text3, fontWeight: 600, borderLeft: `1px solid ${C.border}` }}>Tier total</th>,
              <th key={`${t}-hub`}   style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: C.text3, fontWeight: 600 }}>Per hub</th>,
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
          <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(41,128,185,0.04)' }}>
            <td style={{ padding: '9px 10px', fontWeight: 600, color: '#2980B9', fontSize: 12 }}>Charging pts / hub</td>
            {TIERS.map(t => [
              <td key={`${t}-total`} style={{ padding: '9px 6px', textAlign: 'right', color: C.text3, borderLeft: `1px solid ${C.border}` }}>–</td>,
              <td key={`${t}-hub`}   style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: '#2980B9' }}>{hub_charging_per[t]}</td>,
            ])}
          </tr>
          <tr style={{ background: 'rgba(230,126,34,0.04)' }}>
            <td style={{ padding: '9px 10px', fontWeight: 600, color: '#E67E22', fontSize: 12 }}>Footprint / hub (m²)</td>
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
    { label: 'Hub L area', value: `${Math.round(S_hub_area.hub_l)} m²`, sub: `per hub · ${hub_l_count} hubs`, color: HUB_COLORS_UI.hub_l },
    { label: 'Hub M area', value: `${Math.round(S_hub_area.hub_m)} m²`, sub: `per hub · ${hub_m_count} hubs`, color: HUB_COLORS_UI.hub_m },
    { label: 'Hub S area', value: `${Math.round(S_hub_area.hub_s)} m²`, sub: `per hub · ${hub_s_count} hubs`, color: HUB_COLORS_UI.hub_s },
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
                <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{HUB_COUNTS[tier]} hubs · {fmt(S_hub_area[tier] * HUB_COUNTS[tier])} m² total</span>
              </div>
              <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: C.text1 }}>{Math.round(total)} m²</span>
            </div>
            <div style={{ height: 22, display: 'flex', borderRadius: 6, overflow: 'hidden', background: '#F5F5F3' }}>
              {COMP_KEYS_AREA.map(ck => {
                const val = AREA_MAPS[ck][tier]
                const pct = (val / total) * 100
                return (
                  <div key={ck} className="dp-bh" title={`${COMP_LABELS_AREA[ck]}: ${Math.round(val)} m²`} style={{
                    width: `${pct}%`, background: COMP_COLORS_AREA[ck],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {pct > 8 && <span style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: 'white' }}>{Math.round(val)}</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              {COMP_KEYS_AREA.map(ck => (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, background: COMP_COLORS_AREA[ck], borderRadius: 2 }} />
                  <span style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>{COMP_LABELS_AREA[ck]}</span>
                  <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, color: C.text2 }}>{Math.round(AREA_MAPS[ck][tier])} m²</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div style={{ padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text1 }}>All hubs combined</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#E67E22' }}>{fmt(area_total_all_hubs)} m²</div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{area_pct_of_zone}% of zone · {(area_total_all_hubs / 10000).toFixed(2)} ha</div>
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
        if (total === 0) return <div key={tier} style={{ textAlign: 'center', padding: 20, color: C.text3, fontFamily: SANS, fontSize: 12 }}>{HUB_LABELS_UI[tier]}<br />no fleet area</div>
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
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fontFamily="system-ui, sans-serif" fill={C.text3}>m² fleet</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '0 8px' }}>
              {modeAreas.map(({ mode, val }) => (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: MODE_META[mode].color }} />
                    <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{MODE_META[mode].label}</span>
                  </div>
                  <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: C.text1 }}>{Math.round(val)} m²</span>
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
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Component</th>
            {TIERS.map(t => <th key={t} style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, color: HUB_COLORS_UI[t], fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{HUB_LABELS_UI[t]}</th>)}
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Formula</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(({ label, key, formula, accent }) => (
            <tr key={label} style={{ borderTop: accent ? `2px solid ${C.border}` : undefined, borderBottom: `1px solid ${C.border}`, background: accent ? 'rgba(10,126,69,0.04)' : 'transparent' }}>
              <td style={{ padding: '10px 10px', fontWeight: accent ? 700 : 500, color: accent ? '#0A7E45' : C.text1 }}>{label}</td>
              {TIERS.map(t => <td key={t} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: accent ? 700 : 400, color: accent ? HUB_COLORS_UI[t] : C.text2, fontVariantNumeric: 'tabular-nums' }}>{Math.round(map[key][t])} m²</td>)}
              <td style={{ padding: '10px 10px', color: C.text3, fontSize: 11 }}>{formula}</td>
            </tr>
          ))}
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFAF9' }}>
            <td style={{ padding: '10px 10px', color: C.text3, fontSize: 12 }}>Circ. factor</td>
            {TIERS.map(t => <td key={t} style={{ padding: '10px 10px', textAlign: 'right', color: C.text3, fontSize: 12 }}>×{CIRCULATION_FACTOR[t]}</td>)}
            <td style={{ padding: '10px 10px', color: C.text3, fontSize: 11 }}>driveways + maneuvering</td>
          </tr>
          <tr style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: '10px 10px', fontWeight: 600, color: C.text1 }}>All hubs (×count)</td>
            {TIERS.map(t => <td key={t} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: C.text1, fontVariantNumeric: 'tabular-nums' }}>{fmt(S_hub_area[t] * HUB_COUNTS[t])} m²</td>)}
            <td style={{ padding: '10px 10px', color: C.text3, fontSize: 11 }}>S_hub × hub count</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}



// ─── FULLSCREEN SLIDE SYSTEM ─────────────────────────────────────────────────
const CSS_SLIDES = `
@keyframes dp-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dp-slide { animation: dp-in 0.36s cubic-bezier(.4,0,.2,1) both; }
`

// Draggable right-side scroll handle
function SlideHandle({ total, slide, onGo }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)

  const getSlideFromY = (clientY) => {
    const track = trackRef.current
    if (!track) return slide
    const { top, height } = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientY - top) / height))
    return Math.round(ratio * (total - 1))
  }

  const startDrag = (e) => {
    dragging.current = true
    e.preventDefault()
    const onMove = (me) => { if (dragging.current) onGo(getSlideFromY(me.clientY)) }
    const onUp   = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const thumbPct = total > 1 ? (slide / (total - 1)) * 100 : 0

  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, display: 'flex', justifyContent: 'center', padding: '20px 0', boxSizing: 'border-box', zIndex: 20 }}>
      <div ref={trackRef} onClick={(e) => onGo(getSlideFromY(e.clientY))}
        style={{ width: 2, background: C.border, borderRadius: 1, position: 'relative', cursor: 'pointer', flex: 1 }}>
        <div onMouseDown={startDrag}
          style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%) translateY(-50%)', top: `${thumbPct}%`,
            width: 8, height: 32, background: C.text1, borderRadius: 4, cursor: 'grab', transition: 'top 0.25s ease' }} />
      </div>
    </div>
  )
}

// Consistent slide frame: header always at same top position, content fills remaining space
function Slide({ eyebrow, title, sub, children }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '52px 56px 36px 56px', boxSizing: 'border-box', maxWidth: 960, margin: '0 auto' }}>
      {/* HEADER — fixed top, same level on every slide */}
      <div className="dp-a" style={{ flexShrink: 0, marginBottom: 28 }}>
        {eyebrow && <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{eyebrow}</div>}
        <h2 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: C.text1, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px' }}>{title}</h2>
        {sub && <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, marginTop: 14, lineHeight: 1.75, maxWidth: 580, marginBottom: 0 }}>{sub}</p>}
      </div>
      {/* CONTENT — fills all remaining vertical space */}
      <div className="dp-a" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

// ─── PART 1 ───────────────────────────────────────────────────────────────────
function S01_Intro() {
  return (
    <Slide eyebrow="Part 1 · Baseline" title="Modal Distribution"
      sub={`Nine central districts · ${fmt(total_residents)} residents · ${fmt(WORKERS)} daily workers · ${fmt(visitors)} visitors · ${fmt(D_total)} trips/day (MiD 2017)`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignContent: 'start' }}>
        <KCard label="Residents"       value={fmt(total_residents)} sub="9 districts · WOKS 2023" color="#2980B9" />
        <KCard label="Workers in zone" value={fmt(WORKERS)}         sub="WOKS Arbeitsmarkt 2025"  color="#8E44AD" />
        <KCard label="Daily visitors"  value={fmt(visitors)}        sub="MiD 2017 estimate"       color="#2D6A4F" />
        <KCard label="Total trips/day" value={fmt(D_total)}         sub="MiD 2017 formula"        color="#E63946" />
      </div>
    </Slide>
  )
}

function S02_Demand() {
  return (
    <Slide eyebrow="Part 1 · Baseline" title="Transport Demand Formula"
      sub="D_total = residents × 3.2 + workers × 2.1 + visitors × 1.5  (MiD 2017 trip-generation rates)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Residents', val: total_residents, factor: `× ${T_RESIDENT}`, result: total_residents * T_RESIDENT, color: '#2980B9' },
          { label: 'Workers',   val: WORKERS,         factor: `× ${T_WORKER}`,   result: WORKERS * T_WORKER,          color: '#8E44AD' },
          { label: 'Visitors',  val: visitors,        factor: `× ${T_VISITOR}`,  result: visitors * T_VISITOR,        color: '#2D6A4F' },
        ].map(({ label, val, factor, result, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.text2, width: 80 }}>{label}</span>
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.text3, fontVariantNumeric: 'tabular-nums', width: 70 }}>{fmt(val)}</span>
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.text3, width: 44 }}>{factor}</span>
            <span style={{ fontFamily: SERIF, fontSize: 18, color, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>= {fmt(result)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: C.text1, borderRadius: 8, marginTop: 4 }}>
          <span style={{ fontFamily: SERIF, fontSize: 15, color: '#fff' }}>D_total</span>
          <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#E63946', fontVariantNumeric: 'tabular-nums' }}>{fmt(D_total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 8 }}>
          <span style={{ fontFamily: SANS, fontSize: 13, color: C.text3 }}>D_internal (65% intra-zone)</span>
          <span style={{ fontFamily: SERIF, fontSize: 16, color: C.text1, fontVariantNumeric: 'tabular-nums' }}>{fmt(D_internal)}</span>
        </div>
      </div>
    </Slide>
  )
}

function S03_ModalDistrict() {
  return (
    <Slide eyebrow="Part 1 · Baseline" title="Modal Share & District Population"
      sub="Current modal split (MiD 2017 + KBA 2023) alongside resident distribution across nine districts (WOKS 2023)">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, height: '100%', alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Modal share · MiD 2017</div>
          <ModalShareChart />
        </div>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Population by district · WOKS 2023</div>
          <DistrictChart />
        </div>
      </div>
    </Slide>
  )
}

function S04_Hourly() {
  return (
    <Slide eyebrow="Part 1 · Baseline" title="Hourly Trip Distribution"
      sub={`Estimated weekday pattern (MiD 2017). Peak hour 8–9 h: ${fmt(peak_hour_trips)} trips. Hover bars for values.`}>
      <div style={{ maxWidth: 680 }}>
        <HourlyChart />
      </div>
    </Slide>
  )
}

function S05_BaselineTable() {
  return (
    <Slide eyebrow="Part 1 · Baseline" title="Baseline Results"
      sub="All key metrics derived from open statistical data sources">
      <BaselineTable />
    </Slide>
  )
}

// ─── PART 2 ───────────────────────────────────────────────────────────────────
function S06_FleetIntro() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Post-Car Fleet — Overview"
      sub={`Flow decomposition filters out ${(WALKING_SHARE_INTERNAL * 100).toFixed(0)}% of internal trips as walkable, yielding a net transport demand of ${fmt(D_transport)} trips/day.`}>
      <FleetSummaryGrid />
    </Slide>
  )
}

function S07_Flow() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Trip Flow Decomposition"
      sub="D_total → inbound (cross-boundary workers & visitors) + internal transport + walking (filtered out)">
      <div style={{ maxWidth: 680 }}>
        <FlowChart />
      </div>
    </Slide>
  )
}

function S08_ModeCards() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Fleet by Mode"
      sub="On-street peak · total fleet with reserve · daily trips per mode">
      <ModeCards />
    </Slide>
  )
}

function S09_OnStreet() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="On-street Peak vs Total Fleet"
      sub={`On-street = ⌈(peak trips / capacity) × trip duration⌉ · Total fleet includes reserve (1.15–1.35×) · Total: ${fmt(total_fleet)} vehicles`}>
      <div style={{ maxWidth: 640 }}>
        <OnStreetChart />
      </div>
    </Slide>
  )
}

function S10_Replacement() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Fleet Replacement"
      sub={`${fmt(CARS_REPLACED)} private cars/day replaced by a shared fleet of ${fmt(total_fleet)} vehicles — ratio 1 : ${replacement_ratio}`}>
      <ReplacementChart />
    </Slide>
  )
}

function S11_DotMatrix() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Dot Matrix — Visual Scale"
      sub={`Each dot = 10 vehicles. ${fmt(CARS_REPLACED)} private cars → ${fmt(total_fleet)} shared vehicles.`}>
      <DotMatrix />
    </Slide>
  )
}

function S12_Charging() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Charging Points"
      sub={`30% of each mode simultaneously charging (e-bike: 50%). Total: ${fmt(total_charging)} charging points across the network.`}>
      <div style={{ maxWidth: 640 }}>
        <ChargingChart />
      </div>
    </Slide>
  )
}

function S13_FleetTable() {
  return (
    <Slide eyebrow="Part 2 · Post-Car Fleet Sizing" title="Fleet Results Table"
      sub="Full breakdown by mode: daily trips · peak hour · on-street count · total fleet · charging points">
      <FleetTable />
    </Slide>
  )
}

// ─── PART 3 ───────────────────────────────────────────────────────────────────
function S14_HubIntro() {
  return (
    <Slide eyebrow="Part 3 · Hub Network" title="Hub Count & Distribution"
      sub={`${hub_l_count} large interchange hubs · ${hub_m_count} district hubs · ${hub_s_count} micro-hubs — walkable access within 200 m across the entire ${ZONE_AREA_KM2} km² zone`}>
      <HubSummaryGrid />
    </Slide>
  )
}

function S15_HubHeatmap() {
  return (
    <Slide eyebrow="Part 3 · Hub Network" title="Fleet per Hub — Heatmap"
      sub="Units assigned to a single hub of each tier, including 20% operational reserve">
      <HubHeatmap />
    </Slide>
  )
}

function S16_HubBars() {
  return (
    <Slide eyebrow="Part 3 · Hub Network" title="Total Fleet by Hub Tier"
      sub="All vehicles assigned to each tier, stacked by mode — shows how the fleet concentrates">
      <HubBars />
    </Slide>
  )
}

function S17_HubCards() {
  return (
    <Slide eyebrow="Part 3 · Hub Network" title="Hub Profile Cards"
      sub="Vehicle mix, charging points and footprint per single hub of each tier">
      <HubCards />
    </Slide>
  )
}

function S18_HubInfra() {
  return (
    <Slide eyebrow="Part 3 · Hub Network" title="Infrastructure Table"
      sub="Tier total · per-hub allocation · charging points · footprint — complete breakdown">
      <HubInfraTable />
    </Slide>
  )
}

// ─── PART 4 ───────────────────────────────────────────────────────────────────
function S19_AreaIntro() {
  return (
    <Slide eyebrow="Part 4 · Hub Area" title="S_hub = S_fleet + S_circ + S_charging + S_program"
      sub={`All ${hub_l_count + hub_m_count + hub_s_count} hubs combined: ${fmt(area_total_all_hubs)} m² · ${area_pct_of_zone}% of zone · ${(area_total_all_hubs / 10000).toFixed(2)} ha — comparable to a single urban block`}>
      <HubAreaSummaryGrid />
    </Slide>
  )
}

function S20_AreaBars() {
  return (
    <Slide eyebrow="Part 4 · Hub Area" title="Area Breakdown per Hub Tier"
      sub="Fleet parking · circulation · charging stations · program/shelter — stacked horizontal bar per tier">
      <HubAreaBars />
    </Slide>
  )
}

function S21_AreaDonut() {
  return (
    <Slide eyebrow="Part 4 · Hub Area" title="Fleet Parking Area by Mode"
      sub="How S_fleet is distributed across vehicle types within each hub tier — ring charts">
      <HubAreaFleetDonut />
    </Slide>
  )
}

function S22_AreaTable() {
  return (
    <Slide eyebrow="Part 4 · Hub Area" title="Hub Area Table"
      sub="Full breakdown · circulation factors · per-hub and combined footprint for all tiers">
      <HubAreaTable />
    </Slide>
  )
}

// ─── METHODOLOGY ─────────────────────────────────────────────────────────────

// ─── METHODOLOGY OVERLAY ──────────────────────────────────────────────────────
function MethodsOverlay({ onClose }) {
  const scrollRef = React.useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('dp-v') }),
      { threshold: 0.05, root: el }
    )
    el.querySelectorAll('.dp-a').forEach(n => obs.observe(n))
    return () => obs.disconnect()
  }, [])

  const box = (label, formula, note) => (
    <div key={label} style={{ background: '#F7F7F6', borderRadius: 8, padding: '14px 18px', border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: C.text3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{formula}</div>
      {note && <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 6 }}>{note}</div>}
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 40px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.bg }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, color: C.text3, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back
        </button>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Appendix · Methods</div>
        <div style={{ fontFamily: SERIF, fontSize: 16, color: C.text1, marginLeft: 4 }}>How the Numbers Were Made</div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 40px 80px' }}>

          <div className="dp-a" style={{ marginBottom: 32 }}>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0 }}>
              Each section builds on publicly available data and standard urban transport benchmarks.
              The calculations are deterministic — no simulation or model calibration is required.
            </p>
          </div>

          {/* ── Part 1 ── */}
          <div className="dp-a" style={{ padding: '40px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Part 1 · Baseline</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: C.text1, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Transport Demand</h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 16px' }}>
              Population figures come from the <strong>WOKS 2023</strong> statistical report for the nine central Wolfsburg districts.
              Worker count ({fmt(WORKERS)}) is from <strong>WOKS Arbeitsmarktbericht 2025</strong>.
              Visitor volume is estimated as 20% of the combined residents and workers, following the MiD 2017 trip-generation pattern for mid-size German cities.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 28px' }}>
              Trip generation rates are national averages from <strong>MiD 2017 (BMVI)</strong>:
              residents make 3.2 trips/day, workers 2.1, visitors 1.5.
              Modal split uses the MiD 2017 baseline with the private-car share raised
              by +4 percentage points to 62%, reflecting Wolfsburg's above-average car ownership from <strong>KBA 2023</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {box('D_total formula', 'residents × 3.2 + workers × 2.1 + visitors × 1.5', `= ${fmt(D_total)} trips/day`)}
              {box('Visitors estimate', `(${fmt(total_residents)} + ${fmt(WORKERS)}) × 20%`, `= ${fmt(visitors)} visitors/day`)}
              {box('Peak hour (8–9 h)', 'D_total × 8.5% MiD profile', `= ${fmt(peak_hour_trips)} trips/h`)}
              {box('Private cars/day', 'D_total × 62% ÷ 1.3 occupancy', `= ${fmt(car_vehicles_per_day)} vehicles`)}
            </div>
          </div>

          {/* ── Part 2 ── */}
          <div className="dp-a" style={{ padding: '40px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Part 2 · Fleet Sizing</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: C.text1, margin: '0 0 24px', letterSpacing: '-0.5px' }}>From Trips to Vehicles</h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 16px' }}>
              D_total is first split into <strong>inbound</strong> and <strong>internal</strong> flows.
              Inbound covers workers commuting from outside the zone (50% of worker trips)
              and visitors arriving from outside (80% of visitor trips).
              Internal flows include all resident trips plus the remaining worker and visitor movements within the zone.
              Of internal trips, 60% are assumed walkable and filtered out — consistent with
              MiD 2017 short-distance walking rates for dense urban cores.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 28px' }}>
              Each transport mode is assigned a fixed share of the remaining demand via two allocation matrices:
              one for inbound flows (dominated by autonomous bus and shuttle),
              one for internal flows (dominated by e-bike and autonomous pod).
              Fleet size follows a <strong>peak-hour utilisation formula</strong>: the number of vehicles
              simultaneously on the street at peak hour equals peak trips divided by vehicle capacity, multiplied by average trip duration.
              A mode-specific reserve factor (1.15–1.35) converts on-street count to total fleet.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {box('Net transport demand', 'inbound trips + internal transport\n(after walking filter)', `D_transport = ${fmt(D_transport)}`)}
              {box('Walking filtered out', 'internal trips × 60% walkable', `= ${fmt(walking_filtered)} trips/day`)}
              {box('On-street fleet (per mode)', '⌈(peak_trips ÷ capacity) × trip_h⌉', `e.g. e-bike: ${fleet.e_bike.on_street} units`)}
              {box('Total fleet (per mode)', 'on_street × peak_factor', `total: ${fmt(total_fleet)} vehicles`)}
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0 }}>
              Charging point requirements are benchmarked from operator data:
              50% of e-bikes charge simultaneously (Nextbike operational standard),
              30% for all other modes (UITP autonomous vehicle guidelines, MOIA Hamburg analogue,
              Share Now fleet operations).
              The baseline car count ({fmt(CARS_REPLACED)} private vehicles/day) is derived from KBA 2023
              car registration data for Wolfsburg, divided by average car utilisation.
            </p>
          </div>

          {/* ── Part 3 ── */}
          <div className="dp-a" style={{ padding: '40px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Part 3 · Hub Network</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: C.text1, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Hub Counts from Geometry</h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 16px' }}>
              Hub counts are derived from <strong>coverage geometry</strong>, not from fleet demand alone.
              The starting point is the 4 km² zone area and the maximum acceptable walking distance to a hub.
              A 1.35× overlap factor accounts for irregular street grids and dead zones between circles.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 28px' }}>
              <strong>Hub L</strong> count is constrained by existing infrastructure —
              there are at most 6 large parking structures in the zone that can be repurposed as interchange hubs.
              The fleet-driven estimate (⌈(bus + car-share fleet) ÷ 8⌉) is capped at this maximum.
              <strong> Hub M</strong> is the maximum of the geometric estimate (r = 400 m coverage) and the
              shuttle-fleet requirement (one Hub M per 3 shuttles).
              <strong> Hub S</strong> follows purely from geometry: enough micro-hubs to ensure
              no resident is more than 200 m from a docking point.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { tier: 'Hub S', color: HUB_COLORS_UI.hub_s, formula: '⌈(4,000,000 m² ÷ π×200²) × 1.35⌉', result: `= ${hub_s_count} hubs`, note: '200 m walking radius' },
                { tier: 'Hub M', color: HUB_COLORS_UI.hub_m, formula: 'max(geometry r=400m,\nshuttle_fleet ÷ 3)', result: `= ${hub_m_count} hubs`, note: '400 m, shuttle coverage' },
                { tier: 'Hub L', color: HUB_COLORS_UI.hub_l, formula: 'min(⌈(bus+car-share) ÷ 8⌉, 6)', result: `= ${hub_l_count} hubs`, note: 'capped — existing garages' },
              ].map(({ tier, color, formula, result, note }) => (
                <div key={tier} style={{ background: '#F7F7F6', borderRadius: 8, padding: '14px 16px', border: `1px solid ${C.border}`, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>{tier}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{formula}</div>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text1, marginTop: 5 }}>{result}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, marginTop: 3 }}>{note}</div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0 }}>
              Fleet is assigned to tiers via a fixed distribution matrix — for example, all buses and car-share EVs
              concentrate at Hub L, while 70% of e-bikes are distributed to Hub S micro-hubs.
              Per-hub vehicle count adds a 20% operational reserve on top of the tier allocation,
              rounding up to ensure no hub is under-provisioned at peak demand.
            </p>
          </div>

          {/* ── Part 4 ── */}
          <div className="dp-a" style={{ padding: '40px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Part 4 · Hub Area</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: C.text1, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Spatial Footprint Formula</h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 28px' }}>
              Hub area is the sum of four components. Footprint values per vehicle type are drawn from
              standard parking and depot design references: 2.5 m² for an e-bike rack,
              10 m² for a compact pod, 35 m² for a minibus, 60 m² for a full-size bus, 15 m² for a car.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {box('S_fleet — parking footprint', 'Σ (units_per_hub × m²/vehicle)', 'Standard depot footprint values per type')}
              {box('S_circ — circulation', 'S_fleet × (factor − 1)', '×1.6 Hub L · ×1.4 Hub M · ×1.2 Hub S')}
              {box('S_charging — charging stations', 'Σ ⌈units × rate⌉ × station_m²', '0.5 m² e-bike dock · 4 m² EV charger')}
              {box('S_program — shelter & services', '(S_fleet + S_circ + S_charging) × 10%', 'Waiting areas, info points, shelter')}
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 16px' }}>
              The circulation factor captures driveways, turning radii, and pedestrian paths
              within the hub perimeter — it is applied as a multiplier to fleet area only,
              not to charging or program. Program space covers sheltered waiting zones,
              real-time information displays, and minor service areas.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0 }}>
              Total land use across all {hub_l_count + hub_m_count + hub_s_count} hubs is{' '}
              <strong>{fmt(area_total_all_hubs)} m²</strong> ({(area_total_all_hubs / 10000).toFixed(2)} ha),
              equivalent to {area_pct_of_zone}% of the 4 km² project zone —
              comparable to a single urban block. The concentration of area in Hub L
              ({Math.round(S_hub_area.hub_l * hub_l_count / area_total_all_hubs * 100)}% of total despite only {hub_l_count} sites)
              reflects the bus and car-share depot requirements at large interchange nodes.
            </p>
          </div>

          {/* Sources */}
          <div className="dp-a" style={{ marginTop: 8, padding: '20px 24px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <p style={{ fontFamily: SANS, fontSize: 11, color: C.text3, margin: 0, lineHeight: 1.9 }}>
              <strong style={{ color: C.text2 }}>Baseline:</strong> MiD 2017 (BMVI) · WOKS Wolfsburg 2023/2025 · KBA 2023<br />
              <strong style={{ color: C.text2 }}>Fleet:</strong> Nextbike operational data · UITP autonomous shuttle &amp; bus benchmarks · MOIA Hamburg · Share Now / Stadtmobil<br />
              <strong style={{ color: C.text2 }}>Hub geometry:</strong> Coverage radius 200 m (S) / 400 m (M) · 1.35× overlap factor · max 6 Hub L (existing parking garages)<br />
              <strong style={{ color: C.text2 }}>Hub area:</strong> Footprint/unit + circulation factor + charging stations + 10% program<br />
              <strong style={{ color: C.text2 }}>Scripts:</strong>{' '}
              {['modal_distribution.py', 'fleet_calculation.py', 'hub_calculation.py', 'hub_area.py'].map(s => (
                <code key={s} style={{ background: '#F0EFED', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 10, marginRight: 6 }}>{s}</code>
              ))}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

function S23_Methods() {
  const boxes = [
    { label: 'Transport Demand (P1)', formula: 'residents × 3.2 + workers × 2.1 + visitors × 1.5', result: `D_total = ${fmt(D_total)}`, note: 'MiD 2017 · WOKS 2023/2025 · KBA 2023' },
    { label: 'Fleet Sizing (P2)',     formula: '⌈(peak_trips ÷ capacity) × trip_h⌉ × peak_factor', result: `Total fleet = ${fmt(total_fleet)}`, note: 'Nextbike · UITP benchmarks · MOIA Hamburg' },
    { label: 'Hub Counts (P3)',       formula: '⌈(zone_m² ÷ πr²) × 1.35⌉ per tier',               result: `${hub_s_count} S · ${hub_m_count} M · ${hub_l_count} L hubs`, note: 'r = 200 m (S) · 400 m (M) · max 6 (L)' },
    { label: 'Hub Area (P4)',         formula: 'S_fleet + S_circ + S_charging + S_program',         result: `${fmt(area_total_all_hubs)} m² total`, note: 'Standard depot footprint values per vehicle type' },
  ]
  return (
    <Slide eyebrow="Appendix" title="How the Numbers Were Made"
      sub="Deterministic calculations from open statistical data — no simulation or model calibration required">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {boxes.map(({ label, formula, result, note }) => (
          <div key={label} style={{ background: '#F7F7F6', borderRadius: 10, padding: '20px 22px', border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, lineHeight: 1.5, marginBottom: 10 }}>{formula}</div>
            <div style={{ fontFamily: SERIF, fontSize: 18, color: C.text1, marginBottom: 6 }}>{result}</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{note}</div>
          </div>
        ))}
      </div>
    </Slide>
  )
}

// ─── SLIDE REGISTRY ──────────────────────────────────────────────────────────
const ALL_SLIDES = [
  S01_Intro, S02_Demand, S03_ModalDistrict, S04_Hourly, S05_BaselineTable,
  S06_FleetIntro, S07_Flow, S08_ModeCards, S09_OnStreet, S10_Replacement,
  S11_DotMatrix, S12_Charging, S13_FleetTable,
  S14_HubIntro, S15_HubHeatmap, S16_HubBars, S17_HubCards, S18_HubInfra,
  S19_AreaIntro, S20_AreaBars, S21_AreaDonut, S22_AreaTable,
]
const LAST_SLIDE_IDX = ALL_SLIDES.length - 1  // 21 = S22_AreaTable

const PART_NAV = [
  { label: 'Modal Distribution', eyebrow: 'Part 1', first: 0,  last: 4  },
  { label: 'Post-Car Fleet',     eyebrow: 'Part 2', first: 5,  last: 12 },
  { label: 'Hub Network',        eyebrow: 'Part 3', first: 13, last: 17 },
  { label: 'Hub Area',           eyebrow: 'Part 4', first: 18, last: 21 },
]

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DataPanel() {
  const [slide, setSlide] = useState(0)
  const [showMethods, setShowMethods] = useState(false)
  const outerRef = useRef(null)
  const slideRef = useRef(null)
  const goRef    = useRef(null)
  const busy     = useRef(false)

  const go = React.useCallback((delta) => {
    if (busy.current) return
    const next = Math.max(0, Math.min(ALL_SLIDES.length - 1, slide + delta))
    if (next === slide) return
    busy.current = true
    setSlide(next)
    setTimeout(() => { busy.current = false }, 480)
  }, [slide])

  useEffect(() => { goRef.current = go }, [go])

  // Trigger entrance animations after slide mounts
  useEffect(() => {
    const el = slideRef.current
    if (!el) return
    const timer = setTimeout(() => {
      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('dp-v') }),
        { threshold: 0.02, root: el }
      )
      el.querySelectorAll('.dp-a').forEach(n => obs.observe(n))
      return () => obs.disconnect()
    }, 60)
    return () => clearTimeout(timer)
  }, [slide])

  // Each wheel tick = next/prev slide (slides don't scroll internally)
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const handler = (e) => {
      e.preventDefault()
      goRef.current(e.deltaY > 0 ? 1 : -1)
    }
    outer.addEventListener('wheel', handler, { passive: false })
    return () => outer.removeEventListener('wheel', handler)
  }, [])

  const activePartIdx = PART_NAV.findIndex(p => slide >= p.first && slide <= p.last)
  const SlideComp = ALL_SLIDES[slide]

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0, display: 'flex', background: C.bg, zIndex: 10, overflow: 'hidden' }}>
      <style>{CSS_ANIM + CSS_SLIDES}</style>

      {/* ── Left nav ── */}
      <nav style={{ width: 168, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', padding: '28px 12px 22px' }}>
        <div style={{ fontFamily: SANS, fontSize: 9, color: C.text3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 18, paddingLeft: 8 }}>
          Capacity Analysis
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {PART_NAV.map((p, i) => {
            const active = i === activePartIdx
            return (
              <button key={i} onClick={() => { busy.current = false; setSlide(p.first) }}
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: '8px 8px 8px 10px', borderLeft: `2px solid ${active ? C.text1 : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                <div style={{ fontFamily: SANS, fontSize: 9, color: C.text3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>{p.eyebrow}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? C.text1 : C.text3, transition: 'color 0.15s ease' }}>{p.label}</div>
                {active && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                    {Array.from({ length: p.last - p.first + 1 }, (_, j) => (
                      <div key={j}
                        onClick={(e) => { e.stopPropagation(); busy.current = false; setSlide(p.first + j) }}
                        style={{ width: 5, height: 5, borderRadius: '50%', background: slide === p.first + j ? C.text1 : C.border, flexShrink: 0, cursor: 'pointer', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Progress bar + counter */}
        <div style={{ paddingTop: 14, borderTop: `1px solid ${C.border}`, paddingLeft: 8 }}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
            {ALL_SLIDES.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i <= slide ? C.text1 : C.border, transition: 'background 0.25s ease' }} />
            ))}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3 }}>{slide + 1} / {ALL_SLIDES.length}</div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, paddingLeft: 8 }}>
          <div style={{ fontFamily: SANS, fontSize: 9, color: C.text3, lineHeight: 1.8 }}>
            Scroll to navigate
          </div>
        </div>
      </nav>

      {/* ── Full-screen slide + right handle ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div key={slide} ref={slideRef} className="dp-slide"
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
          <SlideComp />
        </div>

        {/* "How the Numbers Were Made" button — visible on last slide */}
        {slide === LAST_SLIDE_IDX && (
          <button onClick={() => setShowMethods(true)} style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '9px 20px', cursor: 'pointer', zIndex: 30,
            fontFamily: SANS, fontSize: 13, color: C.text2, letterSpacing: '0.02em',
            transition: 'border-color 0.15s, color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.text1; e.currentTarget.style.color = C.text1 }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text2 }}
          >
            How the Numbers Were Made →
          </button>
        )}

        {/* Methodology overlay */}
        {showMethods && <MethodsOverlay onClose={() => setShowMethods(false)} />}

        <SlideHandle total={ALL_SLIDES.length} slide={slide} onGo={(i) => { busy.current = false; setSlide(i) }} />
      </div>
    </div>
  )
}
