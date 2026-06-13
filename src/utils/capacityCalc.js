// Capacity calculation — all formulas from DataPanel.jsx, parameterised by city population.
// Baseline city population: 130,000 (current Wolfsburg). Everything scales proportionally.

const BASELINE_CITY_POP  = 130000
const BASELINE_RESIDENTS = 17400   // sum of 9 central districts at baseline
const BASELINE_WORKERS   = 18000   // Volkswagen / zone workers at baseline

const T_RESIDENT = 3.2, T_WORKER = 2.1, T_VISITOR = 1.5
const VISITOR_SHARE          = 0.20
const WALKING_SHARE_INTERNAL = 0.60

const HOUR_RAW = [
  0.005,0.003,0.002,0.002,0.005,0.015,
  0.040,0.075,0.085,0.065,0.055,0.060,
  0.060,0.055,0.055,0.065,0.075,0.080,
  0.065,0.045,0.030,0.020,0.015,0.008,
]
const HOUR_SUM   = HOUR_RAW.reduce((a, b) => a + b, 0)
const HOUR_SHARE = HOUR_RAW.map(s => s / HOUR_SUM)

export const MODE_META = {
  e_bike:             { label: 'E-Bike',       color: '#27AE60' },
  autonomous_shuttle: { label: 'Auto Shuttle', color: '#8E44AD' },
  autonomous_bus:     { label: 'Auto Bus',     color: '#2C3E50' },
  autonomous_pod:     { label: 'Auto Pod',     color: '#2980B9' },
  car_sharing_ev:     { label: 'Car-Share EV', color: '#E67E22' },
}

const FLEET_PARAMS = {
  e_bike:             { capacity: 1,    trip_h: 0.25, peak_factor: 1.20 },
  autonomous_shuttle: { capacity: 12,   trip_h: 0.25, peak_factor: 1.30 },
  autonomous_bus:     { capacity: 25,   trip_h: 0.40, peak_factor: 1.35 },
  autonomous_pod:     { capacity: 1.5,  trip_h: 0.20, peak_factor: 1.20 },
  car_sharing_ev:     { capacity: 3.5,  trip_h: 0.50, peak_factor: 1.15 },
}

const INBOUND_MODAL  = { autonomous_bus: 0.35, autonomous_shuttle: 0.25, car_sharing_ev: 0.25, autonomous_pod: 0.15 }
const INTERNAL_MODAL = { e_bike: 0.45, autonomous_pod: 0.35, autonomous_shuttle: 0.20 }

const ZONE_AREA_KM2 = 4.0
const HUB_S_RADIUS  = 200
const HUB_M_RADIUS  = 400
const hub_zone_m2   = ZONE_AREA_KM2 * 1_000_000

const TIERS = ['hub_l', 'hub_m', 'hub_s']

const HUB_DISTRIBUTION = {
  car_sharing_ev:     { hub_l: 1.00, hub_m: 0.00, hub_s: 0.00 },
  autonomous_bus:     { hub_l: 1.00, hub_m: 0.00, hub_s: 0.00 },
  autonomous_shuttle: { hub_l: 0.50, hub_m: 0.50, hub_s: 0.00 },
  autonomous_pod:     { hub_l: 0.30, hub_m: 0.50, hub_s: 0.20 },
  e_bike:             { hub_l: 0.00, hub_m: 0.30, hub_s: 0.70 },
}

const FOOTPRINT_PER_UNIT = { e_bike: 2.5, autonomous_pod: 10, autonomous_shuttle: 35, autonomous_bus: 60, car_sharing_ev: 15 }
const CIRCULATION_FACTOR = { hub_l: 1.60, hub_m: 1.40, hub_s: 1.20 }
const CHARGING_FP_M2     = { e_bike: 0.5, other: 4.0 }
const HUB_CHARGING_RATE  = { e_bike: 0.50, autonomous_pod: 0.30, autonomous_shuttle: 0.30, autonomous_bus: 0.30, car_sharing_ev: 0.30 }
const PROGRAM_SHARE_AREA = 0.10

const ceil = Math.ceil

export function computeCapacity(cityPopulation = 130000) {
  const scale = cityPopulation / BASELINE_CITY_POP

  // ── Demographics ─────────────────────────────────────────────────────────────
  const total_residents = Math.round(BASELINE_RESIDENTS * scale)
  const workers         = Math.round(BASELINE_WORKERS   * scale)
  const visitors        = (total_residents + workers) * VISITOR_SHARE
  const D_total         = total_residents * T_RESIDENT + workers * T_WORKER + visitors * T_VISITOR

  // ── Peak hour ─────────────────────────────────────────────────────────────────
  const peak_hour_trips = Math.round(D_total * HOUR_SHARE[8])

  // ── Trip flow ─────────────────────────────────────────────────────────────────
  const inbound_worker_trips   = workers   * T_WORKER  * 0.50
  const inbound_visitor_trips  = visitors  * T_VISITOR * 0.80
  const inbound_trips          = inbound_worker_trips + inbound_visitor_trips
  const resident_trips         = total_residents * T_RESIDENT
  const internal_worker_trips  = workers   * T_WORKER  * 0.50
  const internal_visitor_trips = visitors  * T_VISITOR * 0.20
  const all_internal_trips     = resident_trips + internal_worker_trips + internal_visitor_trips
  const transport_internal     = all_internal_trips * (1 - WALKING_SHARE_INTERNAL)
  const D_transport            = inbound_trips + transport_internal

  // ── Trips by mode ─────────────────────────────────────────────────────────────
  const trips_by_mode = {}
  for (const [m, s] of Object.entries(INBOUND_MODAL))
    trips_by_mode[m] = (trips_by_mode[m] || 0) + inbound_trips * s
  for (const [m, s] of Object.entries(INTERNAL_MODAL))
    trips_by_mode[m] = (trips_by_mode[m] || 0) + transport_internal * s

  const mode_shares        = Object.fromEntries(Object.entries(trips_by_mode).map(([m, t]) => [m, t / D_transport]))
  const peak_trips_by_mode = Object.fromEntries(Object.entries(mode_shares).map(([m, s]) => [m, peak_hour_trips * s]))

  // ── Fleet ─────────────────────────────────────────────────────────────────────
  const fleet = {}
  for (const mode of Object.keys(MODE_META)) {
    const p          = FLEET_PARAMS[mode]
    const pt         = peak_trips_by_mode[mode] || 0
    const on_street  = ceil((pt / p.capacity) * p.trip_h)
    const total      = ceil(on_street * p.peak_factor)
    const charging   = mode === 'e_bike' ? ceil(total * 0.50) : ceil(total * 0.30)
    fleet[mode] = { trips: trips_by_mode[mode] || 0, peak_hour: pt, on_street, total, charging }
  }

  // ── Hub counts — scale with population ───────────────────────────────────────
  // Base counts at 130k population; all geometry components multiplied by scale.
  const hub_s_area      = Math.PI * HUB_S_RADIUS ** 2
  const hub_s_base      = ceil((hub_zone_m2 / hub_s_area) * 1.35)        // 43 at baseline
  const hub_s_count     = ceil(hub_s_base * scale)                        // proportional

  const hub_m_area_geom     = Math.PI * HUB_M_RADIUS ** 2
  const hub_m_base_geom     = ceil((hub_zone_m2 / hub_m_area_geom) * 1.35) // 11 at baseline
  const hub_m_from_geometry = ceil(hub_m_base_geom * scale)               // proportional
  const hub_m_from_shuttle  = ceil(fleet.autonomous_shuttle.total / 3)    // fleet-based
  const hub_m_count         = Math.max(hub_m_from_geometry, hub_m_from_shuttle)

  const hub_l_from_fleet    = ceil((fleet.autonomous_bus.total + fleet.car_sharing_ev.total) / 8)
  const hub_l_count         = Math.min(Math.max(hub_l_from_fleet, 3), 6)

  const hub_counts = { hub_l: hub_l_count, hub_m: hub_m_count, hub_s: hub_s_count }

  // ── Fleet per hub (distribution) ─────────────────────────────────────────────
  const fleet_per_hub = {}
  for (const tier of TIERS) {
    fleet_per_hub[tier] = {}
    for (const mode of Object.keys(MODE_META)) {
      const share = HUB_DISTRIBUTION[mode]?.[tier] || 0
      const tier_total = ceil(fleet[mode].total * share)
      fleet_per_hub[tier][mode] = ceil(tier_total / hub_counts[tier] * 1.20)
    }
  }

  // ── Hub area per hub ──────────────────────────────────────────────────────────
  const S_hub_area = {}
  for (const tier of TIERS) {
    const fleet_area    = Object.keys(MODE_META).reduce((s, m) => s + (fleet_per_hub[tier][m] || 0) * FOOTPRINT_PER_UNIT[m], 0)
    const circ_area     = fleet_area * (CIRCULATION_FACTOR[tier] - 1)
    const charging_area = Object.keys(MODE_META).reduce((s, m) => {
      const n = fleet_per_hub[tier][m] || 0
      const chargers = ceil(n * HUB_CHARGING_RATE[m])
      return s + chargers * (m === 'e_bike' ? CHARGING_FP_M2.e_bike : CHARGING_FP_M2.other)
    }, 0)
    const sub = fleet_area + circ_area + charging_area
    S_hub_area[tier] = sub * (1 + PROGRAM_SHARE_AREA)
  }

  // Required total areas passed to hub placement algorithm
  const requiredAreaL = Math.round(S_hub_area.hub_l * hub_l_count)
  const requiredAreaM = Math.round(S_hub_area.hub_m * hub_m_count)

  return {
    cityPopulation,
    total_residents, workers, visitors: Math.round(visitors), D_total: Math.round(D_total),
    peak_hour_trips,
    D_transport: Math.round(D_transport),
    trips_by_mode,
    fleet,
    hub_counts,
    S_hub_area,
    fleet_per_hub,
    requiredAreaL,
    requiredAreaM,
    hubSCount: hub_s_count,
  }
}
