import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { DAYS } from '../constants'
import MobilityMapSection    from './landing/MobilityMapSection'
import LivabilityMapSection, { LANDUSE_COLORS } from './landing/LivabilityMapSection'
import CentralityMapSection, { CENT_TABS } from './landing/CentralityMapSection'
import FacilitiesMapSection  from './landing/FacilitiesMapSection'
import HubMapSection         from './landing/HubMapSection'

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
            <div style={LB}>Road Network</div>
            <SymbolRow label="Motorway / trunk">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#0000FF" strokeWidth="5" strokeLinecap="round" /></svg>
            </SymbolRow>
            <SymbolRow label="Primary / secondary">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#0000FF" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </SymbolRow>
            <SymbolRow label="Local roads">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#0000FF" strokeWidth="1" strokeLinecap="round" /></svg>
            </SymbolRow>

            <div style={LB}>Traffic Activity (day/time)</div>
            <SymbolRow label="Low ↔ High — glow width varies">
              <svg width="28" height="14">
                <line x1="0" y1="7" x2="28" y2="7" stroke="#FF1493" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
                <line x1="0" y1="7" x2="28" y2="7" stroke="#0000FF" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </SymbolRow>

            <div style={LB}>District Activity</div>
            <GradBar gradient="#FFFCB5, #FFF300" labelLeft="Low" labelRight="High" />

            <div style={LB}>Car Parking</div>
            <SymbolRow label="Parking location">
              <svg width="20" height="20">
                <circle cx="10" cy="10" r="9" fill="#FF99CC" opacity="0.35" />
                <circle cx="10" cy="10" r="2" fill="#5539CC" />
              </svg>
            </SymbolRow>
            <SymbolRow label="Halo size = capacity (S → L)">
              <svg width="30" height="20">
                {[[5, 5, 0.35], [11, 10, 0.35], [19, 16, 0.35]].map(([cx, r, op], i) => (
                  <g key={i}>
                    <circle cx={cx} cy="10" r={r} fill="#FF99CC" opacity={op} />
                    <circle cx={cx} cy="10" r="2" fill="#5539CC" />
                  </g>
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
            <div style={LB}>Bus Routes</div>
            <SymbolRow label="Route line">
              <svg width="28" height="14">
                <line x1="0" y1="7" x2="28" y2="7" stroke="#ff6464" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
                <line x1="0" y1="7" x2="28" y2="7" stroke="#C10016" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </SymbolRow>

            <div style={LB}>Traffic Activity (day/time)</div>
            <SymbolRow label="Low ↔ High — glow width varies">
              <svg width="28" height="14">
                <line x1="0" y1="7" x2="28" y2="7" stroke="#ff6464" strokeWidth="12" strokeLinecap="round" opacity="0.55" />
                <line x1="0" y1="7" x2="28" y2="7" stroke="#C10016" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </SymbolRow>

            <div style={LB}>Bus Stops</div>
            <SymbolRow label="Stop location">
              <svg width="20" height="20">
                <circle cx="10" cy="10" r="8" fill="#ff6464" opacity="0.30" />
                <circle cx="10" cy="10" r="2" fill="#C10016" />
              </svg>
            </SymbolRow>
            <SymbolRow label="Halo = load by time/day">
              <svg width="30" height="20">
                {[[5, 4], [14, 9], [24, 14]].map(([cx, r], i) => (
                  <g key={i}>
                    <circle cx={cx} cy="10" r={r} fill="#ff6464" opacity="0.30" />
                    <circle cx={cx} cy="10" r="2" fill="#C10016" />
                  </g>
                ))}
              </svg>
            </SymbolRow>

            <div style={LB}>District Activity</div>
            <GradBar gradient="#FFFCB5, #FFF300" labelLeft="Low" labelRight="High" />
          </div>
          <DayTimeControls />
        </>
      )}

      {/* ── Cycling ── */}
      {tab === 'cycling' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={LB}>Cycling Infrastructure</div>
            <SymbolRow label="Cycling route">
              <svg width="28" height="14">
                <rect x="0" y="3" width="28" height="8" rx="4" fill="#71BC68" opacity="0.4" />
                <line x1="0" y1="7" x2="28" y2="7" stroke="#004225" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </SymbolRow>
            <SymbolRow label="Bicycle parking">
              <svg width="20" height="20">
                <circle cx="10" cy="10" r="8" fill="#71BC68" opacity="0.35" />
                <circle cx="10" cy="10" r="3" fill="#004225" />
              </svg>
            </SymbolRow>
          </div>
          <DayTimeControls />
        </>
      )}

      {/* ── Activity Map ── */}
      {tab === 'activity' && (
        <div>
          <div style={LB}>Transport Activity</div>
          <p style={{ ...BD, fontSize: 12, marginBottom: 16 }}>
            Proportional symbol grid (500 m cells). Circle size encodes combined transport
            intensity — roads, bus stops, parkings, cycling infrastructure.
          </p>
          {/* Size + colour legend */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
            {[{ r: 4, label: 'Low', color: '#FF9E3D' }, { r: 8, label: 'Mid', color: '#FF5C00' }, { r: 14, label: 'High', color: '#BF00FF' }].map(({ r, label, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <svg width={r * 2 + 4} height={r * 2 + 4}>
                  <circle cx={r + 2} cy={r + 2} r={r} fill={color} />
                </svg>
                <span style={{ fontFamily: F, fontSize: 10, color: '#aaa' }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, #FF9E3D, #FF5C00, #BF00FF)', marginBottom: 10 }} />
          <div style={{ fontFamily: F, fontSize: 11, color: '#bbb', lineHeight: 1.6 }}>
            Sources: OSM road network · bus stops ·<br />
            car &amp; bike parkings · official cycling routes
          </div>
        </div>
      )}
    </div>
  )
}

// ── Livability left panel ─────────────────────────────────────────────────────

function LivabilityLeftPanel({ tab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '40px 36px' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={EY}>02 — Livability Analysis · OSM + Open Data</div>
        <h2 style={{ fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px' }}>
          Livability &amp; Facilities
        </h2>
        <p style={{ ...BD, fontSize: 12 }}>
          Commercial activity density, land use structure, and point-of-interest
          distribution across all Wolfsburg districts.
        </p>
      </div>

      {tab === 'livability' && (
        <div>
          <div style={LB}>Facility Density</div>
          <p style={{ ...BD, fontSize: 12, marginBottom: 16 }}>
            Proportional symbol grid (250 m cells). Circle size encodes concentration
            of commercial venues, facilities and historic sites.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
            {[{ r: 4, label: 'Low', color: '#90D5FF' }, { r: 8, label: 'Mid', color: '#10069F' }, { r: 14, label: 'High', color: '#131936' }].map(({ r, label, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <svg width={r * 2 + 4} height={r * 2 + 4}>
                  <circle cx={r + 2} cy={r + 2} r={r} fill={color} />
                </svg>
                <span style={{ fontFamily: F, fontSize: 10, color: '#aaa' }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, #90D5FF, #10069F, #131936)', marginBottom: 10 }} />
          <div style={{ fontFamily: F, fontSize: 11, color: '#bbb', lineHeight: 1.6 }}>
            Sources: venues registry · OSM facilities · historic sites
          </div>
        </div>
      )}

      {tab === 'landuse' && (
        <div>
          <div style={LB}>Land Use</div>
          {Object.entries(LANDUSE_COLORS).map(([cat, color]) => {
            const labels = {
              forest: 'Forest / Wood', meadow: 'Meadow / Grassland', farmland: 'Farmland / Fields',
              water: 'Water', park: 'Park / Garden', residential: 'Residential',
              commercial: 'Commercial / Retail', industrial: 'Industrial',
              education: 'Education', administrative: 'Administrative',
              institutional: 'Hospital / Cemetery', parking: 'Parking', railway: 'Railway',
            }
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: F, fontSize: 11, color: '#444' }}>{labels[cat] || cat}</span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'centrality' && (
        <div>
          <div style={LB}>Centrality</div>
          <p style={{ ...BD, fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>
            Network centrality analysis — coming soon.
          </p>
        </div>
      )}

      {tab === 'facility' && (
        <div>
          <div style={LB}>Facilities</div>
          <p style={{ ...BD, fontSize: 12, marginBottom: 12 }}>
            Registered venues and points of interest from the Wolfsburg venue registry.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="#E8305A" /></svg>
            <span style={{ fontFamily: F, fontSize: 12, color: '#444' }}>Venue / facility</span>
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

// ── Centrality left panel ─────────────────────────────────────────────────────

const CENT_MODE_INFO = {
  centrality: { color:'#1D1D1F', label:'Combined score',    sub:'Walk + Bike + Public averaged' },
  walk:       { color:'#16A34A', label:'Walk accessibility', sub:'4.5 km/h · 15 min budget'     },
  bike:       { color:'#059669', label:'Bike accessibility', sub:'15 km/h · official cycle routes + roads' },
  public:     { color:'#CA8A04', label:'Public transit',     sub:'Walk to stop + 20 km/h bus · 15 min' },
  auto:       { color:'#DC2626', label:'Auto accessibility', sub:'50 km/h (maxspeed tag) · 15 min' },
}

function CentralityLeftPanel({ tab }) {
  const cfg = CENT_MODE_INFO[tab] || CENT_MODE_INFO.centrality
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflowY:'auto', padding:'40px 36px' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={EY}>03 — Accessibility · Network Analysis</div>
        <h2 style={{ fontFamily:F, fontSize:'clamp(20px,1.8vw,28px)', fontWeight:700, color:'#111', letterSpacing:'-0.03em', lineHeight:1.1, margin:'0 0 14px' }}>
          Centralities
        </h2>
        <p style={{ ...BD, fontSize:12 }}>
          Proximity to services and facilities by different mobility mode. 100 m grid — each point shows
          how many amenities are reachable in 15 minutes. Includes VW Werk as destination.
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={LB}>Active mode</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ width:14, height:14, borderRadius:'50%', background:cfg.color }} />
          <span style={{ fontFamily:F, fontSize:13, fontWeight:600, color:'#111' }}>{cfg.label}</span>
        </div>
        <p style={{ fontFamily:F, fontSize:11, color:'#999', margin:0 }}>{cfg.sub}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={LB}>Score gradient</div>
        <div style={{ height:8, borderRadius:4, marginBottom:6, border:'1px solid #eee',
          background: tab === 'centrality'
            ? 'linear-gradient(to right, #ffffff, #2FEF10, #FFF44F, #E62020)'
            : tab === 'auto'
            ? 'linear-gradient(to right, #FFF44F, #FF7A00, #E62020)'
            : `linear-gradient(to right, #ffffff, ${cfg.color})` }} />
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:F, fontSize:10, color:'#aaa' }}>0 — no access</span>
          <span style={{ fontFamily:F, fontSize:10, color:'#aaa' }}>100 — best</span>
        </div>
      </div>

      <div style={{ paddingTop:20, borderTop:'1px solid #E8E8E8' }}>
        <div style={LB}>Destinations</div>
        <p style={{ fontFamily:F, fontSize:12, color:'#555', lineHeight:1.7, margin:0 }}>
          1 170 OSM amenities: schools, supermarkets, pharmacies, doctors, bakeries, banks, community centres + VW Werk gates (5 access points).
        </p>
      </div>

      <div style={{ marginTop:22 }}>
        <div style={LB}>Method</div>
        <p style={{ fontFamily:F, fontSize:12, color:'#555', lineHeight:1.7, margin:0 }}>
          Reverse Dijkstra from each destination on mode-specific graph. Count reachable destinations per grid node. Normalised 0–100 within each mode.
        </p>
      </div>
    </div>
  )
}

// ── Non-mobility section data ────────────────────────────────────────────────

const OTHER_SECTIONS = [
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
  const [mobilityTab, setMobilityTab] = useState('activity')
  const [livabilityTab, setLivabilityTab] = useState('livability')
  const [centralityTab, setCentralityTab] = useState('centrality')

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

        {/* Livability — 40/60 with tabs */}
        <section style={{ display: 'flex', height: '100vh', border: '1px solid #E8E8E8', overflow: 'hidden' }}>
          <div style={{ width: '40%', flexShrink: 0, borderRight: '1px solid #E8E8E8', overflow: 'hidden' }}>
            <LivabilityLeftPanel tab={livabilityTab} />
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <LivabilityMapSection tab={livabilityTab} onTabChange={setLivabilityTab} />
          </div>
        </section>

        {/* Centralities — 40/60 with tabs */}
        <section style={{ display:'flex', height:'100vh', border:'1px solid #E8E8E8', overflow:'hidden' }}>
          <div style={{ width:'40%', flexShrink:0, borderRight:'1px solid #E8E8E8', overflow:'hidden' }}>
            <CentralityLeftPanel tab={centralityTab} />
          </div>
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            <CentralityMapSection tab={centralityTab} onTabChange={setCentralityTab} />
          </div>
        </section>

        {/* Hub — 40/60 standard */}
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
