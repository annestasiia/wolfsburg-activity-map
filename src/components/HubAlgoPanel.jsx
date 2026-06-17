import React, { useRef, useEffect, useState } from 'react'

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const C = { bg: '#FFFFFF', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }

const CSS_ANIM = `
.ha-a{opacity:0;transform:translateY(18px);transition:opacity 600ms cubic-bezier(.4,0,.2,1),transform 600ms cubic-bezier(.4,0,.2,1)}
.ha-a.ha-v{opacity:1;transform:translateY(0)}
`

const PHASES = [
  { num: '01', label: 'Data Collection' },
  { num: '02', label: 'Mobility Analysis' },
  { num: '03', label: 'Facilities Analysis' },
  { num: '04', label: 'Greenery Analysis' },
  { num: '05', label: 'Hub Placement' },
  { num: '06', label: 'Network Validation' },
]

const REFS = [
  { id: 1, text: 'OpenStreetMap contributors. Open Database License (ODbL) 1.0. openstreetmap.org' },
  { id: 2, text: 'City of Wolfsburg Open Data Portal. opendata.wolfsburg.de. CC BY 4.0' },
  { id: 3, text: 'Google Maps — Popular Times feature. Used as a proxy for pedestrian activity estimation per street segment and venue.' },
  { id: 4, text: 'Overpass API. Turbo instance: overpass-api.de. Data returned via osmtogeojson.' },
  { id: 5, text: 'Nominatim Geocoding API. nominatim.openstreetmap.org. Usage policy: 1 req/sec, no bulk geocoding.' },
  { id: 6, text: 'Bundesministerium für Digitales und Verkehr (BMDV). Mobilität in Deutschland (MiD) 2023. Conducted by infas, DLR, IVT.' },
  { id: 7, text: 'Daskin, M.S. (1995). Network and Discrete Location: Models, Algorithms, and Applications. Wiley. — Theoretical basis for coverage-based facility placement.' },
  { id: 8, text: 'Church, R. & ReVelle, C. (1974). The maximal covering location problem. Papers of the Regional Science Association, 32(1), 101–118.' },
]

function Block({ children, mb = 48 }) {
  return (
    <div className="ha-a" style={{ marginBottom: mb }}>
      {children}
    </div>
  )
}

function Eyebrow({ children }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function H1({ children }) {
  return (
    <h1 style={{ fontFamily: FONT, fontSize: 56, fontWeight: 700, color: C.text1, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '0 0 24px' }}>
      {children}
    </h1>
  )
}

function H2({ children }) {
  return (
    <h2 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: C.text1, margin: '0 0 18px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
      {children}
    </h2>
  )
}

function H3({ children }) {
  return (
    <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.text1, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
      {children}
    </h3>
  )
}

function Body({ children, style = {} }) {
  return (
    <p style={{ fontFamily: FONT, fontSize: 14, color: C.text2, lineHeight: 1.75, margin: '0 0 14px', maxWidth: 560, ...style }}>
      {children}
    </p>
  )
}

function Ref({ n }) {
  return (
    <sup style={{ fontFamily: FONT, fontSize: 9, color: C.text3, marginLeft: 1, verticalAlign: 'super', lineHeight: 0 }}>
      [{n}]
    </sup>
  )
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: '8px 0 48px' }} />
}

function PhaseTag({ num, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '6px 12px', border: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.12em' }}>PHASE {num}</span>
      <span style={{ width: 1, height: 10, background: C.border }} />
      <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.text1, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

function DataRow({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: FONT, fontSize: 12, color: C.text3, width: 160, flexShrink: 0, paddingTop: 1 }}>{label}</div>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.text1 }}>{value}</div>
        {sub && <div style={{ fontFamily: FONT, fontSize: 12, color: C.text3, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function FormulaBox({ children }) {
  return (
    <div style={{
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: 13,
      color: C.text1,
      background: '#F7F7F7',
      border: `1px solid ${C.border}`,
      padding: '16px 20px',
      margin: '16px 0',
      lineHeight: 1.8,
      maxWidth: 540,
      whiteSpace: 'pre',
      overflowX: 'auto',
    }}>
      {children}
    </div>
  )
}

function ScoreGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, margin: '16px 0', maxWidth: 540, border: `1px solid ${C.border}` }}>
      {items.map(({ label, weight, desc }, i) => (
        <div key={i} style={{ padding: '14px 16px', borderRight: i % 2 === 0 ? `1px solid ${C.border}` : 'none', borderBottom: i < items.length - 2 ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.text1, marginBottom: 4 }}>{label}</div>
          <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.text1, marginBottom: 4, letterSpacing: '-0.02em' }}>{weight}</div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.text3, lineHeight: 1.5 }}>{desc}</div>
        </div>
      ))}
    </div>
  )
}

export default function HubAlgoPanel() {
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
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('ha-v') }),
        { threshold: 0.08, root: el }
      )
      el.querySelectorAll('.ha-a').forEach(n => obs.observe(n))
      return () => obs.disconnect()
    }, 60)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'var(--nav-w)', right: 0, zIndex: 10, background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{CSS_ANIM}</style>

      {/* Progress bar */}
      <div style={{ height: 3, background: C.border, flexShrink: 0 }}>
        <div style={{ height: '100%', background: C.text1, width: `${progress * 100}%`, transition: 'width 80ms linear' }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '72px 56px 120px' }}>

          {/* ── Header ── */}
          <Block mb={56}>
            <Eyebrow>Hub System · 03 — Algorithm Work</Eyebrow>
            <H1>Hubs Algorithm Work</H1>
            <p style={{ fontFamily: FONT, fontSize: 16, color: C.text2, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 560 }}>
              How the hub placement system works — from raw urban data
              to a three-tier mobility network. Six phases, fully traceable.
            </p>

            {/* Phase index */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.border}`, maxWidth: 440 }}>
              {PHASES.map(({ num, label }, i) => (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: i < PHASES.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.10em', width: 24 }}>{num}</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: C.text1 }}>{label}</span>
                </div>
              ))}
            </div>
          </Block>

          <Divider />

          {/* ── Phase 01 — Data Collection ── */}
          <Block>
            <PhaseTag num="01" label="Data Collection" />
            <H2>Urban Data from Open Sources</H2>
            <Body>
              All spatial analysis is grounded in openly licensed geodata. No proprietary datasets.
              The pipeline ingests data from three primary sources: OpenStreetMap<Ref n={1} /> via the
              Overpass API<Ref n={4} />, official open data published by the City of Wolfsburg<Ref n={2} />,
              and pedestrian activity data collected via Google Maps.<Ref n={3} />
            </Body>
            <Body>
              The full spatial analysis covers the entire city of Wolfsburg — all administrative
              districts, the complete road and cycling network, and the city-wide population
              of approximately 125,000 residents. Urban design interventions (hub placement,
              street-level redesign) were subsequently focused on the central zone, as it
              is the densest, most car-dependent, and highest-demand area of the city.
            </Body>

            <div style={{ marginTop: 8 }}>
              <DataRow
                label="OpenStreetMap / Overpass API"
                value="Roads · Footways · Bus stops · Car parking · Bike parking · Facilities · Historic sites · Parks & forests · Cycling network · Landuse"
                sub="Queried per node/way/relation type across the full Wolfsburg bounding box. Returned as GeoJSON via osmtogeojson.[1][4]"
              />
              <DataRow
                label="City of Wolfsburg Open Data"
                value="Venue registry · Facility categories · Cycling infrastructure · Landuse classification · Car parking inventory"
                sub="Provided in .xlsx format. Venue addresses geocoded via Nominatim (1 req/sec policy respected).[2][5]"
              />
              <DataRow
                label="Google Maps — Popular Times"
                value="Pedestrian activity by hour · Street-level foot traffic patterns"
                sub="Used to construct a pedestrian heat map: understanding which streets and zones attract people, and at what times of day.[3]"
              />
              <DataRow
                label="District boundaries"
                value="All administrative districts of Wolfsburg — polygon geometries"
                sub="OSM relation query. Stored as bundled GeoJSON in src/data/districtBoundaries.json.[1]"
              />
              <DataRow
                label="Coordinate system"
                value="WGS 84 (EPSG:4326)"
                sub="All calculations use geographic coordinates. Haversine formula for metric distance approximation."
              />
            </div>
          </Block>

          <Divider />

          {/* ── Phase 02 — Mobility Analysis ── */}
          <Block>
            <PhaseTag num="02" label="Mobility Analysis" />
            <H2>District-Level Transport Scoring</H2>
            <Body>
              Each district receives a composite mobility score based on the density and
              accessibility of transport infrastructure within its boundaries. The score
              drives demand estimation for hub sizing across the full city.
            </Body>

            <H3>Scoring components</H3>
            <ScoreGrid items={[
              { label: 'Bus stop density', weight: '35%', desc: 'Stops per km² within district polygon' },
              { label: 'Road connectivity', weight: '25%', desc: 'Road segment count, normalised by area' },
              { label: 'Cycling network', weight: '20%', desc: 'Bike lane length intersecting district' },
              { label: 'Pedestrian paths', weight: '20%', desc: 'Footway coverage relative to area' },
            ]} />

            <Body style={{ marginTop: 16 }}>
              Scores are normalised 0–100 across all districts. Districts scoring above 70
              are flagged as high-demand zones; below 40 as underserved. The modal split
              baseline is derived from the weighted average of all district scores.
            </Body>

            <FormulaBox>{`MobilityScore(d) =
  0.35 × BusStopDensity(d)
+ 0.25 × RoadConnectivity(d)
+ 0.20 × CyclingCoverage(d)
+ 0.20 × FootwayCoverage(d)

All terms normalised to [0, 1] before weighting.`}</FormulaBox>

            <H3>Modal split baseline</H3>
            <Body>
              The Wolfsburg modal split is estimated from transport infrastructure density
              and calibrated against German mobility surveys.<Ref n={6} /> Baseline assumption
              for the city: 61 % private car, 14 % transit, 13 % cycling, 12 % walking.
              The post-car scenario targets 0 % private car ownership, redistributed to
              shared fleet, cycling, and walking according to trip-distance profiles.
            </Body>
          </Block>

          <Divider />

          {/* ── Phase 03 — Facilities Analysis ── */}
          <Block>
            <PhaseTag num="03" label="Facilities Analysis" />
            <H2>Point-of-Interest Density & Temporal Demand</H2>
            <Body>
              Facilities analysis maps the location, category, and temporal activity of
              every significant venue in the study area. This determines where mobility
              demand concentrates — and when.
            </Body>

            <H3>Venue categorisation</H3>
            <Body>
              Each venue is tagged to one of seven primary categories derived from its
              OSM amenity/shop/tourism tags, or from the Wolfsburg venue registry<Ref n={2} />:
            </Body>

            <div style={{ margin: '0 0 20px', maxWidth: 540 }}>
              {[
                ['Work & employment', 'office, industrial, workspace'],
                ['Commerce & retail', 'shop, market, mall'],
                ['Food & beverage', 'restaurant, café, bar, fast_food'],
                ['Health & care', 'hospital, clinic, pharmacy, social_facility'],
                ['Education', 'school, university, kindergarten, library'],
                ['Recreation', 'leisure, sports, park amenity, cultural'],
                ['Transit infrastructure', 'bus_stop, parking, bicycle_parking'],
              ].map(([cat, tags], i) => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '11px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.text1, width: 180, flexShrink: 0 }}>{cat}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: C.text3 }}>{tags}</div>
                </div>
              ))}
            </div>

            <H3>Pedestrian activity & temporal demand</H3>
            <Body>
              To understand actual foot traffic — not just where venues exist, but where
              people genuinely go — pedestrian activity data was collected from Google Maps
              Popular Times.<Ref n={3} /> This data provides hourly visitor counts per venue,
              which were aggregated into a city-wide pedestrian heat map: a 7 × 24 matrix
              of activity intensity per street cluster, per hour of the week.
            </Body>
            <Body>
              The resulting temporal demand curve — peak hours, shoulder periods, overnight minima —
              directly informs hub fleet dispatch schedules in Phase 05, and validates
              whether the venue-density model aligns with observed human movement.
            </Body>

            <H3>Accessibility radius</H3>
            <Body>
              Each venue's contribution to demand is weighted by proximity to the nearest
              hub candidate. Venues within 300 m contribute fully; beyond 600 m the
              weight decays linearly to zero. This models realistic walking tolerance
              for last-metre access.
            </Body>
          </Block>

          <Divider />

          {/* ── Phase 04 — Greenery Analysis ── */}
          <Block>
            <PhaseTag num="04" label="Greenery Analysis" />
            <H2>Green Space & Social Infrastructure Scoring</H2>
            <Body>
              Green and social space analysis provides a quality-of-life layer that
              modifies hub priority. Districts with low green access and fragmented
              social infrastructure are flagged for additional small (S-tier) hubs
              to improve network equity.
            </Body>

            <H3>Green space coverage</H3>
            <Body>
              Parks, forests, and water bodies are fetched as polygon geometries from OSM.<Ref n={1} /> For each
              district the analysis computes: total green area in m², green coverage ratio
              (green m² / district m²), and the count of distinct green features weighted
              by type.
            </Body>

            <ScoreGrid items={[
              { label: 'Parks', weight: '1.0×', desc: 'Manicured public parks, playground areas' },
              { label: 'Forest', weight: '0.8×', desc: 'Natural woodland within district bounds' },
              { label: 'Water', weight: '0.6×', desc: 'Canals, ponds, river banks' },
              { label: 'Street greenery', weight: '0.3×', desc: 'Trees, verges, small planted areas' },
            ]} />

            <H3>Green Social Indicator (GSI)</H3>
            <Body>
              The GSI combines green coverage with social facility density (healthcare, childcare,
              community centres, places of worship). A district with high green coverage but
              low social facility density scores medium — both dimensions matter.
            </Body>

            <FormulaBox>{`GSI(d) =
  0.6 × GreenCoverage(d)          // [0,1] ratio
+ 0.4 × SocialFacilityDensity(d) // facilities per km²

GSI is then standardised across all districts (z-score),
clamped to [0, 100].`}</FormulaBox>

            <Body>
              Districts in the bottom quartile of GSI receive a +15 % hub demand multiplier
              in Phase 05, ensuring that underserved areas are not systematically under-hubbed
              despite lower measured activity.
            </Body>
          </Block>

          <Divider />

          {/* ── Phase 05 — Hub Placement ── */}
          <Block>
            <PhaseTag num="05" label="Hub Placement" />
            <H2>Three-Tier Network Construction</H2>
            <Body>
              Hub placement synthesises all prior scores into a spatial optimisation problem:
              given the city-wide demand map, find the minimum set of hub locations that
              satisfies coverage requirements, grouped into three tiers by capacity.
              The method is based on the Maximal Covering Location Problem (MCLP)<Ref n={7} /><Ref n={8} /> —
              adapted here for a multi-tier, weighted-demand variant.
            </Body>

            <H3>Composite hub score</H3>
            <Body>
              Every candidate location is evaluated against four input dimensions derived
              from Phases 02–04. These are combined into a single HubScore that ranks
              candidates for selection:
            </Body>

            <FormulaBox>{`HubScore(c) =
  w_mob  × MobilityScore(district(c))   // Phase 02
+ w_fac  × FacilityDensity(c, r=400m)  // Phase 03
+ w_gsi  × GSI(district(c))            // Phase 04
+ w_cov  × UnservedDemandCoverage(c)   // remaining demand not yet covered

Default weights: w_mob=0.35, w_fac=0.30, w_gsi=0.15, w_cov=0.20

UnservedDemandCoverage(c) decreases as hubs are placed —
forcing the algorithm to spread coverage rather than
cluster in already-served high-score areas.`}</FormulaBox>

            <H3>Hub tiers & placement criteria</H3>
            <Body>
              Tiers are not assigned by geography — they are assigned by HubScore rank and
              the cumulative demand within each hub's service radius. Each tier has a
              distinct set of placement parameters:
            </Body>

            <div style={{ margin: '0 0 24px', maxWidth: 560 }}>
              {[
                {
                  tier: 'L — Large',
                  capacity: '80–120 vehicles',
                  radius: '600 m service radius',
                  desc: 'City-centre anchors and major interchange nodes. Selected from the top 10 % of HubScore candidates. Required criteria: MobilityScore > 70, FacilityDensity > 80th percentile, direct adjacency to public transit stop. Full fleet mix: autonomous pods, e-bikes, shared EVs, on-demand shuttles. 24 h operation. Minimum 2 per study zone.',
                },
                {
                  tier: 'M — Medium',
                  capacity: '30–50 vehicles',
                  radius: '400 m service radius',
                  desc: 'District connectors serving residential and employment zones. Selected from the next 30 % of HubScore candidates. Required criteria: MobilityScore 40–70, mixed-use landuse within 200 m, no existing L-hub within 500 m. Core fleet: pods and e-bikes. Operating hours tied to district demand profile. Minimum 5 per study zone.',
                },
                {
                  tier: 'S — Small',
                  capacity: '8–15 vehicles',
                  radius: '250 m service radius',
                  desc: 'Last-metre nodes targeting gaps in coverage. Selected to cover demand not reachable by L or M hubs. Priority given to districts with GSI below the 25th percentile or MobilityScore below 40. Fleet: e-bikes and micro-pods only. Minimum 8 per study zone.',
                },
              ].map(({ tier, capacity, radius, desc }, i) => (
                <div key={i} style={{ padding: '20px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.text1, width: 120, flexShrink: 0 }}>{tier}</div>
                    <div>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: C.text1 }}>{capacity}</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: C.text3, margin: '0 8px' }}>·</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: C.text3 }}>{radius}</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: C.text2, lineHeight: 1.65, paddingLeft: 136 }}>{desc}</div>
                </div>
              ))}
            </div>

            <H3>Greedy placement algorithm</H3>
            <Body>
              Hub candidates are generated at 100 m grid intersections across the study area,
              filtered to exclude water bodies and highway carriageways. The greedy algorithm
              selects hubs iteratively: the candidate with the highest HubScore is selected,
              its coverage radius is applied to reduce the UnservedDemandCoverage term for
              neighbouring candidates, and the process repeats until target coverage
              (≥ 90 % of city-wide demand within radius of some hub) is achieved.
            </Body>

            <H3>Tier assignment</H3>
            <Body>
              Once all candidate hubs are selected, tier assignment follows: top 10 % by
              HubScore become L-hubs; next 30 % become M-hubs; remainder become S-hubs.
              Minimum tier counts are enforced after assignment, with the lowest-scoring
              M-hubs downgraded to S if totals exceed capacity targets.
            </Body>
          </Block>

          <Divider />

          {/* ── Phase 06 — Network Validation ── */}
          <Block>
            <PhaseTag num="06" label="Network Validation" />
            <H2>Coverage, Charging & Footprint Checks</H2>
            <Body>
              After placement, the network is validated against four independent criteria.
              Failure on any criterion triggers a re-run of Phase 05 with adjusted weights.
            </Body>

            <div style={{ margin: '0 0 24px', maxWidth: 560 }}>
              {[
                { check: 'Population coverage', threshold: '≥ 90 % of residents within 400 m of any hub', pass: 'Verified against district centroid + polygon intersection across all Wolfsburg districts' },
                { check: 'Demand coverage', threshold: '≥ 85 % of daily trip demand within hub radius', pass: 'Calculated from facility density × pedestrian activity demand curves' },
                { check: 'Charging capacity', threshold: 'L-hub: ≥ 40 charge points · M-hub: ≥ 15 · S-hub: ≥ 6', pass: 'Fleet size × assumed simultaneous charge ratio (0.4)' },
                { check: 'Land footprint', threshold: 'Total hub area ≤ recovered parking area', pass: 'L: 1,200 m² · M: 400 m² · S: 80 m². Compared against car parking inventory from Wolfsburg open data.[2]' },
              ].map(({ check, threshold, pass }, i) => (
                <div key={i} style={{ padding: '16px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.text1, marginBottom: 6 }}>{check}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: C.text2, marginBottom: 4 }}>{threshold}</div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: C.text3 }}>{pass}</div>
                </div>
              ))}
            </div>

            <H3>Sensitivity</H3>
            <Body>
              The algorithm is re-run with ± 20 % perturbation on each input weight to test
              stability. Hub locations that appear in &gt; 80 % of perturbation runs are
              marked as robust placements. Locations that drop out under small perturbation
              are flagged for manual review.
            </Body>
          </Block>

          <Divider />

          {/* ── Coda ── */}
          <Block mb={48}>
            <H2>What the Tool Shows</H2>
            <Body>
              The three interactive modes in the Hub System section expose different slices
              of this pipeline.
            </Body>
            <Body>
              <strong style={{ color: C.text1 }}>Geo Data Analysis</strong> was used for preliminary
              territorial analysis — overlaying different data layers (mobility, facilities, greenery,
              transport) to identify urban gaps, underserved zones, and spatial needs across the city.
              These layers were not decorative: they form the direct input to the hub placement model,
              and the district scores computed here are passed unchanged into Phase 05.
            </Body>
            <Body>
              <strong style={{ color: C.text1 }}>Hubs Placement Algorithm</strong> runs Phases 05–06
              live in the browser, producing the hub network from the current district scores.
              No pre-computed result is loaded — every run reflects the data in the bundled GeoJSON files.
            </Body>
            <Body>
              <strong style={{ color: C.text1 }}>Hub L·M·S network view</strong> overlays the resulting
              hub geometry on the city map with per-hub statistics: tier, capacity, coverage radius,
              fleet composition, and charging point count.
            </Body>
            <Body>
              All computation happens client-side. No server, no API key, no external storage.
            </Body>
          </Block>

          {/* ── References ── */}
          <Block mb={0}>
            <div style={{ borderTop: `2px solid ${C.text1}`, paddingTop: 24 }}>
              <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 20 }}>
                References & Data Sources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {REFS.map(({ id, text }) => (
                  <div key={id} style={{ display: 'flex', gap: 16, padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.text3, width: 20, flexShrink: 0, paddingTop: 1 }}>[{id}]</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: C.text2, lineHeight: 1.65 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Block>

        </div>
      </div>
    </div>
  )
}
