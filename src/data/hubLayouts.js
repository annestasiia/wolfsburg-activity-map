// Per-tier hub geometry — single source of truth for the plan + axonometric views.
//
// Coordinate system (metres):
//   x  → along the street (length of the field)
//   y  → across the street (width). y = 0 is the dwelling / building edge (Zone 3),
//        increasing toward and across the carriageway.
//   z  → height (used by the axonometric massing).
//
// Each placed element: { uid, ref, kind, x, y, w, d, h }
//   uid  unique per placement (React key + hover/select id)
//   ref  element id in hubElements.ELEMENTS (name, category color, definition)
//   kind massing primitive: canopy | shed | tree | bench | rack | terminal |
//        marker | board | post | pad | box | building | greenwall
//   x,y  centre position (metres)
//   w    size along x (metres)
//   d    size along y (metres)
//   h    height (metres)

export const HUB_LAYOUTS = {
  // ── S-HUB — one-sided last-mile stop ──────────────────────────────────────
  s: {
    field: { length: 17, width: 12 },
    carriageway: { y0: 8.5, y1: 12 },
    zones: [
      { key: 'z3', label: 'Zone 3 · Dwelling', y0: 0,   y1: 4 },
      { key: 'z2', label: 'Zone 2 · Threshold', y0: 4,   y1: 7 },
      { key: 'z1', label: 'Zone 1 · Vehicle', y0: 7,   y1: 8.5 },
      { key: 'cw', label: 'Carriageway', y0: 8.5, y1: 12, road: true },
    ],
    elements: [
      { uid: 'tree-1',    ref: 'tree',            kind: 'tree',     x: 3.0,  y: 2.0,  w: 1.4, d: 1.4, h: 4.5 },
      { uid: 'bench-1',   ref: 'bench',           kind: 'bench',    x: 6.5,  y: 2.2,  w: 2.2, d: 0.6, h: 0.5 },
      { uid: 'board-1',   ref: 'community-board', kind: 'board',    x: 10.0, y: 1.4,  w: 0.3, d: 1.4, h: 2.0 },
      { uid: 'marker-1',  ref: 'hub-marker',      kind: 'marker',   x: 13.8, y: 2.6,  w: 0.5, d: 0.5, h: 2.8 },
      { uid: 'canopy-1',  ref: 'canopy',          kind: 'canopy',   x: 8.5,  y: 5.4,  w: 7.0, d: 2.6, h: 3.2 },
      { uid: 'pbike-1',   ref: 'private-bike',    kind: 'rack',     x: 3.5,  y: 5.6,  w: 2.6, d: 1.0, h: 1.1 },
      { uid: 'ebike-1',   ref: 'ebike-dock',      kind: 'rack',     x: 11.5, y: 7.6,  w: 3.2, d: 0.8, h: 1.2 },
      { uid: 'charge-1',  ref: 'charging',        kind: 'post',     x: 13.8, y: 7.7,  w: 0.3, d: 0.3, h: 1.3 },
      { uid: 'pod-1',     ref: 'micro-pod',       kind: 'pad',      x: 8.0,  y: 10.2, w: 4.5, d: 2.2, h: 0.06 },
    ],
  },

  // ── M-HUB — two-sided neighbourhood transfer ──────────────────────────────
  m: {
    field: { length: 30, width: 20 },
    carriageway: { y0: 8, y1: 12 },
    zones: [
      { key: 'z3w', label: 'Zone 3 · Dwelling', y0: 0,  y1: 4 },
      { key: 'z2w', label: 'Zone 2 · Threshold', y0: 4,  y1: 7 },
      { key: 'z1w', label: 'Zone 1 · Vehicle', y0: 7,  y1: 8 },
      { key: 'cw',  label: 'Carriageway', y0: 8,  y1: 12, road: true },
      { key: 'z1e', label: 'Zone 1 · Vehicle', y0: 12, y1: 13 },
      { key: 'z2e', label: 'Zone 2 · Threshold', y0: 13, y1: 16 },
      { key: 'z3e', label: 'Zone 3 · Dwelling', y0: 16, y1: 20 },
    ],
    elements: [
      // West side
      { uid: 'tree-1',    ref: 'tree',            kind: 'tree',     x: 4.0,  y: 2.2,  w: 1.6, d: 1.6, h: 5.0 },
      { uid: 'group-1',   ref: 'group-seating',   kind: 'bench',    x: 9.0,  y: 2.4,  w: 3.0, d: 1.2, h: 0.5 },
      { uid: 'plant-1',   ref: 'planting',        kind: 'pad',      x: 16.0, y: 2.0,  w: 8.0, d: 1.4, h: 0.4 },
      { uid: 'repair-1',  ref: 'bike-repair',     kind: 'post',     x: 21.0, y: 2.4,  w: 0.6, d: 0.6, h: 1.3 },
      { uid: 'canopy-1',  ref: 'canopy',          kind: 'canopy',   x: 8.0,  y: 5.4,  w: 8.0, d: 2.6, h: 3.4 },
      { uid: 'info-1',    ref: 'info-terminal',   kind: 'terminal', x: 14.0, y: 5.6,  w: 0.4, d: 0.9, h: 2.2 },
      { uid: 'marker-1',  ref: 'hub-marker',      kind: 'marker',   x: 19.0, y: 5.6,  w: 0.5, d: 0.5, h: 2.8 },
      { uid: 'pbike-1',   ref: 'private-bike',    kind: 'rack',     x: 24.0, y: 5.6,  w: 3.0, d: 1.0, h: 1.1 },
      { uid: 'ebike-1',   ref: 'ebike-dock',      kind: 'rack',     x: 4.0,  y: 7.5,  w: 3.2, d: 0.8, h: 1.2 },
      { uid: 'cargo-1',   ref: 'cargo-bike',      kind: 'rack',     x: 9.0,  y: 7.5,  w: 3.0, d: 0.9, h: 1.4 },
      // East side
      { uid: 'ev-1',      ref: 'ev-bay',          kind: 'pad',      x: 6.0,  y: 12.6, w: 5.0, d: 1.0, h: 0.06 },
      { uid: 'auto-1',    ref: 'auto-dropoff',    kind: 'pad',      x: 14.0, y: 12.6, w: 6.0, d: 1.0, h: 0.06 },
      { uid: 'shed-1',    ref: 'pt-shed',         kind: 'shed',     x: 22.0, y: 12.9, w: 4.0, d: 1.6, h: 2.8 },
      { uid: 'kiosk-1',   ref: 'kiosk',           kind: 'box',      x: 8.0,  y: 17.5, w: 2.2, d: 1.6, h: 2.6 },
      { uid: 'bench-1',   ref: 'bench',           kind: 'bench',    x: 15.0, y: 18.2, w: 2.4, d: 0.6, h: 0.5 },
      { uid: 'tree-2',    ref: 'tree',            kind: 'tree',     x: 24.0, y: 18.0, w: 1.6, d: 1.6, h: 5.0 },
    ],
  },

  // ── L-HUB — neighbourhood anchor (reused car park + open space) ────────────
  l: {
    field: { length: 50, width: 40 },
    carriageway: { y0: 34, y1: 40 },
    zones: [
      { key: 'bld', label: 'Reuse building', y0: 0,  y1: 6,  building: true },
      { key: 'z3',  label: 'Zone 3 · Open / Dwelling', y0: 6,  y1: 18 },
      { key: 'z2',  label: 'Zone 2 · Threshold', y0: 18, y1: 28 },
      { key: 'z1',  label: 'Zone 1 · Vehicle / Fleet', y0: 28, y1: 34 },
      { key: 'cw',  label: 'Carriageway', y0: 34, y1: 40, road: true },
    ],
    elements: [
      { uid: 'bldg-1',    ref: 'flex-surface',    kind: 'building', x: 25.0, y: 3.0,  w: 44.0, d: 6.0, h: 12.0 },
      { uid: 'green-1',   ref: 'living-wall',     kind: 'greenwall',x: 9.0,  y: 6.4,  w: 11.0, d: 0.4, h: 8.0 },
      { uid: 'canopy-1',  ref: 'canopy',          kind: 'canopy',   x: 12.0, y: 25.0, w: 11.0, d: 4.0, h: 4.0 },
      { uid: 'flex-1',    ref: 'flex-surface',    kind: 'pad',      x: 26.0, y: 23.0, w: 16.0, d: 9.0, h: 0.04 },
      { uid: 'market-1',  ref: 'market-slot',     kind: 'pad',      x: 14.0, y: 21.0, w: 6.0,  d: 4.0, h: 0.05 },
      { uid: 'tree-1',    ref: 'tree',            kind: 'tree',     x: 14.0, y: 13.0, w: 1.8,  d: 1.8, h: 6.0 },
      { uid: 'tree-2',    ref: 'tree',            kind: 'tree',     x: 31.0, y: 12.0, w: 1.8,  d: 1.8, h: 6.0 },
      { uid: 'tree-3',    ref: 'tree',            kind: 'tree',     x: 41.0, y: 16.0, w: 1.8,  d: 1.8, h: 6.0 },
      { uid: 'art-1',     ref: 'art-marker',      kind: 'marker',   x: 21.0, y: 12.0, w: 0.8,  d: 0.8, h: 3.5 },
      { uid: 'group-1',   ref: 'group-seating',   kind: 'bench',    x: 23.0, y: 19.5, w: 4.0,  d: 1.4, h: 0.5 },
      { uid: 'bench-1',   ref: 'bench',           kind: 'bench',    x: 37.0, y: 20.5, w: 2.4,  d: 0.6, h: 0.5 },
      { uid: 'kiosk-1',   ref: 'kiosk',           kind: 'box',      x: 33.0, y: 18.0, w: 2.6,  d: 1.8, h: 2.8 },
      { uid: 'info-1',    ref: 'info-terminal',   kind: 'terminal', x: 40.0, y: 24.0, w: 0.5,  d: 1.0, h: 2.4 },
      { uid: 'ev-1',      ref: 'ev-bay',          kind: 'pad',      x: 13.0, y: 30.5, w: 9.0,  d: 2.2, h: 0.06 },
      { uid: 'auto-1',    ref: 'auto-dropoff',    kind: 'pad',      x: 33.0, y: 30.5, w: 11.0, d: 2.2, h: 0.06 },
      { uid: 'ebike-1',   ref: 'ebike-dock',      kind: 'rack',     x: 45.0, y: 30.0, w: 4.0,  d: 0.9, h: 1.2 },
      { uid: 'cargo-1',   ref: 'cargo-bike',      kind: 'rack',     x: 45.0, y: 27.0, w: 3.0,  d: 0.9, h: 1.4 },
      { uid: 'shed-1',    ref: 'pt-shed',         kind: 'shed',     x: 44.0, y: 33.0, w: 5.0,  d: 1.8, h: 3.0 },
    ],
  },
}

// Connectivity strategy diagrams (schematic, drawn in plan units 0..100 × 0..60)
export const CONNECTIVITY = [
  { id: 'cross',  title: 'Stone field crosses', caption: 'The reddish paving continues across the carriageway — the crossing is part of the hub.' },
  { id: 'raised', title: 'Raised carriageway',  caption: 'Road surface lifts and narrows at the hub — traffic calming built into the threshold.' },
  { id: 'both',   title: 'Both sides',          caption: 'Elements distribute across both kerbs — the hub bridges the street.' },
]
