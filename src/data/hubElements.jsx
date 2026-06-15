import React from 'react'

// ── Shared design tokens ─────────────────────────────────────────────────────
export const FONT  = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
export const SERIF = "'Georgia', 'Times New Roman', serif"
export const C = { bg: '#FAFAF9', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }
export const TERRA = '#B5541A'

// ── Element categories ───────────────────────────────────────────────────────
export const CATS = [
  { id: 'mobility',      label: 'Mobility',            color: '#C0392B' },
  { id: 'wayfinding',    label: 'Wayfinding',           color: '#2471A3' },
  { id: 'shelter',       label: 'Shelter & Comfort',    color: '#6C3483' },
  { id: 'environment',   label: 'Environment',           color: '#1E8449' },
  { id: 'social',        label: 'Social & Cultural',    color: '#D35400' },
  { id: 'lighting',      label: 'Lighting',              color: '#B7950B' },
  { id: 'connectivity',  label: 'Street Connectivity',  color: '#566573' },
]
export const CAT_COLOR = Object.fromEntries(CATS.map(c => [c.id, c.color]))
export const CAT_LABEL = Object.fromEntries(CATS.map(c => [c.id, c.label]))

// ── Element palette ──────────────────────────────────────────────────────────
export const ELEMENTS = [
  // MOBILITY — core
  { id: 'ebike-dock',      name: 'E-bike docking rack',           cat: 'mobility',     type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Shared system docking with integrated charging. Zone 1.' },
  { id: 'private-bike',    name: 'Private bike parking',          cat: 'mobility',     type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'For personally owned bikes. Secure, positioned near Zone 2.' },
  { id: 'cargo-bike',      name: 'Cargo bike dock',               cat: 'mobility',     type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Docking for cargo bikes (shared or private). Zone 1.' },
  { id: 'micro-pod',       name: 'Micro-pod zone',                cat: 'mobility',     type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Marked area in stone field where autonomous micro-pods stop.' },
  { id: 'ev-bay',          name: 'Shared EV bay',                 cat: 'mobility',     type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Parking and charging bay for shared electric cars. Zone 1.' },
  { id: 'auto-dropoff',    name: 'Autonomous drop-off zone',      cat: 'mobility',     type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Dedicated zone for autonomous shuttle pods and buses.' },
  { id: 'charging',        name: 'Charging points',               cat: 'mobility',     type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Integrated into docking furniture or structural elements.' },
  { id: 'info-terminal',   name: 'Real-time info terminal',       cat: 'mobility',     type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Live arrivals, vehicle availability at this hub, system map.' },
  { id: 'pt-shed',         name: 'Public transport shed',         cat: 'mobility',     type: 'core',     s: 'Standard',  m: 'Standard',  l: 'Mandatory', def: 'Shelter at bus/tram stops. May combine with canopy.' },
  // WAYFINDING — core
  { id: 'dir-lines',       name: 'Directional lines in stone',    cat: 'wayfinding',   type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Lines embedded in reddish stone field, pointing to mobility elements.' },
  { id: 'tactile',         name: 'Tactile paving strips',         cat: 'wayfinding',   type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Raised tactile surface at zone transitions, boarding areas, crossings.' },
  { id: 'hub-marker',      name: 'Hub identity marker',           cat: 'wayfinding',   type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Hub name, tier level (S/M/L), map of nearby hubs.' },
  // SHELTER — core
  { id: 'canopy',          name: 'Canopy / structural element',   cat: 'shelter',      type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Optional',  def: 'The vertical beacon. Overhead structure at Zone 2. Readable from 50m.' },
  { id: 'bench',           name: 'Seating — bench',               cat: 'shelter',      type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Linear bench for individual users. Zone 3.' },
  { id: 'group-seating',   name: 'Seating — group',               cat: 'shelter',      type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Larger seating configuration for social groups. Zone 3.' },
  { id: 'water-point',     name: 'Drinking water point',          cat: 'shelter',      type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Public water access. Zone 3.' },
  { id: 'bike-repair',     name: 'Bike repair station',           cat: 'shelter',      type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Self-service tools and pump. Integrated at Zone 3 edge.' },
  // ENVIRONMENT — core
  { id: 'tree',            name: 'Tree with stone grate',         cat: 'environment',  type: 'core',     s: 'Standard',  m: 'Mandatory', l: 'Mandatory', def: 'Tree in stone field; grate integrated flush with paving.' },
  { id: 'planting',        name: 'Planting bed / bioswale',       cat: 'environment',  type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Linear planted bed, may serve as stormwater channel.' },
  { id: 'permeable',       name: 'Permeable surface zones',       cat: 'environment',  type: 'core',     s: '—',         m: 'Mandatory', l: 'Mandatory', def: 'Sections of ground field using permeable paving.' },
  // SOCIAL — core
  { id: 'community-board', name: 'Community information board',   cat: 'social',       type: 'core',     s: 'Standard',  m: 'Standard',  l: 'Mandatory', def: 'Noticeboard for local events and neighbourhood information.' },
  { id: 'kiosk',           name: 'Vendor / kiosk slot',           cat: 'social',       type: 'core',     s: '—',         m: 'Standard',  l: 'Mandatory', def: 'Defined position for a small vendor (coffee, local goods).' },
  { id: 'art-marker',      name: 'Art or cultural marker',        cat: 'social',       type: 'core',     s: 'Standard',  m: 'Standard',  l: 'Mandatory', def: 'Site-specific artwork integrated into the hub — one per hub.' },
  { id: 'flex-surface',    name: 'Flexible surface area',         cat: 'social',       type: 'core',     s: '—',         m: 'Standard',  l: 'Mandatory', def: 'Clear paved area for temporary events, markets, gatherings.' },
  // LIGHTING — core
  { id: 'ground-lighting', name: 'Ground-embedded lighting',      cat: 'lighting',     type: 'core',     s: 'Mandatory', m: 'Mandatory', l: 'Mandatory', def: 'Lighting set into stone field. Hub visible and navigable at night.' },
  { id: 'ambient-lighting',name: 'Ambient responsive lighting',   cat: 'lighting',     type: 'core',     s: 'Standard',  m: 'Mandatory', l: 'Mandatory', def: 'Integrated into canopy. Brightens on approach, atmospheric at low use.' },
  // CONNECTIVITY — core
  { id: 'hub-crossing',    name: 'Hub-integrated crossing',       cat: 'connectivity', type: 'core',     s: 'Standard',  m: 'Standard',  l: 'Standard',  def: 'Stone field continues across carriageway — crossing is part of hub.' },
  { id: 'raised-carr',     name: 'Raised / narrowed carriageway', cat: 'connectivity', type: 'core',     s: '—',         m: 'Standard',  l: 'Standard',  def: 'Hub creates traffic calming; raised surface slows vehicles.' },
  { id: 'both-sides',      name: 'Elements on both sides',        cat: 'connectivity', type: 'core',     s: '—',         m: 'Standard',  l: 'Standard',  def: 'Hub distributes elements across both sides of the street.' },
  // OPTIONAL
  { id: 'heated-zone',     name: 'Heated waiting zone',           cat: 'shelter',      type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Enclosed or semi-enclosed seating with heating. Wolfsburg winters.' },
  { id: 'device-charging', name: 'Personal device charging',      cat: 'shelter',      type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'USB and wireless charging in bench or canopy. High-dwell locations.' },
  { id: 'solar-canopy',    name: 'Solar canopy',                  cat: 'environment',  type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Where energy generation is viable and visible as design statement.' },
  { id: 'wildflower',      name: 'Wildflower / meadow strip',     cat: 'environment',  type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Low-maintenance seasonal planting. Biodiversity benefit.' },
  { id: 'living-wall',     name: 'Living wall / vertical garden', cat: 'environment',  type: 'optional', s: '—',         m: '—',         l: 'Optional',  def: 'L-hub facades — repurposed car park walls with large vertical surface.' },
  { id: 'cargo-lending',   name: 'Cargo bike lending library',    cat: 'mobility',     type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Where cargo bike demand is high. Complementary to regular docking.' },
  { id: 'adaptive-dock',   name: 'Adaptive equipment dock',       cat: 'mobility',     type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Near residential care or where accessible vehicle demand is significant.' },
  { id: 'parcel-lockers',  name: 'Parcel / package lockers',      cat: 'mobility',     type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Where last-mile delivery is high. Reduces delivery van traffic.' },
  { id: 'luggage',         name: 'Luggage storage',               cat: 'shelter',      type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Near factory gates, train connections, or major interchange points.' },
  { id: 'micro-library',   name: 'Micro-library / book exchange', cat: 'social',       type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'High-dwell neighbourhood hubs. Integrated into structural element.' },
  { id: 'game-table',      name: 'Game table (chess, ping pong)', cat: 'social',       type: 'optional', s: '—',         m: 'Optional',  l: 'Optional',  def: 'M and L hubs with generous outdoor space and social ambition.' },
  { id: 'play-element',    name: 'Children\'s play element',      cat: 'social',       type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Near schools, parks, family residential areas.' },
  { id: 'fitness',         name: 'Outdoor fitness element',       cat: 'social',       type: 'optional', s: '—',         m: 'Optional',  l: 'Optional',  def: 'Simple bar or balance element. Minimal, serves all ages.' },
  { id: 'market-slot',     name: 'Pop-up market slot',            cat: 'social',       type: 'optional', s: '—',         m: 'Optional',  l: 'Optional',  def: 'Serviced, regular vendor surface. L-hub open spaces.' },
  { id: 'memory-marker',   name: 'Memory / history marker',       cat: 'social',       type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'At transformation sites — especially L-hubs on former car parks.' },
  { id: 'tool-lending',    name: 'Tool / equipment lending',      cat: 'social',       type: 'optional', s: 'Optional',  m: 'Optional',  l: 'Optional',  def: 'Near residential neighbourhoods. Small neighbourhood tool library.' },
]

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map(e => [e.id, e]))

// ── SVG Icons (24×24 viewBox) ────────────────────────────────────────────────
export function HubIcon({ id, color, size = 26 }) {
  const p = { stroke: color, fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const f = { ...p, fill: color, fillOpacity: 0.8 }

  const map = {
    'ebike-dock':      <><circle cx="7" cy="17" r="3.5" {...p}/><circle cx="17" cy="17" r="3.5" {...p}/><path d="M7 17l3-8h4" {...p}/><path d="M10 9l4 8" {...p}/><path d="M21 5l-2 4h1.5l-2.5 4.5" {...f}/></>,
    'private-bike':    <><circle cx="7" cy="17" r="3.5" {...p}/><circle cx="17" cy="17" r="3.5" {...p}/><path d="M7 17l3-8h4l-4 8" {...p}/><path d="M10 9h3" {...p}/></>,
    'cargo-bike':      <><circle cx="6" cy="17" r="3" {...p}/><circle cx="18" cy="17" r="3" {...p}/><path d="M6 17l3-7" {...p}/><rect x="9" y="7" width="7" height="6" rx="1" {...p}/><path d="M9 13l9 4" {...p}/></>,
    'micro-pod':       <><rect x="3" y="9" width="18" height="9" rx="4.5" {...p}/><circle cx="8" cy="18" r="2" {...{...p, fill:color, fillOpacity:0.25}}/><circle cx="16" cy="18" r="2" {...{...p, fill:color, fillOpacity:0.25}}/><path d="M10 12h4" {...p}/></>,
    'ev-bay':          <><rect x="2" y="10" width="15" height="9" rx="2" {...p}/><path d="M5 10l2-4h7l2 4" {...p}/><circle cx="6" cy="19" r="2" {...p}/><circle cx="12" cy="19" r="2" {...p}/><path d="M20 11v4m-2-2h4" {...{...p, strokeWidth:2}}/></>,
    'auto-dropoff':    <><rect x="2" y="11" width="13" height="8" rx="2" {...p}/><path d="M5 11l2-4h6l2 4" {...p}/><circle cx="6" cy="19" r="2" {...p}/><circle cx="11" cy="19" r="2" {...p}/><path d="M18 8a6 6 0 0 1 0 9" {...{...p, strokeDasharray:'2 1.5'}}/><path d="M21 14.5l-2-1 2-1" {...p}/></>,
    'charging':        <><path d="M13 2L4 14h7l-2 8 9-12h-7z" {...f}/></>,
    'info-terminal':   <><rect x="3" y="4" width="16" height="12" rx="2" {...p}/><path d="M8 20h8m-4-4v4" {...p}/><circle cx="17" cy="7" r="2" {...f}/><path d="M6 10h7m-7 3h5" {...p}/></>,
    'pt-shed':         <><path d="M2 8l10-5 10 5" {...p}/><path d="M5 8v9m14-9v9" {...p}/><rect x="7" y="12" width="10" height="6" rx="1" {...p}/></>,
    'dir-lines':       <><path d="M3 16h18m-18 4h13" {...p}/><path d="M14 12l6 4-6 4" {...p}/></>,
    'tactile':         <>{[7,12,17].map(x=>[8,13,18].map(y=><circle key={`${x}${y}`} cx={x} cy={y} r="1.5" fill={color} stroke="none"/>))}</>,
    'hub-marker':      <><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" {...{...p, fill:color, fillOpacity:0.85}}/><circle cx="12" cy="9" r="2.5" fill="white" stroke="white" strokeWidth="0.5"/></>,
    'canopy':          <><path d="M3 14C3 9 7.03 6 12 6s9 3 9 8" {...p}/><path d="M6 14v7m12-7v7" {...p}/><path d="M3 14h18" {...{...p, strokeWidth:2}}/></>,
    'bench':           <><rect x="3" y="10" width="18" height="3" rx="1" {...p}/><path d="M7 13v5m10-5v5" {...p}/><path d="M4 16h16" {...p}/></>,
    'group-seating':   <><rect x="2" y="12" width="6" height="5" rx="1" {...p}/><rect x="9" y="12" width="6" height="5" rx="1" {...p}/><rect x="16" y="12" width="6" height="5" rx="1" {...p}/><path d="M5 12V9m3 3V9m8 3V9m3 3V9" {...p}/></>,
    'water-point':     <><path d="M12 2L5 14a7 7 0 0 0 14 0z" {...p}/></>,
    'bike-repair':     <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.77-2.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-2.76 2.76z" {...p}/></>,
    'tree':            <><path d="M12 3L3 17h6l-2 5h10l-2-5h6z" {...p}/></>,
    'planting':        <><path d="M12 22V12" {...p}/><path d="M12 12C12 7 8 4 4 6c4 1 7 5 8 6" {...p}/><path d="M12 12c0-5 4-8 8-6-4 1-7 5-8 6" {...p}/></>,
    'permeable':       <><path d="M12 3L7 12a5 5 0 0 0 10 0z" {...p}/><path d="M3 20h18" {...p}/><path d="M7 20v-3m5 3v-3m5 3v-3" {...{...p, strokeWidth:1.3}}/></>,
    'community-board': <><rect x="3" y="4" width="18" height="13" rx="2" {...p}/><path d="M9 21l3-4 3 4" {...p}/><path d="M7 9h10m-10 4h7" {...p}/></>,
    'kiosk':           <><path d="M4 10h16l-2-5H6z" {...p}/><rect x="3" y="14" width="18" height="6" rx="1" {...p}/><path d="M4 10v4m16-4v4" {...p}/></>,
    'art-marker':      <><circle cx="12" cy="12" r="3" {...p}/><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-14.12-5.88l2.12 2.12m8.48 8.48l2.12 2.12M5.88 18.12l2.12-2.12m8.48-8.48l2.12-2.12" {...p}/></>,
    'flex-surface':    <><rect x="3" y="3" width="18" height="18" rx="2" {...p}/><path d="M3 9h18M3 15h18M9 3v18m6-18v18" {...{...p, strokeWidth:1}}/></>,
    'ground-lighting': <><circle cx="12" cy="14" r="4" {...p}/><circle cx="12" cy="14" r="1.5" {...f}/><path d="M12 3v4M3 14h2m14 0h2m-14.6-7.6l1.4 1.4m8.4 8.4l1.4 1.4" {...{...p, strokeWidth:1.3}}/></>,
    'ambient-lighting':<><path d="M4 16C4 11 7.58 7 12 7s8 4 8 9" {...p}/><path d="M2 16h20" {...{...p, strokeWidth:2}}/><path d="M12 1v4m-6-1.5l2 2m8-2l-2 2" {...p}/></>,
    'hub-crossing':    <><rect x="6" y="3" width="3.5" height="18" rx="1" {...{...p, fill:color, fillOpacity:0.5}}/><rect x="11" y="3" width="3.5" height="18" rx="1" {...{...p, fill:color, fillOpacity:0.5}}/><rect x="16" y="3" width="3.5" height="18" rx="1" {...{...p, fill:color, fillOpacity:0.5}}/></>,
    'raised-carr':     <><path d="M2 18h5c2 0 2-9 5-9s3 9 5 9h5" {...p}/><path d="M2 18h20" {...{...p, strokeWidth:2}}/></>,
    'both-sides':      <><path d="M7 12h10" {...{...p, strokeWidth:2}}/><path d="M4 9l-3 3 3 3m13-6l3 3-3 3" {...p}/><path d="M12 5v3m0 9v3" {...{...p, strokeDasharray:'1.5 1.5'}}/></>,
    'heated-zone':     <><path d="M9 5c0 3.5-4 3.5-4 7s4 3.5 4 7m6-14c0 3.5-4 3.5-4 7s4 3.5 4 7" {...p}/></>,
    'device-charging': <><rect x="7" y="2" width="10" height="20" rx="2" {...p}/><path d="M12 7l-2 5h4l-2 5" {...f}/></>,
    'solar-canopy':    <><path d="M4 14l8-9 8 9" {...p}/><path d="M3 14h18" {...{...p, strokeWidth:2}}/><circle cx="12" cy="7" r="2" {...f}/><path d="M12 1v2m-5 1l1.5 1.5m7-1.5L17 5.5" {...{...p, strokeWidth:1.3}}/></>,
    'wildflower':      <><circle cx="12" cy="7" r="2.5" {...p}/><circle cx="7" cy="12" r="2.5" {...p}/><circle cx="17" cy="12" r="2.5" {...p}/><path d="M12 9.5v10m-5-7.5v7m10-7.5v7" {...p}/><circle cx="12" cy="7" r="1" {...f}/><circle cx="7" cy="12" r="1" {...f}/><circle cx="17" cy="12" r="1" {...f}/></>,
    'living-wall':     <><rect x="3" y="3" width="18" height="18" rx="1" {...{...p, fill:color, fillOpacity:0.07}}/><path d="M8 10c1-2 3-3 4-1m4 1c1-2 3-3 4-1M8 16c1-2 3-3 4-1m4 1c1-2 3-3 4-1" {...p}/></>,
    'cargo-lending':   <><circle cx="5" cy="17" r="3" {...p}/><circle cx="16" cy="17" r="3" {...p}/><path d="M5 17l3-7" {...p}/><rect x="8" y="8" width="7" height="5" rx="1" {...p}/><path d="M20 5l3 3-3 3m2.5-3h-5" {...p}/></>,
    'adaptive-dock':   <><circle cx="12" cy="5" r="2" {...p}/><path d="M12 7v6l3 4" {...p}/><path d="M6 10h6" {...p}/><path d="M9 17c0 3 2.5 5 5.5 5s5.5-2.2 5.5-5" {...p}/></>,
    'parcel-lockers':  <><rect x="4" y="9" width="16" height="12" rx="1" {...p}/><path d="M4 14h16" {...p}/><path d="M9 5a3 3 0 0 1 6 0v4" {...p}/><circle cx="12" cy="17" r="2" {...{...p, fill:color, fillOpacity:0.3}}/></>,
    'luggage':         <><rect x="5" y="9" width="14" height="12" rx="2" {...p}/><path d="M9 9V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" {...p}/><path d="M5 14h14" {...p}/></>,
    'micro-library':   <><path d="M4 19V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13" {...p}/><path d="M4 19h16" {...p}/><path d="M12 4v15" {...p}/><path d="M8 8h3m-3 4h3m5-4h1m-1 4h1" {...p}/></>,
    'game-table':      <><ellipse cx="12" cy="9" rx="4" ry="2" {...p}/><path d="M8 9v6l4 6 4-6V9" {...p}/><path d="M8 15h8" {...p}/></>,
    'play-element':    <><circle cx="12" cy="5" r="2.5" {...p}/><path d="M12 7.5v5" {...p}/><path d="M8 12.5h8" {...p}/><path d="M8 12.5L5 21m11-8.5L19 21" {...p}/></>,
    'fitness':         <><path d="M4 7h16" {...{...p, strokeWidth:2}}/><path d="M8 7v10m8-10v10" {...p}/><path d="M6 14l2 5 2-5 2 5 2-5 2 5" {...p}/></>,
    'market-slot':     <><path d="M3 14l9-9 9 9" {...p}/><path d="M3 14v7h18v-7" {...p}/><path d="M9 21v-6h6v6" {...p}/></>,
    'memory-marker':   <><rect x="3" y="6" width="18" height="12" rx="2" {...p}/><path d="M12 9l1.5 3h3l-2.5 1.8 1 3-3-2-3 2 1-3L7.5 12H10z" {...{...p, fill:color, fillOpacity:0.7}}/></>,
    'tool-lending':    <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.77-2.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-2.76 2.76z" {...p}/><path d="M19 2v5m-2.5-2.5h5" {...{...p, strokeWidth:1.8}}/></>,
  }

  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      {map[id] ?? <circle cx="12" cy="12" r="8" stroke={color} fill="none" strokeWidth="1.6"/>}
    </svg>
  )
}
