#!/usr/bin/env python3
"""
Patch DataPanel.jsx:
  1. Replace Slide wrapper — top-aligned header (consistent title level), content fills rest
  2. Remove S23_Methods from ALL_SLIDES, update PART_NAV
  3. Add MethodsOverlay component (full methodology text)
  4. Add showMethods state, button on last slide, overlay render
"""
import re, os

FILE = r'c:\Users\mmlll\Documents\Github\WWWWW\src\components\DataPanel.jsx'

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1. Replace Slide wrapper ──────────────────────────────────────────────────
OLD_SLIDE = """// Wrapper for every slide: centered vertically + horizontally, StrategyPanel-matching typography
function Slide({ eyebrow, title, sub, children }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 72px 28px 60px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <div className="dp-a" style={{ marginBottom: 22 }}>
          {eyebrow && <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{eyebrow}</div>}
          <h2 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: C.text1, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px' }}>{title}</h2>
          {sub && <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, marginTop: 14, lineHeight: 1.75, maxWidth: 560, marginBottom: 0 }}>{sub}</p>}
        </div>
        <div className="dp-a">
          {children}
        </div>
      </div>"""

NEW_SLIDE = """// Consistent slide frame: header always at same top position, content fills remaining space
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
      </div>"""

assert OLD_SLIDE in src, "OLD_SLIDE not found"
src = src.replace(OLD_SLIDE, NEW_SLIDE, 1)

# ── 2. Remove S23_Methods from ALL_SLIDES ────────────────────────────────────
src = src.replace(
    """const ALL_SLIDES = [
  S01_Intro, S02_Demand, S03_ModalDistrict, S04_Hourly, S05_BaselineTable,
  S06_FleetIntro, S07_Flow, S08_ModeCards, S09_OnStreet, S10_Replacement,
  S11_DotMatrix, S12_Charging, S13_FleetTable,
  S14_HubIntro, S15_HubHeatmap, S16_HubBars, S17_HubCards, S18_HubInfra,
  S19_AreaIntro, S20_AreaBars, S21_AreaDonut, S22_AreaTable,
  S23_Methods,
]""",
    """const ALL_SLIDES = [
  S01_Intro, S02_Demand, S03_ModalDistrict, S04_Hourly, S05_BaselineTable,
  S06_FleetIntro, S07_Flow, S08_ModeCards, S09_OnStreet, S10_Replacement,
  S11_DotMatrix, S12_Charging, S13_FleetTable,
  S14_HubIntro, S15_HubHeatmap, S16_HubBars, S17_HubCards, S18_HubInfra,
  S19_AreaIntro, S20_AreaBars, S21_AreaDonut, S22_AreaTable,
]
const LAST_SLIDE_IDX = ALL_SLIDES.length - 1  // 21 = S22_AreaTable""",
    1
)

# ── 3. Update PART_NAV — remove Methodology, last part ends at 21 ─────────────
src = src.replace(
    """const PART_NAV = [
  { label: 'Modal Distribution', eyebrow: 'Part 1', first: 0,  last: 4  },
  { label: 'Post-Car Fleet',     eyebrow: 'Part 2', first: 5,  last: 12 },
  { label: 'Hub Network',        eyebrow: 'Part 3', first: 13, last: 17 },
  { label: 'Hub Area',           eyebrow: 'Part 4', first: 18, last: 21 },
  { label: 'Methodology',        eyebrow: 'Appendix', first: 22, last: 22 },
]""",
    """const PART_NAV = [
  { label: 'Modal Distribution', eyebrow: 'Part 1', first: 0,  last: 4  },
  { label: 'Post-Car Fleet',     eyebrow: 'Part 2', first: 5,  last: 12 },
  { label: 'Hub Network',        eyebrow: 'Part 3', first: 13, last: 17 },
  { label: 'Hub Area',           eyebrow: 'Part 4', first: 18, last: 21 },
]""",
    1
)

# ── 4. Add showMethods state to DataPanel ─────────────────────────────────────
src = src.replace(
    "  const [slide, setSlide] = useState(0)\n  const outerRef = useRef(null)",
    "  const [slide, setSlide] = useState(0)\n  const [showMethods, setShowMethods] = useState(false)\n  const outerRef = useRef(null)",
    1
)

# ── 5. Update the render to add overlay button + overlay panel ────────────────
src = src.replace(
    """      {/* ── Full-screen slide + right handle ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div key={slide} ref={slideRef} className="dp-slide"
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
          <SlideComp />
        </div>
        <SlideHandle total={ALL_SLIDES.length} slide={slide} onGo={(i) => { busy.current = false; setSlide(i) }} />
      </div>
    </div>
  )
}""",
    """      {/* ── Full-screen slide + right handle ── */}
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
}""",
    1
)

# ── 6. Insert MethodsOverlay component before S23_Methods ─────────────────────
METHODS_COMPONENT = """
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
              {box('Net transport demand', 'inbound trips + internal transport\\n(after walking filter)', `D_transport = ${fmt(D_transport)}`)}
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
                { tier: 'Hub M', color: HUB_COLORS_UI.hub_m, formula: 'max(geometry r=400m,\\nshuttle_fleet ÷ 3)', result: `= ${hub_m_count} hubs`, note: '400 m, shuttle coverage' },
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

"""

# Insert MethodsOverlay before S23_Methods
assert 'function S23_Methods()' in src, "S23_Methods not found"
src = src.replace('function S23_Methods()', METHODS_COMPONENT + 'function S23_Methods()', 1)

with open(FILE, 'w', encoding='utf-8', newline='') as f:
    f.write(src)

with open(FILE, 'r', encoding='utf-8') as f:
    total = sum(1 for _ in f)
print(f'Done. Total lines: {total}')
