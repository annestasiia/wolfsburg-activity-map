// Shared fleet calculation — same formulas as DataPanel.jsx
// Use this to compute per-hub fleet breakdown from actual hub counts.

const ceil = Math.ceil

const DISTRICT_POP = {
  'Stadtmitte': 2800, 'Schillerteich': 2100, 'Hellwinkel': 1900,
  'Heßlingen': 2200, 'Rothenfelde': 1800, 'Köhlerberg': 1400,
  'Alt-Wolfsburg': 2600, 'Sandkamp': 1100, 'Hochenstein': 1500,
}
const WORKERS = 18000, T_RESIDENT = 3.2, T_WORKER = 2.1, T_VISITOR = 1.5
const VISITOR_SHARE = 0.20

const total_residents = Object.values(DISTRICT_POP).reduce((a, b) => a + b, 0)
const visitors = (total_residents + WORKERS) * VISITOR_SHARE
const D_total = total_residents * T_RESIDENT + WORKERS * T_WORKER + visitors * T_VISITOR

const HOUR_RAW = [
  0.005, 0.003, 0.002, 0.002, 0.005, 0.015,
  0.040, 0.075, 0.085, 0.065, 0.055, 0.060,
  0.060, 0.055, 0.055, 0.065, 0.075, 0.080,
  0.065, 0.045, 0.030, 0.020, 0.015, 0.008,
]
const HOUR_SUM = HOUR_RAW.reduce((a, b) => a + b, 0)
const HOUR_SHARE = HOUR_RAW.map(s => s / HOUR_SUM)
const peak_hour_trips = Math.round(D_total * HOUR_SHARE[8])

const inbound_worker_trips  = WORKERS * T_WORKER * 0.50
const inbound_visitor_trips = visitors * T_VISITOR * 0.80
const inbound_trips         = inbound_worker_trips + inbound_visitor_trips
const resident_trips        = total_residents * T_RESIDENT
const internal_worker_trips = WORKERS * T_WORKER * 0.50
const internal_visitor_trips= visitors * T_VISITOR * 0.20
const internal_other_trips  = internal_worker_trips + internal_visitor_trips
const all_internal_trips    = resident_trips + internal_other_trips
const WALKING_SHARE_INTERNAL = 0.60
const transport_internal    = all_internal_trips * (1 - WALKING_SHARE_INTERNAL)
const D_transport           = inbound_trips + transport_internal

const INBOUND_MODAL  = { autonomous_bus: 0.35, autonomous_shuttle: 0.25, car_sharing_ev: 0.25, autonomous_pod: 0.15 }
const INTERNAL_MODAL = { e_bike: 0.45, autonomous_pod: 0.35, autonomous_shuttle: 0.20 }

const trips_by_mode = {}
for (const [m, s] of Object.entries(INBOUND_MODAL))
  trips_by_mode[m] = (trips_by_mode[m] || 0) + inbound_trips * s
for (const [m, s] of Object.entries(INTERNAL_MODAL))
  trips_by_mode[m] = (trips_by_mode[m] || 0) + transport_internal * s

const mode_shares        = Object.fromEntries(Object.entries(trips_by_mode).map(([m, t]) => [m, t / D_transport]))
const peak_trips_by_mode = Object.fromEntries(Object.entries(mode_shares).map(([m, s]) => [m, peak_hour_trips * s]))

const FLEET_PARAMS = {
  e_bike:             { capacity: 1,    trip_h: 0.25, peak_factor: 1.20 },
  autonomous_shuttle: { capacity: 12,   trip_h: 0.25, peak_factor: 1.30 },
  autonomous_bus:     { capacity: 25,   trip_h: 0.40, peak_factor: 1.35 },
  autonomous_pod:     { capacity: 1.5,  trip_h: 0.20, peak_factor: 1.20 },
  car_sharing_ev:     { capacity: 3.5,  trip_h: 0.50, peak_factor: 1.15 },
}

export const MODE_META = {
  e_bike:             { label: 'E-Bike',       color: '#27AE60', icon: '🚲' },
  autonomous_shuttle: { label: 'Auto Shuttle', color: '#8E44AD', icon: '🚌' },
  autonomous_bus:     { label: 'Auto Bus',     color: '#2C3E50', icon: '🚍' },
  autonomous_pod:     { label: 'Auto Pod',     color: '#2980B9', icon: '🚐' },
  car_sharing_ev:     { label: 'Car-Share EV', color: '#E67E22', icon: '🚗' },
}

export const FLEET = {}
for (const mode of Object.keys(MODE_META)) {
  const p = FLEET_PARAMS[mode]
  const pt = peak_trips_by_mode[mode] || 0
  const on_street = ceil((pt / p.capacity) * p.trip_h)
  const total = ceil(on_street * p.peak_factor)
  FLEET[mode] = { total, on_street, charging: mode === 'e_bike' ? ceil(total * 0.50) : ceil(total * 0.30) }
}

export const HUB_DISTRIBUTION = {
  car_sharing_ev:     { hub_l: 1.00, hub_m: 0.00, hub_s: 0.00 },
  autonomous_bus:     { hub_l: 1.00, hub_m: 0.00, hub_s: 0.00 },
  autonomous_shuttle: { hub_l: 0.50, hub_m: 0.50, hub_s: 0.00 },
  autonomous_pod:     { hub_l: 0.30, hub_m: 0.50, hub_s: 0.20 },
  e_bike:             { hub_l: 0.00, hub_m: 0.30, hub_s: 0.70 },
}

// Compute per-hub fleet given actual hub counts from analysis
export function computeFleetPerHub(hubLCount, hubMCount, hubSCount) {
  const counts = { hub_l: Math.max(1, hubLCount), hub_m: Math.max(1, hubMCount), hub_s: Math.max(1, hubSCount) }
  const result = {}
  for (const tier of ['hub_l', 'hub_m', 'hub_s']) {
    result[tier] = {}
    for (const mode of Object.keys(MODE_META)) {
      const share = HUB_DISTRIBUTION[mode]?.[tier] || 0
      result[tier][mode] = ceil(FLEET[mode].total * share / counts[tier] * 1.20)
    }
    result[tier]._total = Object.values(result[tier]).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
  }
  return result
}
