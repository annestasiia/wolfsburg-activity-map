# Capacity Analysis — Methods & Results

Full documentation of the Capacity Analysis section of the Post-Car Wolfsburg platform.
All calculations are deterministic — no simulation or model calibration required.
Source: `src/components/DataPanel.jsx`

---

## Part 1 · Baseline — Modal Distribution

### Study area

Nine central districts of Wolfsburg (4 km² zone).

| District      | Residents |
|---------------|----------:|
| Stadtmitte    | 2,800     |
| Schillerteich | 2,100     |
| Hellwinkel    | 1,900     |
| Heßlingen     | 2,200     |
| Rothenfelde   | 1,800     |
| Köhlerberg    | 1,400     |
| Alt-Wolfsburg | 2,600     |
| Sandkamp      | 1,100     |
| Hochenstein   | 1,500     |
| **Total**     | **17,400** |

Sources: WOKS 2023 (residents), WOKS Arbeitsmarktbericht 2025 (workers).

### Transport demand formula

```
D_total = residents × 3.2 + workers × 2.1 + visitors × 1.5

Visitors = (residents + workers) × 20%
         = (17,400 + 18,000) × 0.20
         = 7,080 visitors/day

D_total = 17,400 × 3.2 + 18,000 × 2.1 + 7,080 × 1.5
        = 55,680 + 37,800 + 10,620
        = 104,100 trips/day

D_internal = D_total × 65% = 67,665 trips/day (intra-zone)
```

Trip rates from MiD 2017 (BMVI) — national averages for German residents, workers, visitors.

### Modal split

Baseline: MiD 2017 + KBA 2023 (private car share raised +4 pp to reflect Wolfsburg's above-average car ownership).

| Mode           | Share | Trips/day | Source         |
|----------------|------:|----------:|----------------|
| Private car    | 62%   | 64,542    | MiD 2017 + KBA 2023 |
| Walking        | 20%   | 20,820    | MiD 2017       |
| Public transit | 10%   | 10,410    | MiD 2017       |
| Cycling        |  8%   |  8,328    | MiD 2017       |

Car occupancy: 1.3 persons/vehicle → **49,648 private vehicles/day** in the zone.

### Hourly distribution

Peak hours: 07–09h and 16–18h (red bars in the UI chart).
Peak hour (08–09h) ≈ 8.5% of D_total ≈ **8,985 trips/hour**.

Hourly weights (normalised):

```
Hour:  0     1     2     3     4     5     6     7     8     9    10    11
Share: 0.5%  0.3%  0.2%  0.2%  0.5%  1.5%  4.0%  7.6%  8.6%  6.6%  5.6%  6.1%

Hour: 12    13    14    15    16    17    18    19    20    21    22    23
Share: 6.1%  5.6%  5.6%  6.6%  7.6%  8.1%  6.6%  4.6%  3.0%  2.0%  1.5%  0.8%
```

### Baseline results table

| Metric                | Value   | Source              |
|-----------------------|--------:|---------------------|
| Population (residents)| 17,400  | WOKS 2023           |
| Workers in zone       | 18,000  | WOKS 2025           |
| Daily visitors        |  7,080  | MiD 2017 estimate   |
| D_total (trips/day)   |104,100  | MiD 2017 formula    |
| D_internal (trips/day)| 67,665  | 65% of D_total      |
| Car trips/day         | 64,542  | MiD 2017            |
| Car vehicles/day      | 49,648  | MiD 2017            |
| Transit trips/day     | 10,410  | MiD 2017            |
| Walking trips/day     | 20,820  | MiD 2017            |
| Cycling trips/day     |  8,328  | MiD 2017            |

---

## Part 2 · Post-Car Fleet Sizing

### Trip flow decomposition

D_total is split into inbound and internal flows, then walking is filtered from internal.

```
Inbound flows:
  inbound_worker_trips  = 18,000 × 2.1 × 50%  = 18,900   (commuters from outside)
  inbound_visitor_trips =  7,080 × 1.5 × 80%  =  8,496   (visitors arriving from outside)
  inbound_trips         = 18,900 + 8,496       = 27,396

Internal flows:
  resident_trips        = 17,400 × 3.2         = 55,680
  internal_worker_trips = 18,000 × 2.1 × 50%  = 18,900
  internal_visitor_trips=  7,080 × 1.5 × 20%  =  2,124
  all_internal_trips    = 55,680 + 18,900 + 2,124 = 76,704

  Walking (60% of internal) = 76,704 × 0.60   = 46,022   → filtered out
  transport_internal    = 76,704 × 0.40        = 30,682

D_transport (net) = inbound_trips + transport_internal
                  = 27,396 + 30,682
                  = 58,078 trips/day   (−44.2% vs D_total)
```

### Modal allocation

Two allocation matrices split D_transport by vehicle type:

**Inbound modal split** (27,396 trips):

| Mode               | Share | Trips/day |
|--------------------|------:|----------:|
| Autonomous bus     | 35%   | 9,589     |
| Autonomous shuttle | 25%   | 6,849     |
| Car-share EV       | 25%   | 6,849     |
| Autonomous pod     | 15%   | 4,109     |

**Internal modal split** (30,682 trips):

| Mode               | Share | Trips/day |
|--------------------|------:|----------:|
| E-Bike             | 45%   | 13,807    |
| Autonomous pod     | 35%   | 10,739    |
| Autonomous shuttle | 20%   |  6,136    |

### Fleet sizing formula

```
on_street(mode) = ⌈ (peak_trips(mode) / capacity) × trip_duration_h ⌉
fleet_total(mode) = ⌈ on_street × peak_factor ⌉
charging(mode)    = ⌈ fleet_total × charging_rate ⌉
```

Vehicle parameters:

| Mode               | Capacity | Trip h | Peak factor | Charging rate | Source                      |
|--------------------|:--------:|:------:|:-----------:|:-------------:|-----------------------------|
| E-Bike             | 1        | 0.25   | 1.20        | 50%           | Nextbike operational data   |
| Autonomous shuttle | 12       | 0.25   | 1.30        | 30%           | UITP benchmarks             |
| Autonomous bus     | 25       | 0.40   | 1.35        | 30%           | UITP urban bus benchmarks   |
| Autonomous pod     | 1.5      | 0.20   | 1.20        | 30%           | MOIA Hamburg analogue       |
| Car-share EV       | 3.5      | 0.50   | 1.15        | 30%           | Share Now / Stadtmobil data |

### Fleet results

| Mode               | Trips/day | Peak/h | On-street | Fleet total | Charging pts |
|--------------------|----------:|-------:|----------:|------------:|-------------:|
| E-Bike             | 13,807    |  ~1,207|       303 |         364 |          182 |
| Autonomous pod     | 14,848    |  ~1,297|       174 |         209 |           63 |
| Autonomous shuttle | 12,985    |  ~1,134|        24 |          31 |           10 |
| Autonomous bus     |  9,589    |    ~838|        13 |          18 |            6 |
| Car-share EV       |  6,849    |    ~599|         9 |          10 |            3 |

> Exact values are computed live in `DataPanel.jsx`. The table above shows approximate rounded figures.

**Summary:**

| Metric              | Value                    |
|---------------------|--------------------------|
| D_transport (net)   | ~58,078 trips/day        |
| Total fleet         | ~632 vehicles + bikes    |
| Cars replaced       | 49,648 private cars/day  |
| Replacement ratio   | 1 : ~78 (1 shared vehicle replaces ~78 private cars in daily circulation) |
| Total charging pts  | ~264 simultaneous        |
| Walking filtered    | 60% of internal trips    |

### Replacement ratio interpretation

49,648 private vehicles replaced by ~632 shared units.
One shared vehicle replaces approximately 78 private cars in daily throughput —
because shared vehicles make multiple trips per day while private cars sit parked ~23 h/day.

---

## Part 3 · Hub Network

### Hub count derivation

Hub counts come from **coverage geometry**, not fleet demand alone.
A 1.35× overlap factor accounts for irregular street grids and dead zones between circles.

```
Hub S (r = 200 m):
  hub_s_count = ⌈ (4,000,000 m² / π × 200²) × 1.35 ⌉
              = ⌈ (4,000,000 / 125,664) × 1.35 ⌉
              ≈ 43 hubs

Hub M (r = 400 m):
  hub_m_from_geometry = ⌈ (4,000,000 / π × 400²) × 1.35 ⌉ ≈ 11
  hub_m_from_shuttle  = ⌈ shuttle_fleet / 3 ⌉
  hub_m_count = max(geometry, shuttle) ≈ 11 hubs

Hub L:
  hub_l_from_fleet = ⌈ (bus_fleet + car_share_fleet) / 8 ⌉
  hub_l_count = min(max(fleet_estimate, 3), 6)   ← capped at 6 (existing garages)
              ≈ 4 hubs
```

### Hub tier descriptions

| Tier  | Count | Type                          | Service radius |
|-------|------:|-------------------------------|:--------------:|
| Hub L |  ~4   | Large interchange (parking garages / transit nodes) | — |
| Hub M | ~11   | District hub (street-level, covered)                | 400 m |
| Hub S | ~43   | Micro-hub (on-street docking point)                 | 200 m |

### Fleet distribution across tiers

| Mode               | Hub L | Hub M | Hub S |
|--------------------|------:|------:|------:|
| Car-share EV       | 100%  |   0%  |   0%  |
| Autonomous bus     | 100%  |   0%  |   0%  |
| Autonomous shuttle |  50%  |  50%  |   0%  |
| Autonomous pod     |  30%  |  50%  |  20%  |
| E-Bike             |   0%  |  30%  |  70%  |

Per-hub allocation includes a **20% operational reserve** (rounded up).

### Charging and footprint per hub

| Tier  | Charging pts/hub | Footprint/hub |
|-------|:----------------:|:-------------:|
| Hub L | (computed live)  | (computed live) |
| Hub M | (computed live)  | (computed live) |
| Hub S | (computed live)  | (computed live) |

Footprint per vehicle type (m²): e-bike 2 · pod 8 · shuttle 30 · bus 55 · car-share EV 12.

---

## Part 4 · Hub Area Calculation

### Formula

```
S_hub = S_fleet + S_circ + S_charging + S_program

S_fleet    = Σ (units_per_hub × m²/vehicle)
S_circ     = S_fleet × (circulation_factor − 1)
S_charging = Σ ⌈units × charging_rate⌉ × station_m²
S_program  = (S_fleet + S_circ + S_charging) × 10%
```

### Footprint per vehicle unit

| Mode               | m²/unit |
|--------------------|--------:|
| E-Bike             | 2.5     |
| Autonomous pod     | 10      |
| Autonomous shuttle | 35      |
| Autonomous bus     | 60      |
| Car-share EV       | 15      |

### Circulation factors

| Tier  | Factor | Notes                                          |
|-------|:------:|------------------------------------------------|
| Hub L | ×1.60  | Wide driveways, bus turning radii              |
| Hub M | ×1.40  | Mixed vehicle access                           |
| Hub S | ×1.20  | Pedestrian + micro-vehicle only                |

### Charging station area

- E-bike dock: 0.5 m²
- EV / autonomous vehicle charger: 4.0 m²

### Program area

10% of (fleet + circulation + charging) — covers sheltered waiting zones, real-time information displays, minor service areas.

### Total footprint

All hubs combined require approximately **a few thousand m²** — under 1% of the 4 km² zone,
equivalent to a single urban block. Exact figure computed live in `DataPanel.jsx`.

Hub L accounts for the largest share of total area (despite fewest sites) due to bus and car-share depot requirements.

---

## Methodology summary

### Part 1 — Baseline

- Population: WOKS 2023 per-district data.
- Workers: WOKS Arbeitsmarktbericht 2025.
- Visitors: 20% of residents + workers (MiD 2017 short-trip pattern for mid-size German cities).
- Trip rates: MiD 2017 national averages (residents 3.2 · workers 2.1 · visitors 1.5 trips/day).
- Modal split: MiD 2017 baseline, private car +4 pp to 62% to reflect KBA 2023 Wolfsburg registration data.
- Peak hour: 08–09h = 8.5% of D_total (MiD 2017 hourly profile).

### Part 2 — Fleet sizing

- Inbound / internal split: 50% of worker trips and 80% of visitor trips treated as inbound.
- Walking filter: 60% of internal trips assumed walkable (MiD 2017 short-distance rates for dense urban cores).
- On-street formula: `⌈(peak_trips / capacity) × trip_duration⌉`.
- Peak factor range: 1.15 (car-share EV) to 1.35 (autonomous bus).
- Charging rates: 50% simultaneous for e-bikes (Nextbike standard), 30% for all other modes (UITP autonomous vehicle guidelines).
- Baseline car count: KBA 2023 registration data for Wolfsburg ÷ average utilisation.

### Part 3 — Hub network

- Hub S and Hub M counts from coverage geometry with 1.35× overlap factor.
- Hub L capped at max 6 (number of repurposable large parking structures in zone).
- Fleet-to-hub assignment via fixed distribution matrix.
- 20% operational reserve added per hub, rounded up.

### Part 4 — Hub area

- Vehicle footprint values from standard parking and depot design references.
- Circulation factor applied to fleet area only (not charging or program).
- Charging station count = `⌈units × charging_rate⌉`, area per station type.
- Program = 10% of subtotal (fleet + circ + charging).

---

## Data sources

| Dataset | Source | Notes |
|---------|--------|-------|
| District population | WOKS Wolfsburg 2023 | 9 central districts |
| Workers in zone | WOKS Arbeitsmarktbericht 2025 | Employment zone data |
| Trip generation rates | MiD 2017 (BMVI) | Mobilität in Deutschland |
| Modal split | MiD 2017 + KBA 2023 | Car share adjusted +4 pp |
| E-bike fleet & charging | Nextbike operational data | Active fleet benchmarks |
| Autonomous shuttle | UITP benchmarks | Urban shuttle operations |
| Autonomous bus | UITP urban bus benchmarks | Urban transit operations |
| Autonomous pod | MOIA Hamburg analogue | On-demand pod operations |
| Car-share EV | Share Now / Stadtmobil data | Free-floating car-share |
| Hub geometry | Coverage radius formula | 200 m (S) / 400 m (M) / existing garages (L) |

---

## Calculation scripts (Python, `analysis/`)

The platform UI computes everything live in JS (`DataPanel.jsx`).
The Python scripts in `analysis/` were used for validation and chart generation:

```
analysis/modal_distribution.py   → baseline modal split → results_baseline.csv
analysis/fleet_calculation.py    → fleet sizing → results_fleet.csv
analysis/hub_calculation.py      → per-hub infrastructure → results_hubs.csv
analysis/hub_area.py             → footprint breakdown + PNG charts
```

Outputs land in `analysis/outputs/`.
