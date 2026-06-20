import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { DAYS } from '../constants'
import MobilityMapSection  from './landing/MobilityMapSection'
import FacilitiesMapSection from './landing/FacilitiesMapSection'
import GreeneryMapSection  from './landing/GreeneryMapSection'
import HubMapSection       from './landing/HubMapSection'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const EY = { fontFamily: F, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 14 }
const LB = { fontFamily: F, fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }
const BD = { fontFamily: F, fontSize: 13, color: '#555', lineHeight: 1.85, margin: 0 }

function slotToTime(slot) {
  const h = Math.floor(slot / 2).toString().padStart(2, '0')
  const m = slot % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
}
function timeToSlot(t) {
  if (!t) return 16
  const [h, m] = t.split(':').map(Number)
  return h * 2 + (m >= 30 ? 1 : 0)
}

// ── Mobility left panel (special case) ─────────────────────────────────────

function GradBar({ from, to, labelLeft, labelRight }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        height: 6, borderRadius: 3,
        background: `linear-gradient(to right, ${from}, ${to})`,
        marginBottom: 6,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F, fontSize: 10, color: '#aaa' }}>{labelLeft}</span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#aaa' }}>{labelRight}</span>
      </div>
    </div>
  )
}

function ParkingSymbol({ stroke, label }) {
  const cross = 4.5, r = 7, size = 20, half = 10
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={half} cy={half} r={r} fill="white" stroke={stroke} strokeWidth="1.5" />
        <line x1={half - cross} y1={half - cross} x2={half + cross} y2={half + cross} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <line x1={half + cross} y1={half - cross} x2={half - cross} y2={half + cross} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: F, fontSize: 12, color: '#555' }}>{label}</span>
    </div>
  )
}

function OrangeGlowExample() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <svg width={50} height={20} style={{ flexShrink: 0 }}>
        {[6, 9, 13].map((r, i) => (
          <circle key={i} cx={6 + i * 18} cy={10} r={r} fill="#FFB300" opacity={0.18 + i * 0.13} />
        ))}
      </svg>
      <span style={{ fontFamily: F, fontSize: 12, color: '#555' }}>Orange glow — parking size (S → L)</span>
    </div>
  )
}

function MobilityLeftPanel({ tab }) {
  const { selectedDay, selectedTime, setSelectedDay, setSelectedTime } = useAppStore()
  const slot = timeToSlot(selectedTime)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '40px 36px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={EY}>01 — Transport Analysis · OpenStreetMap</div>
        <h2 style={{ fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px' }}>
          Mobility Infrastructure
        </h2>
        <p style={{ ...BD, fontSize: 12 }}>
          District-level transport scoring across all Wolfsburg districts — road network,
          cycling coverage, public transport access, and pedestrian footways.
        </p>
      </div>

      {tab === 'auto' && (
        <>
          {/* ── Legend ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={LB}>Road Activity</div>
            <GradBar from="#3F012C" to="#990F4B" labelLeft="Highest activity" labelRight="Lowest" />

            <div style={LB}>District Activity</div>
            <GradBar from="#FFFCB5" to="#FFF300" labelLeft="Low" labelRight="High activity" />

            <div style={LB}>Car Parking</div>
            <ParkingSymbol stroke="#1D1D1F" label="Surface parking" />
            <ParkingSymbol stroke="#5C5C5C" label="Multi-storey car park" />
            <ParkingSymbol stroke="#808080" label="Underground parking" />
            <OrangeGlowExample />
          </div>

          {/* ── Day / Time toolbar ── */}
          <div style={{ paddingTop: 20, borderTop: '1px solid #E8E8E8' }}>
            <div style={LB}>Day of week</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 5,
                    border: '1px solid',
                    borderColor: selectedDay === d ? '#1D1D1F' : '#E0E0E0',
                    background: selectedDay === d ? '#1D1D1F' : 'transparent',
                    color: selectedDay === d ? '#fff' : '#555',
                    fontFamily: F, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>

            <div style={LB}>Time — {selectedTime || '08:00'}</div>
            <input
              type="range"
              min={0}
              max={47}
              value={slot}
              onChange={e => setSelectedTime(slotToTime(parseInt(e.target.value)))}
              style={{ width: '100%', accentColor: '#1D1D1F', marginBottom: 6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: 10, color: '#ccc' }}>00:00</span>
              <span style={{ fontFamily: F, fontSize: 10, color: '#ccc' }}>12:00</span>
              <span style={{ fontFamily: F, fontSize: 10, color: '#ccc' }}>23:30</span>
            </div>
          </div>
        </>
      )}

      {tab !== 'auto' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ paddingTop: 20, borderTop: '1px solid #E8E8E8' }}>
            <div style={{ fontFamily: F, fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>
              {tab === 'activity' && 'Activity Map — analysis coming soon.'}
              {tab === 'public'   && 'Public Transport — analysis coming soon.'}
              {tab === 'cycling'  && 'Cycling Network — analysis coming soon.'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Standard text content for non-mobility sections ─────────────────────────

function DefaultLeftContent({ sec }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', padding: '48px 36px', overflowY: 'auto' }}>
      <div style={EY}>{sec.number} — {sec.eyebrow}</div>
      <h2 style={{
        fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)',
        fontWeight: 700, color: '#111',
        letterSpacing: '-0.03em', lineHeight: 1.1,
        margin: '0 0 28px',
      }}>
        {sec.title}
      </h2>

      <div style={{ marginBottom: 22 }}>
        <div style={LB}>What we analysed</div>
        <p style={BD}>{sec.what}</p>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={LB}>Data resources</div>
        <p style={BD}>{sec.resources}</p>
      </div>

      <div style={{ paddingTop: 20, borderTop: '1px solid #E8E8E8' }}>
        <div style={LB}>{sec.id === 'hub' ? 'Results' : 'Findings'}</div>
        <p style={BD}>{sec.findings}</p>
      </div>
    </div>
  )
}

// ── Non-mobility section data ────────────────────────────────────────────────

const OTHER_SECTIONS = [
  {
    id: 'livability',
    number: '02',
    eyebrow: 'Facility Analysis · OSM + Wolfsburg Open Data',
    title: 'Livability & Facilities',
    what: 'Point-of-interest density, venue categories, and temporal activity patterns across all districts. Seven categories mapped against pedestrian data to identify where people go — and when.',
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
    findings: 'Hub L (large interchanges at multi-storey car parks), Hub M (district hubs in underground car parks), Hub S (last-metre nodes). Replaces 49,648 private vehicles/day with ~630 shared vehicles and bikes.',
    MapSection: HubMapSection,
  },
]

const FURTHER = [
  { label: 'Post-Car Strategy',        id: 'strategy' },
  { label: 'Capacity Analysis',        id: 'capacity' },
  { label: 'Hubs Placement Algorithm', id: 'hub',      mode: 'hub-network' },
  { label: 'Hubs Algorithm Work',      id: 'hub-algo' },
  { label: 'Urban Design',             id: 'urban'    },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { setActiveSection, setActiveMode, setShowLanding, setNavOpen, setLandingSectionMode } = useAppStore()
  const [mobilityTab, setMobilityTab] = useState('auto')

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

      {/* ── Analysis sections ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>

        {/* Mobility — 40/60 with special left panel */}
        <section style={{ display: 'flex', height: '100vh', border: '1px solid #E8E8E8', overflow: 'hidden' }}>
          <div style={{ width: '40%', flexShrink: 0, borderRight: '1px solid #E8E8E8', overflow: 'hidden' }}>
            <MobilityLeftPanel tab={mobilityTab} />
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MobilityMapSection tab={mobilityTab} onTabChange={setMobilityTab} />
          </div>
        </section>

        {/* Livability, Potential, Hub — 40/60 standard */}
        {OTHER_SECTIONS.map(sec => (
          <section
            key={sec.id}
            style={{ display: 'flex', height: '100vh', border: '1px solid #E8E8E8', overflow: 'hidden' }}
          >
            <div style={{ width: '40%', flexShrink: 0, borderRight: '1px solid #E8E8E8' }}>
              <DefaultLeftContent sec={sec} />
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <sec.MapSection />
            </div>
          </section>
        ))}
      </div>

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
