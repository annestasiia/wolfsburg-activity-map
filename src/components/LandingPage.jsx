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

// ── Legend atoms ─────────────────────────────────────────────────────────────

function GradBar({ gradient, labelLeft, labelRight }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ height: 6, borderRadius: 3, background: `linear-gradient(to right, ${gradient})`, marginBottom: 6 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F, fontSize: 10, color: '#aaa' }}>{labelLeft}</span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#aaa' }}>{labelRight}</span>
      </div>
    </div>
  )
}

function SymbolRow({ children, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ flexShrink: 0, width: 28, display: 'flex', justifyContent: 'center' }}>{children}</div>
      <span style={{ fontFamily: F, fontSize: 12, color: '#555' }}>{label}</span>
    </div>
  )
}

function ParkingIcon({ stroke }) {
  const c = 4.5, r = 7, s = 20, h = 10
  return (
    <svg width={s} height={s}>
      <circle cx={h} cy={h} r={r} fill="white" stroke={stroke} strokeWidth="1.5" />
      <line x1={h-c} y1={h-c} x2={h+c} y2={h+c} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <line x1={h+c} y1={h-c} x2={h-c} y2={h+c} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function DotIcon({ color }) {
  return <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill={color} stroke="white" strokeWidth="1.5" /></svg>
}

function LineIcon({ color }) {
  return <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></svg>
}

// ── Day / Time controls (shared across tabs) ─────────────────────────────────

function DayTimeControls() {
  const { selectedDay, selectedTime, setSelectedDay, setSelectedTime } = useAppStore()
  const slot = timeToSlot(selectedTime)
  return (
    <div style={{ paddingTop: 18, borderTop: '1px solid #E8E8E8' }}>
      <div style={LB}>Day of week</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 18 }}>
        {DAYS.map(d => (
          <button key={d} onClick={() => setSelectedDay(d)} style={{
            padding: '4px 8px', borderRadius: 5, border: '1px solid',
            borderColor: selectedDay === d ? '#1D1D1F' : '#E0E0E0',
            background: selectedDay === d ? '#1D1D1F' : 'transparent',
            color: selectedDay === d ? '#fff' : '#555',
            fontFamily: F, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{d}</button>
        ))}
      </div>
      <div style={LB}>Time — {selectedTime || '08:00'}</div>
      <input type="range" min={0} max={47} value={slot}
        onChange={e => setSelectedTime(slotToTime(parseInt(e.target.value)))}
        style={{ width: '100%', accentColor: '#1D1D1F', marginBottom: 6 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F, fontSize: 10, color: '#ccc' }}>00:00</span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#ccc' }}>12:00</span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#ccc' }}>23:30</span>
      </div>
    </div>
  )
}

// ── Mobility left panel ───────────────────────────────────────────────────────

function MobilityLeftPanel({ tab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '40px 36px' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={EY}>01 — Transport Analysis · OpenStreetMap</div>
        <h2 style={{ fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px' }}>
          Mobility Infrastructure
        </h2>
        <p style={{ ...BD, fontSize: 12 }}>
          District-level transport scoring across all Wolfsburg districts — road network,
          cycling coverage, public transport access, and pedestrian footways.
        </p>
      </div>

      {/* ── Auto ── */}
      {tab === 'auto' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={LB}>Road Activity</div>
            <GradBar gradient="#FF2D55, #FF6B00, #FF9500, #FFCC00, #AAAAAA" labelLeft="Motorway" labelRight="Local road" />

            <div style={LB}>District Activity</div>
            <GradBar gradient="#FDE8EC, #F7B8C4, #F07090, #E03060, #C01040" labelLeft="Low" labelRight="High" />

            <div style={LB}>Car Parking</div>
            <SymbolRow label="Surface car park"><ParkingIcon stroke="#1D1D1F" /></SymbolRow>
            <SymbolRow label="Multi-storey car park"><ParkingIcon stroke="#5C5C5C" /></SymbolRow>
            <SymbolRow label="Underground parking"><ParkingIcon stroke="#808080" /></SymbolRow>
            <SymbolRow label="Parking capacity (S → L)">
              <svg width="28" height="16">
                {[[4, 0.20], [6, 0.35], [9, 0.50]].map(([r, op], i) => (
                  <circle key={i} cx={4 + i * 10} cy="8" r={r} fill="#FFB300" opacity={op} />
                ))}
              </svg>
            </SymbolRow>
          </div>
          <DayTimeControls />
        </>
      )}

      {/* ── Public ── */}
      {tab === 'public' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={LB}>Road Activity</div>
            <GradBar gradient="#FF2D55, #FF6B00, #FF9500, #FFCC00, #AAAAAA" labelLeft="Motorway" labelRight="Local road" />

            <div style={LB}>District Activity</div>
            <GradBar gradient="#FDE8EC, #F7B8C4, #F07090, #E03060, #C01040" labelLeft="Low" labelRight="High" />

            <div style={LB}>Bus Stops</div>
            <SymbolRow label="Bus stop"><DotIcon color="#0077FF" /></SymbolRow>
          </div>
          <DayTimeControls />
        </>
      )}

      {/* ── Cycling ── */}
      {tab === 'cycling' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={LB}>Cycling Infrastructure</div>
            <SymbolRow label="Cycling route"><LineIcon color="#00C853" /></SymbolRow>
            <SymbolRow label="Bicycle parking"><DotIcon color="#00897B" /></SymbolRow>
          </div>
          <DayTimeControls />
        </>
      )}

      {/* ── Activity Map placeholder ── */}
      {tab === 'activity' && (
        <div style={{ paddingTop: 18, borderTop: '1px solid #E8E8E8' }}>
          <p style={{ fontFamily: F, fontSize: 12, color: '#bbb', fontStyle: 'italic', margin: 0 }}>
            Activity Map — analysis coming soon.
          </p>
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
