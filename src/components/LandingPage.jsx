import React from 'react'
import { useAppStore } from '../store/appStore'
import MobilityMapSection  from './landing/MobilityMapSection'
import FacilitiesMapSection from './landing/FacilitiesMapSection'
import GreeneryMapSection  from './landing/GreeneryMapSection'
import HubMapSection       from './landing/HubMapSection'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const EY = { fontFamily: F, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 14 }
const LB = { fontFamily: F, fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }
const BD = { fontFamily: F, fontSize: 14, color: '#555', lineHeight: 1.85, margin: 0 }

const SECTIONS = [
  {
    id: 'mobility',
    number: '01',
    eyebrow: 'Transport Analysis · OpenStreetMap',
    title: 'Mobility Infrastructure',
    what: 'District-level transport scoring across all Wolfsburg districts — bus stop density, road connectivity, cycling network coverage, and pedestrian footway extent. Each district scored 0–10.',
    resources: 'OpenStreetMap via Overpass API: bus stops, road network, cycling paths, pedestrian footways. Density surfaces via Kernel Density Estimation (KDE). Processing in EPSG:25832.',
    findings: 'Central districts score highest on transport access. Outer districts significantly underserved. Baseline modal split — 62% private car — driven by active and public transport coverage gaps.',
    MapSection: MobilityMapSection,
  },
  {
    id: 'livability',
    number: '02',
    eyebrow: 'Facility Analysis · OSM + Wolfsburg Open Data',
    title: 'Livability & Facilities',
    what: 'Point-of-interest density, venue categories, and temporal activity patterns across all districts. Seven categories mapped against pedestrian heat-map data to identify where people go — and when.',
    resources: 'OpenStreetMap amenity, shop, tourism tags. City of Wolfsburg venue registry. Google Maps Popular Times for pedestrian activity estimation per street segment.',
    findings: 'Food & beverage and commercial retail concentrate in the inner centre. Evening and weekend activity peaks around a small number of cultural and dining hotspots — demand a shared fleet must absorb.',
    MapSection: FacilitiesMapSection,
  },
  {
    id: 'potential',
    number: '03',
    eyebrow: 'Greenery Analysis · OSM Polygon Data',
    title: 'Green Space & Social Potential',
    what: 'Green space coverage (parks, forests, water bodies) and social facility density per district, combined into a Green Social Indicator (GSI) identifying areas with low environmental and social quality.',
    resources: 'OpenStreetMap polygon geometries: parks (leisure=park), forests (landuse=forest), water (natural=water). Social facilities: hospital, school, community_centre, place_of_worship.',
    findings: 'Green coverage concentrates in northern and outer districts. Central districts have the lowest GSI scores — dense built fabric with minimal green infrastructure. Priority weighting in hub placement.',
    MapSection: GreeneryMapSection,
  },
  {
    id: 'hub',
    number: '04',
    eyebrow: 'Hub Placement Algorithm · Three-Tier Network',
    title: 'Hub System',
    what: 'Spatial optimisation of shared mobility hub locations, selecting from existing parking infrastructure via AHP-weighted composite scoring across all three analysis dimensions.',
    resources: 'Car parking inventory from OSM and Wolfsburg Open Data (multi-storey and underground facilities). AHP weights: Mobility 35%, Facilities 30%, Greenery 15%, Coverage 20%.',
    findings: 'Hub L (large interchanges at above-ground multi-storey car parks), Hub M (district hubs in underground car parks), Hub S (last-metre nodes). Replaces 49,648 private vehicles/day with ~630 shared vehicles and bikes.',
    MapSection: HubMapSection,
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
  const { setActiveSection, setActiveMode, setShowLanding, setNavOpen, setLandingSectionMode } = useAppStore()

  // Ensure nav is closed on landing
  React.useEffect(() => {
    setNavOpen(false)
    setLandingSectionMode('geo', 'mobility')
  }, [])

  const navigateTo = (id, mode) => {
    setShowLanding(false)
    setNavOpen(true)
    setActiveSection(id)
    if (mode) setActiveMode(mode)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      overflowY: 'auto', overflowX: 'hidden',
      zIndex: 100,
      background: '#FFFFFF',
      fontFamily: F,
    }}>

      {/* ── Hero — full width ──────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 72px 72px',
        borderBottom: '1px solid #E8E8E8',
      }}>
        <div>
          <div style={{ ...EY, marginBottom: 36 }}>Research · Wolfsburg · 2026</div>
          <h1 style={{
            fontFamily: F, fontSize: 'clamp(72px, 10vw, 128px)',
            fontWeight: 700, color: '#111',
            lineHeight: 0.90, letterSpacing: '-0.05em',
            margin: '0 0 32px',
          }}>
            Auto-<br />Stadt
          </h1>
          <div style={{ width: 48, height: 2, background: '#111', marginBottom: 28 }} />
          <p style={{ fontFamily: F, fontSize: 20, color: '#444', lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
            Autonomous mobility solution for the city of Wolfsburg.
            Integrated multimodal mobility infrastructure.
          </p>
        </div>
        <div style={{ fontFamily: F, fontSize: 11, color: '#ccc', letterSpacing: '0.10em', textTransform: 'uppercase', marginTop: 56 }}>
          Scroll to explore ↓
        </div>
      </section>

      {/* ── Project description — full width ──────────────────────────────── */}
      <section style={{ padding: '80px 72px', borderBottom: '1px solid #E8E8E8' }}>
        <div style={EY}>About the Project</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }}>
          <div>
            <p style={{ ...BD, marginBottom: 18 }}>
              A city where no one owns a private car. All mobility is shared, electric, and autonomous —
              on-demand, fleet-managed, and accessible to every resident.
              Wolfsburg, Germany's most car-dependent city per capita, is the test case.
            </p>
          </div>
          <div>
            <p style={{ ...BD, marginBottom: 18 }}>
              Three layers of spatial analysis — Mobility, Livability, and Potential — feed a hub
              placement model that identifies and ranks existing parking structures
              for conversion into shared mobility infrastructure.
            </p>
          </div>
          <div>
            <p style={BD}>
              The result: a three-tier hub network (L, M, S) replacing 49,648 private vehicles per day
              with a shared autonomous fleet of approximately 630 vehicles and bikes. The project covers
              the entire city, with urban design interventions focused on the central 4 km² zone.
            </p>
          </div>
        </div>
      </section>

      {/* ── Analysis sections — 50/50 ─────────────────────────────────────── */}
      {SECTIONS.map(sec => (
        <section
          key={sec.id}
          style={{
            display: 'flex',
            height: '100vh',
            borderBottom: '1px solid #E8E8E8',
          }}
        >
          {/* Left: text */}
          <div style={{
            width: '50%',
            overflowY: 'auto',
            padding: '64px 56px',
            borderRight: '1px solid #E8E8E8',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={EY}>{sec.number} — {sec.eyebrow}</div>
            <h2 style={{
              fontFamily: F, fontSize: 'clamp(28px, 2.8vw, 40px)',
              fontWeight: 700, color: '#111',
              letterSpacing: '-0.03em', lineHeight: 1.1,
              margin: '0 0 40px',
            }}>
              {sec.title}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 32 }}>
              <div>
                <div style={LB}>What we analysed</div>
                <p style={BD}>{sec.what}</p>
              </div>
              <div>
                <div style={LB}>Data resources</div>
                <p style={BD}>{sec.resources}</p>
              </div>
            </div>

            <div style={{ paddingTop: 24, borderTop: '1px solid #E8E8E8' }}>
              <div style={LB}>{sec.id === 'hub' ? 'Results' : 'Findings'}</div>
              <p style={BD}>{sec.findings}</p>
            </div>
          </div>

          {/* Right: interactive map with all tools */}
          <div style={{ width: '50%', position: 'relative', overflow: 'hidden' }}>
            <sec.MapSection />
          </div>
        </section>
      ))}

      {/* ── Further Information — full width ──────────────────────────────── */}
      <section style={{ padding: '72px 72px 96px', borderTop: '2px solid #111' }}>
        <div style={EY}>Further Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div>
            {FURTHER.map(({ label, id, mode }) => (
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
                <span style={{ fontFamily: F, fontSize: 16, fontWeight: 400, color: '#111' }}>{label}</span>
                <span style={{ fontFamily: F, fontSize: 18, color: '#bbb' }}>→</span>
              </button>
            ))}
            <a
              href="https://github.com/annestasiia/wolfsburg-activity-map"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 0', borderBottom: '1px solid #E8E8E8',
                color: '#111', textDecoration: 'none', fontFamily: F,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 400 }}>GitHub Repository</span>
              <span style={{ fontSize: 18, color: '#bbb' }}>↗</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
