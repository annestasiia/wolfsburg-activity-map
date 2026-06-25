import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { DAYS } from '../constants'
import { computeCapacity } from '../utils/capacityCalc'
import MobilityMapSection    from './landing/MobilityMapSection'
import LivabilityMapSection, { LANDUSE_COLORS } from './landing/LivabilityMapSection'
import CentralityMapSection, { CENT_TABS } from './landing/CentralityMapSection'
import FacilitiesMapSection  from './landing/FacilitiesMapSection'
import HubMapSection, { HUB_TABS }         from './landing/HubMapSection'
import ComparativeAnalysisSection           from './landing/ComparativeAnalysisSection'

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {/* Two-column legend: Road Network | Car Parking */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
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
              </div>
              <div style={{ flex: 1 }}>
                <div style={LB}>Car Parking</div>
                <SymbolRow label="Location">
                  <svg width="20" height="20">
                    <circle cx="10" cy="10" r="9" fill="#FF99CC" opacity="0.35" />
                    <circle cx="10" cy="10" r="2" fill="#5539CC" />
                  </svg>
                </SymbolRow>
                <SymbolRow label="Halo = capacity">
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
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={LB}>Traffic Activity</div>
              <SymbolRow label="Low ↔ High — glow width varies">
                <svg width="28" height="14">
                  <line x1="0" y1="7" x2="28" y2="7" stroke="#FF1493" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
                  <line x1="0" y1="7" x2="28" y2="7" stroke="#0000FF" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </SymbolRow>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Wolfsburg is a car-oriented city with a high modal share of private automobile use.
              Despite its spatially fragmented structure — a monocentric industrial core surrounded
              by dispersed residential settlements — the road network provides comparatively strong
              connectivity. Traffic intensity converges towards the VW Werk and the city centre,
              reproducing a classic hub-and-spoke pattern characteristic of company towns.
            </p>
          </div>
        </div>
      )}

      {/* ── Public ── */}
      {tab === 'public' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {/* Two-column: Bus Routes | Bus Stops */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={LB}>Bus Routes</div>
                <SymbolRow label="Route line">
                  <svg width="28" height="14">
                    <line x1="0" y1="7" x2="28" y2="7" stroke="#ff6464" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
                    <line x1="0" y1="7" x2="28" y2="7" stroke="#C10016" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </SymbolRow>
                <SymbolRow label="Glow = activity">
                  <svg width="28" height="14">
                    <line x1="0" y1="7" x2="28" y2="7" stroke="#ff6464" strokeWidth="12" strokeLinecap="round" opacity="0.55" />
                    <line x1="0" y1="7" x2="28" y2="7" stroke="#C10016" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </SymbolRow>
              </div>
              <div style={{ flex: 1 }}>
                <div style={LB}>Bus Stops</div>
                <SymbolRow label="Stop location">
                  <svg width="20" height="20">
                    <circle cx="10" cy="10" r="8" fill="#ff6464" opacity="0.30" />
                    <circle cx="10" cy="10" r="2" fill="#C10016" />
                  </svg>
                </SymbolRow>
                <SymbolRow label="Halo = load">
                  <svg width="30" height="20">
                    {[[5, 4], [14, 9], [24, 14]].map(([cx, r], i) => (
                      <g key={i}>
                        <circle cx={cx} cy="10" r={r} fill="#ff6464" opacity="0.30" />
                        <circle cx={cx} cy="10" r="2" fill="#C10016" />
                      </g>
                    ))}
                  </svg>
                </SymbolRow>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Despite its car-centric spatial structure, Wolfsburg maintains a functional public
              transport network that connects peripheral residential districts to the urban core.
              The bus system provides a degree of spatial equity, offering mobility access to
              residents without private vehicles. Route intensity concentrates along the main
              corridors linking outlying settlements to the city centre and the VW Werk,
              reinforcing the monocentric character of the city's transport demand.
            </p>
          </div>
        </div>
      )}

      {/* ── Cycling ── */}
      {tab === 'cycling' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              The cycle network shown represents the <em>planned</em> cycling infrastructure
              sourced from the Wolfsburg Geoportal. The existing network currently covers
              primarily the city centre and its immediate surroundings. The planned routes
              are intended to extend cycling connectivity to outlying residential districts,
              addressing the current modal gap in active mobility.
              For the spatial analysis, the dataset currently registered in OpenStreetMap
              was used as the analytical baseline.
            </p>
          </div>
        </div>
      )}

      {/* ── Activity Map ── */}
      {tab === 'activity' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Transport Activity</div>
            <p style={{ ...BD, fontSize: 12, marginBottom: 16 }}>
              Proportional symbol grid (500 m cells). Circle size encodes combined transport
              intensity — roads, bus stops, parkings, cycling infrastructure.
            </p>
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
            <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, #FF9E3D, #FF5C00, #BF00FF)', marginBottom: 0 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              The transport activity map reveals Wolfsburg's satellite urban structure: a dominant
              core concentrating the majority of transport infrastructure and activity, surrounded
              by dispersed residential settlements with significantly lower intensity. This
              monocentric pattern, characteristic of company towns, reflects the historical
              gravitational pull of the VW Werk. Peripheral districts exhibit limited autonomous
              transport capacity, with movement directed primarily towards the central hub rather
              than distributed across a polycentric network.
            </p>
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
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
            <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, #90D5FF, #10069F, #131936)', marginBottom: 0 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              The majority of urban civic and commercial facilities are concentrated in the central
              districts — Stadtmitte, Schillerteich, and Laagberg — which form the functional core
              of the city. Peripheral settlements such as Vorsfelde, Fallersleben, Hehlingen, and
              Nordsteimke exhibit significantly lower facility density. This spatial imbalance not
              only reflects the historical planning logic of a company town, but also compels
              residents of outlying districts to rely on private automobiles for everyday activities,
              reinforcing car dependency at a structural level.
            </p>
          </div>
        </div>
      )}

      {tab === 'landuse' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Land Use</div>
            {/* Three-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 8px', marginBottom: 8 }}>
              {Object.entries(LANDUSE_COLORS).map(([cat, color]) => {
                const labels = {
                  forest: 'Forest', meadow: 'Meadow', farmland: 'Farmland',
                  water: 'Water', park: 'Park', residential: 'Residential',
                  commercial: 'Commercial', industrial: 'Industrial',
                  education: 'Education', administrative: 'Admin.',
                  institutional: 'Hospital', parking: 'Parking', railway: 'Railway',
                }
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 10, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labels[cat] || cat}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Wolfsburg's land use structure reflects its identity as a satellite city shaped by
              industrial planning. Large agricultural and forest zones — Farmland, Meadow, and
              Forest — fragment the urban fabric and physically separate residential districts from
              one another. The commercial and civic core remains concentrated in the city centre,
              while industrial land — dominated by the Volkswagenwerk — occupies a significant
              share of the built environment. This land use pattern reinforces spatial segregation
              and reduces the conditions for walkable, mixed-use urban life outside the centre.
            </p>
          </div>
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

      {tab === 'activity' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Venue Activity</div>
            <p style={{ ...BD, fontSize: 12, marginBottom: 14 }}>
              Each registered venue is shown as a point. If the venue is open at the selected
              time, a proportional halo indicates activity intensity — derived from the venue
              registry opening hours and peak-hour data.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { r: 5, label: 'Facility location', fill: '#10069F', stroke: 'none', sw: 0, dot: false },
                { r: 10, label: 'Low activity', fill: 'rgba(16,6,159,0.12)', stroke: '#10069F', sw: 1.5, dot: true },
                { r: 16, label: 'Moderate activity', fill: 'rgba(16,6,159,0.12)', stroke: '#10069F', sw: 1.5, dot: true },
                { r: 22, label: 'High / peak activity', fill: 'rgba(16,6,159,0.12)', stroke: '#10069F', sw: 1.5, dot: true },
              ].map(({ r, label, fill, stroke, sw, dot }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg width={r * 2 + 4} height={r * 2 + 4} style={{ flexShrink: 0 }}>
                    <circle cx={r + 2} cy={r + 2} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
                    {dot && <circle cx={r + 2} cy={r + 2} r={3} fill="#10069F" />}
                  </svg>
                  <span style={{ fontFamily: F, fontSize: 11, color: '#444' }}>{label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width={14} height={14} style={{ flexShrink: 0 }}>
                  <circle cx={7} cy={7} r={4} fill="#10069F" opacity={0.4} />
                </svg>
                <span style={{ fontFamily: F, fontSize: 11, color: '#888' }}>Closed — no halo</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Activity intensity at registered venues confirms the centralised structure of
              Wolfsburg's urban life. Peak activity concentrates in the city centre and around
              major commercial destinations, while peripheral districts show sparse and low-intensity
              patterns. This reflects both the limited provision of local facilities in outlying
              areas and the dependence of residents on centralised services, reinforcing the
              city's monocentric character and the role of the automobile as the primary enabler
              of daily mobility.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hub left panel ─────────────────────────────────────────────────────────────

const HUB_TIERS = [
  { color: '#1D1D1F', letter: 'L', label: 'Hub L', desc: 'Large intermodal terminal · multi-storey car park · autonomous shuttle depot · 4 km catchment' },
  { color: '#01796F', letter: 'M', label: 'Hub M', desc: 'District interchange · underground parking · e-bike + shuttle · 2 km catchment' },
  { color: '#3EA055', letter: 'S', label: 'Hub S', desc: 'Last-mile node · bus interchange · e-bike + shared pod · 400 m catchment' },
]

function HubLeftPanel({ tab, netTab }) {
  const cap = computeCapacity(130000)
  const fmt = n => Math.round(n).toLocaleString('de-DE')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '40px 36px' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={EY}>04 — Hub Placement · Three-Tier Network</div>
        <h2 style={{ fontFamily: F, fontSize: 'clamp(20px,1.8vw,28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px' }}>
          Hub System
        </h2>
        <p style={{ ...BD, fontSize: 12 }}>
          A three-tier shared mobility network enabling seamless mode-chaining across the city —
          e-bike, autonomous shuttle, and shared pod — without a private vehicle.
        </p>
      </div>

      {/* ── Placement ── */}
      {tab === 'placement' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Hub tiers</div>
            {HUB_TIERS.map(({ color, letter, label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: F, fontSize: 9, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{letter}</span>
                </div>
                <div>
                  <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: '#111' }}>{label}</span>
                  <span style={{ fontFamily: F, fontSize: 11, color: '#888', marginLeft: 6 }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Hub locations are selected from existing parking infrastructure using AHP-weighted
              composite scoring: Mobility accessibility (35%), Facility proximity (30%),
              Green coverage (15%), and Network coverage (20%). Hub L occupies multi-storey
              car parks with the highest combined scores; Hub M targets underground facilities
              in district centres; Hub S is placed at bus interchanges and last-mile demand
              points. The algorithm identifies sites that replace 49,648 private vehicle trips/day
              with ~630 shared vehicles and e-bikes across the three tiers.
            </p>
          </div>
        </div>
      )}

      {/* ── Fleet ── */}
      {tab === 'fleet' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Fleet sizing</div>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, marginBottom: 16 }}>
              Fleet size per hub is derived from modal split analysis for 130,000 residents.
              Peak-hour trip demand ({fmt(cap.peak_hour_trips)} trips/hour) is distributed
              across tiers based on service area population and catchment radius. Hub L holds
              the largest autonomous shuttle fleet; Hub M carries mixed shuttles and pods;
              Hub S provides e-bikes and shared pods for last-mile coverage.
            </p>
            <div style={{ padding: '12px 14px', background: '#F5F5F7', borderRadius: 8 }}>
              <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                Peak trips · city centre
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#111' }}>
                {fmt(cap.peak_hour_trips)}
              </div>
              <div style={{ fontFamily: F, fontSize: 10, color: '#888', marginTop: 2 }}>trips / hour · 130,000 residents</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16, gap: 16 }}>
            {/* Fleet bar legend */}
            <div>
              <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                Legend
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
                  {[{ h: 28, lbl: 'S' }, { h: 56, lbl: 'M' }, { h: 84, lbl: 'L' }].map(({ h, lbl }) => (
                    <div key={lbl} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 5, height: h, background: '#111' }} />
                      <span style={{ fontFamily: F, fontSize: 7, fontWeight: 700, color: '#111' }}>{lbl}</span>
                    </div>
                  ))}
                </div>
                <span style={{ fontFamily: F, fontSize: 10, color: '#666', lineHeight: 1.5 }}>
                  Fleet volume per hub,<br />proportional to tier capacity
                </span>
              </div>
            </div>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Strategic hub placement transforms urban mobility by creating accessible
              interchange points distributed across the city's spatial gradient. Residents
              of peripheral districts gain on-demand access to shared e-bikes, autonomous
              shuttles, and pods — ending the structural dependency on private car ownership.
              The network replaces isolated transport modes with a connected, on-demand system
              in which every journey can be completed without a private vehicle.
            </p>
          </div>
        </div>
      )}

      {/* ── Network — sub-tabs ── */}
      {tab === 'network' && netTab === 'hub-net' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Network Hubs</div>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: '0 0 12px' }}>
              Hub-to-hub connections form the mobility backbone of the network. Each tier pair
              is served by a dedicated mode matched to distance and demand:
            </p>
            {[
              ['L ↔ L', 'Autonomous bus'],
              ['L ↔ M ≤ 1 500 m', 'Shuttle + pod'],
              ['M ↔ M ≤ 1 000 m', 'Shuttle + pod'],
              ['M ↔ S ≤ 600 m', 'Pod + e-bike'],
              ['S ↔ S ≤ 400 m', 'E-bike'],
            ].map(([pair, mode]) => (
              <div key={pair} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'baseline' }}>
                <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: '#111', minWidth: 110, flexShrink: 0 }}>{pair}</span>
                <span style={{ fontFamily: F, fontSize: 11, color: '#888' }}>{mode}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              By introducing the hub network, the city gains the opportunity to become
              progressively more connected — beginning with districts closest to the centre,
              and gradually extending mobility coverage to more remote settlements as the
              network expands. This spatial sequencing ensures that accessibility improvements
              are achievable incrementally, without requiring full deployment before delivering
              benefit. The hub system makes different modes of mobility structurally available
              across all districts, reducing car dependency at the network level.
            </p>
          </div>
        </div>
      )}

      {tab === 'network' && netTab === 'fac-net' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>Facility Network</div>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Each registered venue and urban facility is linked to its nearest hub within 800 m,
              creating a spatial accessibility overlay. The hub tier determines the likely
              access mode: Hub S serves facilities on foot or e-bike; Hub M by pod or e-bike;
              Hub L by autonomous shuttle. Line colour encodes hub tier — the connection
              structure reflects both proximity and hierarchy within the mobility network.
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              The facility network analysis shows that proposed hub locations substantially
              improve non-motorised access to urban amenities across all districts. Areas where
              current walking and cycling accessibility scores are lowest — peripheral residential
              districts — benefit most from hub-mediated connectivity. Hub placement transforms
              mobility gaps into connected catchments, enabling residents to reach everyday
              destinations without a private vehicle.
            </p>
          </div>
        </div>
      )}

      {tab === 'network' && netTab === 'ext-flow' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={LB}>External Flows</div>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Wolfsburg receives 76,715 daily commuters (Einpendler) from surrounding
              municipalities — primarily Gifhorn, Helmstedt, Braunschweig, and Hanover
              (Pendleratlas BA 2022). These flows converge via the main rail and road corridors
              and enter the shared mobility network exclusively through Hub L gateway nodes,
              which act as the primary intermodal interface between the regional and internal
              mobility systems. All external commuters are absorbed and distributed at L-tier
              hubs before continuing by shuttle, pod, or e-bike.
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <p style={{ fontFamily: F, fontSize: 11, color: '#555', lineHeight: 1.7, margin: 0 }}>
              Integrating external commuter flows into the hub network is critical for reducing
              the volume of private vehicles entering the city. By positioning Hub L nodes at
              the main entry points, the system creates a seamless transition from regional
              transport to the internal shared mobility network — making it practical for
              Einpendler to leave their cars outside the city boundary and complete their
              journey by shared mobility means.
            </p>
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
  centrality: { color:'#1D1D1F', label:'Combined score',    sub:'Walk + Bike + Public averaged · Auto excluded: at 50 km/h nearly all amenities are reachable from anywhere, making the score near-uniform citywide' },
  walk:       { color:'#16A34A', label:'Walk accessibility', sub:'4.5 km/h · 15 min budget'     },
  bike:       { color:'#059669', label:'Bike accessibility', sub:'15 km/h · official cycle routes + roads' },
  public:     { color:'#CA8A04', label:'Public transit',     sub:'Walk to stop + 20 km/h bus · 15 min' },
  auto:       { color:'#DC2626', label:'Auto accessibility', sub:'50 km/h (maxspeed tag) · 15 min' },
}

const CENT_CAPTIONS = {
  centrality: `Peak multi-modal accessibility — excluding the private car — is currently the privilege of residents in the central districts of Stadtmitte, Schillerteich, and Laagberg. The combined score reveals a steep spatial gradient: even a modest displacement from the urban core sharply reduces the share of amenities reachable on foot, by bicycle, or by public transport within 15 minutes. This pattern reflects the structural car dependency embedded in Wolfsburg's dispersed, monocentric urban form — the road and settlement configuration imposes a de facto mobility barrier on those without access to a private vehicle.`,
  walk:   `Pedestrian accessibility is concentrated almost exclusively in the urban core. The 15-minute walking catchment captures a significant share of amenities only in the innermost districts; beyond these, inter-building distances and the dominance of road infrastructure over pedestrian connectivity reduce walkable access sharply. For the majority of Wolfsburg's residents, the car is a functional necessity rather than a choice.`,
  bike:   `Cycling extends the effective accessibility catchment considerably compared to walking, but the gap between the planned and existing cycling infrastructure — particularly in outlying districts — constrains this potential. Within the centre, cycling scores are competitive with public transit; in peripheral settlements, the absence of dedicated cycling routes and the hostile road environment suppress modal uptake.`,
  public: `Public transport accessibility mirrors the monocentric convergence visible across all modes. Bus routes radiate from the city centre and the VW Werk, providing adequate coverage along major corridors while declining sharply in secondary residential areas. The system supports commuting to key destinations but offers limited flexibility for non-radial journeys or off-peak travel, restricting its role as a genuine car alternative for daily mobility.`,
  auto:   `Automobile accessibility is near-uniform across the entire city — a direct consequence of Wolfsburg's road network design. Within a 15-minute drive at 50 km/h, virtually every amenity is reachable from any location. This structural equality of motorised access is precisely what has suppressed the development of alternatives: the car performs so efficiently that the network has never required the density, mix, or walkability that typically sustain other modes.`,
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

      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={LB}>Active mode</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ width:14, height:14, borderRadius:'50%', background:cfg.color }} />
              <span style={{ fontFamily:F, fontSize:13, fontWeight:600, color:'#111' }}>{cfg.label}</span>
            </div>
            <p style={{ fontFamily:F, fontSize:11, color:'#999', margin:0 }}>{cfg.sub}</p>
          </div>

          <div style={{ marginBottom: 20 }}>
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

          {/* Destinations + Method only on the combined tab */}
          {tab === 'centrality' && (
            <>
              <div style={{ paddingTop:16, borderTop:'1px solid #E8E8E8' }}>
                <div style={LB}>Destinations</div>
                <p style={{ fontFamily:F, fontSize:11, color:'#555', lineHeight:1.7, margin:0 }}>
                  1 170 OSM amenities: schools, supermarkets, pharmacies, doctors, bakeries, banks, community centres + VW Werk gates (5 access points).
                </p>
              </div>
              <div style={{ marginTop:16 }}>
                <div style={LB}>Method</div>
                <p style={{ fontFamily:F, fontSize:11, color:'#555', lineHeight:1.7, margin:0 }}>
                  Reverse Dijkstra from each destination on mode-specific graph. Count reachable destinations per grid node. Normalised 0–100 within each mode.
                </p>
              </div>
            </>
          )}
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-start', borderTop:'1px solid #E8E8E8', paddingTop:16 }}>
          <p style={{ fontFamily:F, fontSize:11, color:'#555', lineHeight:1.7, margin:0 }}>
            {CENT_CAPTIONS[tab] || CENT_CAPTIONS.centrality}
          </p>
        </div>
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

const FURTHER_LINKS = [
  { label: 'Capacity Analysis',   id: 'capacity'  },
  { label: 'Hubs Algorithm Work', id: 'hub-algo'  },
  { label: 'Urban Design',        id: 'urban'     },
]

// ── Main page ─────────────────────────────────────────────────────────────────

const HERO_TITLE = '<STADT.HUB>'

export default function LandingPage() {
  const { setActiveSection, setActiveMode, setShowLanding, setNavOpen, setLandingSectionMode, setFromLanding, landingScrollTarget, setLandingScrollTarget } = useAppStore()
  const [typedTitle, setTypedTitle] = useState('')
  const [mapsReady, setMapsReady] = useState(false)
  const [mobilityTab, setMobilityTab] = useState('activity')
  const [livabilityTab, setLivabilityTab] = useState('livability')
  const [centralityTab, setCentralityTab] = useState('centrality')
  const [hubTab, setHubTab] = useState('placement')
  const [hubNetTab, setHubNetTab] = useState('hub-net')
  const pageRef = React.useRef(null)

  React.useEffect(() => {
    setNavOpen(false)
    setLandingSectionMode('geo', 'mobility')
  }, [])

  React.useLayoutEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i++
      setTypedTitle(HERO_TITLE.slice(0, i))
      if (i >= HERO_TITLE.length) {
        clearInterval(timer)
        setMapsReady(true)
      }
    }, 90)
    return () => clearInterval(timer)
  }, [])

  React.useEffect(() => {
    if (!landingScrollTarget) return
    const el = document.getElementById(landingScrollTarget)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    setLandingScrollTarget(null)
  }, [landingScrollTarget])

  const navigateTo = (id, mode, noMenu = false) => {
    setShowLanding(false)
    setNavOpen(!noMenu)
    setActiveSection(id)
    if (mode) setActiveMode(mode)
    if (noMenu) setFromLanding(true)
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
        minHeight: '100vh', position: 'relative',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 72px 72px',
        borderBottom: '1px solid #E8E8E8',
      }}>
        <div>
          <div style={{ ...EY, marginBottom: 36 }}>Research · Wolfsburg · 2026</div>
          <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
          <h1 style={{
            fontFamily: F, fontSize: 'clamp(72px, 10vw, 128px)',
            fontWeight: 700, color: '#111',
            lineHeight: 0.90, letterSpacing: '-0.05em',
            margin: '0 0 32px',
          }}>
            {typedTitle}
            {typedTitle.length < HERO_TITLE.length && (
              <span style={{ animation: 'blink 0.7s step-end infinite', marginLeft: 2 }}>|</span>
            )}
          </h1>
          <div style={{ width: 48, height: 2, background: '#111', marginBottom: 28 }} />
          <p style={{ fontFamily: F, fontSize: 20, color: '#444', lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
            //analysis part of the stadt.hub project
          </p>
        </div>
        <div style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: '#111', letterSpacing: '0.10em', textTransform: 'uppercase', marginTop: 56 }}>
          Scroll to explore ↓
        </div>

        {/* ── Right column: video + credits ─────────────────────────────── */}
        <div style={{
          position: 'absolute', right: 72, bottom: 72,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 20,
        }}>
          {/* Video — loops like GIF, click opens project site */}
          <a
            href="https://ofa5406.github.io/wolfsburg/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none', position: 'relative', flexShrink: 0 }}
          >
            <div style={{ position: 'relative', width: 420, borderRadius: 4, overflow: 'hidden', background: '#E8E8E8', border: '1px solid #D8D8D8' }}>
              <video
                src={`${import.meta.env.BASE_URL}Video/presentation.mp4`}
                autoPlay loop muted playsInline preload="auto"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontFamily: F, fontSize: 11, color: '#fff', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Project Presentation
                </span>
                <span style={{ fontFamily: F, fontSize: 13, color: '#fff' }}>↗</span>
              </div>
            </div>
          </a>

          {/* Credits */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: F, fontSize: 11, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Bauhaus-Universität Weimar · M.Sc. IUDD
            </div>
            {['Omer Faruk Aslan', 'Anastasiia Mulyndina', 'Basak Pinar'].map(name => (
              <div key={name} style={{ fontFamily: F, fontSize: 13, color: '#444', lineHeight: 1.7 }}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Project description — full width ──────────────────────────────── */}
      <section style={{ padding: '80px 72px', borderBottom: '1px solid #E8E8E8' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }}>
          <div>
            <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>About the Project</div>
            <p style={{ ...BD, fontSize: 14, color: '#444', marginBottom: 18 }}>
              Cars sit unused 90% of the time. What if no one owned one at all?
              This project reimagines Wolfsburg — one of Europe's most car-dependent cities — as a place
              where all mobility is shared, electric, and autonomous: on-demand, fleet-managed,
              and accessible to every resident.
            </p>
          </div>
          <div>
            <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>Analysis</div>
            <p style={{ ...BD, fontSize: 14, color: '#444', marginBottom: 18 }}>
              To adapt the urban environment to this new mobility scenario, three layers of spatial
              analysis were conducted — Mobility, Livability, and Centrality — feeding a hub placement
              model that identifies and ranks existing parking structures for conversion into
              shared mobility infrastructure.
            </p>
          </div>
          <div>
            <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>Result</div>
            <p style={{ ...BD, fontSize: 14, color: '#444' }}>
              A three-tier hub network (L · M · S) replaces private vehicles with a shared fleet
              of autonomous vehicles and e-bikes. The analysis covers the entire city; urban design
              interventions are focused on the nine central districts.
            </p>
          </div>
        </div>
      </section>

      {/* ── Analysis sections ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>

        {mapsReady && <>
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

          {/* Hub — 40/60 with tabs */}
          <section style={{ display:'flex', height:'100vh', border:'1px solid #E8E8E8', overflow:'hidden' }}>
            <div style={{ width:'40%', flexShrink:0, borderRight:'1px solid #E8E8E8', overflow:'hidden' }}>
              <HubLeftPanel tab={hubTab} netTab={hubNetTab} />
            </div>
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
              <HubMapSection tab={hubTab} onTabChange={setHubTab} netTab={hubNetTab} onNetTabChange={setHubNetTab} />
            </div>
          </section>

          {/* Comparative Analysis — full width, two side-by-side maps */}
          <ComparativeAnalysisSection />
        </>}

      </div>

      {/* ── Further Information — full width ──────────────────────────────── */}
      <section id="further-info" style={{ padding: '72px 72px 96px', borderTop: '2px solid #111' }}>
        <div style={EY}>Further Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div>
            {/* External links */}
            <a
              href="#"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 0', borderBottom: '1px solid #E8E8E8',
                color: '#111', textDecoration: 'none', fontFamily: F,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 400 }}>Project Website</span>
              <span style={{ fontSize: 18, color: '#bbb' }}>↗</span>
            </a>
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
            {/* Internal — scroll page only, no left menu */}
            {FURTHER_LINKS.map(({ label, id }) => (
              <button
                key={id}
                onClick={() => navigateTo(id, undefined, true)}
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
          </div>
        </div>
      </section>

    </div>
  )
}
