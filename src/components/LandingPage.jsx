import React, { useRef, useEffect } from 'react'
import { useAppStore } from '../store/appStore'

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SECTIONS = [
  {
    id: 'mobility',
    section: 'geo',
    mode: 'mobility',
    number: '01',
    eyebrow: 'Transport Analysis · OpenStreetMap',
    title: 'Mobility Infrastructure',
    what: 'District-level transport scoring across all Wolfsburg districts — bus stop density, road connectivity, cycling network coverage, and pedestrian footway extent. Each district receives a composite score from 0 to 10.',
    resources: 'OpenStreetMap via Overpass API: bus stops, road network, cycling paths, pedestrian footways. Density surfaces computed using Kernel Density Estimation (KDE). Processing in EPSG:25832.',
    findings: 'Central districts score highest on transport access. Outer districts are significantly underserved. Baseline modal split — 62% private car — is driven by active and public transport coverage gaps across the city.',
  },
  {
    id: 'livability',
    section: 'geo',
    mode: 'facilities',
    number: '02',
    eyebrow: 'Facility Analysis · OSM + Wolfsburg Open Data',
    title: 'Livability & Facilities',
    what: 'Point-of-interest density, venue categories, and temporal activity patterns across all districts. Seven venue categories mapped against pedestrian heat-map data to identify where people go — and when.',
    resources: 'OpenStreetMap amenity, shop, tourism tags. City of Wolfsburg venue registry. Google Maps Popular Times for pedestrian activity estimation per street segment.',
    findings: 'Food & beverage and commercial retail concentrate in the inner centre. Evening and weekend activity peaks around a small number of cultural and dining hotspots — demand patterns a shared fleet must be sized to absorb.',
  },
  {
    id: 'potential',
    section: 'geo',
    mode: 'greenery',
    number: '03',
    eyebrow: 'Greenery Analysis · OSM Polygon Data',
    title: 'Green Space & Social Potential',
    what: 'Green space coverage (parks, forests, water bodies) and social facility density per district, combined into a Green Social Indicator (GSI) that identifies areas with low environmental and social infrastructure quality.',
    resources: 'OpenStreetMap polygon geometries: parks (leisure=park), forests (landuse=forest), water (natural=water). Social facilities: hospital, school, community_centre, place_of_worship.',
    findings: 'Green coverage concentrates in northern and outer districts. Central districts have the lowest GSI scores — dense built fabric, minimal green infrastructure. These districts receive priority weighting in hub placement.',
  },
  {
    id: 'hub',
    section: 'hub',
    mode: 'hub-network',
    number: '04',
    eyebrow: 'Hub Placement Algorithm · Three-Tier Network',
    title: 'Hub System',
    what: 'Spatial optimisation of shared mobility hub locations, selecting from existing parking infrastructure via AHP-weighted composite scoring across all three prior analysis dimensions — Mobility, Livability, and Potential.',
    resources: 'Car parking inventory from OSM and Wolfsburg Open Data (multi-storey and underground facilities). AHP weights: Mobility 35%, Facilities 30%, Greenery 15%, Coverage 20%. Isochrone analysis via OSMnx + NetworkX.',
    findings: 'Three-tier network: Hub L (large interchanges at above-ground multi-storey car parks), Hub M (district hubs in underground car parks), Hub S (last-metre nodes at bus stops and bike parking outside L/M coverage). Replaces 49,648 private vehicles/day with ~630 shared vehicles and bikes.',
  },
]

const FURTHER = [
  { label: 'Post-Car Strategy',        id: 'strategy'  },
  { label: 'Capacity Analysis',        id: 'capacity'  },
  { label: 'Hubs Placement Algorithm', id: 'hub',      mode: 'hub-network' },
  { label: 'Hubs Algorithm Work',      id: 'hub-algo'  },
  { label: 'Urban Design',             id: 'urban'     },
]

export default function LandingPage() {
  const { setActiveSection, setActiveMode, setLandingSectionMode, setShowLanding, setNavOpen } = useAppStore()
  const sectionRefs = useRef([])

  // Set initial map view on mount
  useEffect(() => {
    setNavOpen(false)
    setLandingSectionMode('geo', 'mobility')
  }, [])

  // Switch map mode as sections scroll into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.idx, 10)
            const sec = SECTIONS[idx]
            if (sec) setLandingSectionMode(sec.section, sec.mode)
          }
        })
      },
      { threshold: 0.35, rootMargin: '0px 0px -15% 0px' }
    )
    sectionRefs.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  const navigateTo = (id, mode) => {
    setShowLanding(false)
    setNavOpen(true)
    setActiveSection(id)
    if (mode) setActiveMode(mode)
  }

  // Shared text style helpers
  const eyebrow = { fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 14 }
  const label   = { fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }
  const body    = { fontFamily: FONT, fontSize: 14, color: '#555', lineHeight: 1.85, margin: 0 }

  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, width: '50vw', height: '100vh',
      overflowY: 'auto', zIndex: 20,
      background: '#FFFFFF',
      borderRight: '1px solid #E8E8E8',
    }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 56px 64px',
      }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 32 }}>Research · Wolfsburg · 2026</div>
          <h1 style={{
            fontFamily: FONT,
            fontSize: 'clamp(60px, 8vw, 96px)',
            fontWeight: 700, color: '#111',
            lineHeight: 0.92, letterSpacing: '-0.05em',
            margin: '0 0 28px',
          }}>
            Auto-<br />Stadt
          </h1>
          <div style={{ width: 40, height: 2, background: '#111', marginBottom: 24 }} />
          <p style={{ ...body, fontSize: 16, color: '#444', maxWidth: 380, marginBottom: 52 }}>
            Autonomous mobility solution for the city of Wolfsburg.
            Integrated multimodal mobility infrastructure.
          </p>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: '#ccc', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          Scroll to explore &nbsp;↓
        </div>
      </section>

      {/* ── Project description ───────────────────────────────────────────── */}
      <section style={{ padding: '72px 56px', borderTop: '1px solid #E8E8E8' }}>
        <div style={eyebrow}>About the Project</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
          <div>
            <p style={{ ...body, marginBottom: 18 }}>
              A city where no one owns a private car. All mobility is shared, electric, and autonomous —
              on-demand, fleet-managed, and accessible to every resident.
              Wolfsburg, Germany's most car-dependent city per capita, is the test case.
            </p>
            <p style={body}>
              The project covers the entire city, with urban design interventions focused on the
              central 4 km² zone — the densest, most car-dependent, and highest-demand area.
            </p>
          </div>
          <div>
            <p style={{ ...body, marginBottom: 18 }}>
              Three layers of spatial analysis — Mobility, Livability, and Potential — feed a hub
              placement model that identifies and ranks existing parking structures
              for conversion into shared mobility infrastructure.
            </p>
            <p style={body}>
              The result: a three-tier hub network replacing 49,648 private vehicles per day
              with a shared autonomous fleet of approximately 630 vehicles and bikes.
            </p>
          </div>
        </div>
      </section>

      {/* ── Analysis sections ─────────────────────────────────────────────── */}
      {SECTIONS.map((sec, i) => (
        <section
          key={sec.id}
          data-idx={i}
          ref={el => { sectionRefs.current[i] = el }}
          style={{
            minHeight: '100vh',
            padding: '80px 56px',
            borderTop: '1px solid #E8E8E8',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}
        >
          <div style={eyebrow}>{sec.number} — {sec.eyebrow}</div>
          <h2 style={{
            fontFamily: FONT,
            fontSize: 'clamp(28px, 3.5vw, 44px)',
            fontWeight: 700, color: '#111',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            margin: '0 0 44px',
          }}>
            {sec.title}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 36 }}>
            <div>
              <div style={label}>What we analysed</div>
              <p style={body}>{sec.what}</p>
            </div>
            <div>
              <div style={label}>Data resources</div>
              <p style={body}>{sec.resources}</p>
            </div>
          </div>

          <div style={{ paddingTop: 28, borderTop: '1px solid #E8E8E8' }}>
            <div style={label}>{sec.id === 'hub' ? 'Results' : 'Findings'}</div>
            <p style={body}>{sec.findings}</p>
          </div>
        </section>
      ))}

      {/* ── Further Information ───────────────────────────────────────────── */}
      <section style={{ padding: '72px 56px', borderTop: '2px solid #111' }}>
        <div style={eyebrow}>Further Information</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FURTHER.map(({ label: lbl, id, mode }) => (
            <button
              key={id}
              onClick={() => navigateTo(id, mode)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 0',
                background: 'none', border: 'none', borderBottom: '1px solid #E8E8E8',
                cursor: 'pointer', width: '100%',
              }}
            >
              <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 400, color: '#111' }}>
                {lbl}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 18, color: '#bbb' }}>→</span>
            </button>
          ))}

          <a
            href="https://github.com/annestasiia/wolfsburg-activity-map"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 0', borderBottom: '1px solid #E8E8E8',
              color: '#111', textDecoration: 'none', fontFamily: FONT,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 400 }}>GitHub Repository</span>
            <span style={{ fontSize: 18, color: '#bbb' }}>↗</span>
          </a>
        </div>
      </section>

    </div>
  )
}
