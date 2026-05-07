import React from 'react'
import { useAppStore } from '../../store/appStore'

// ── Flow diagram primitives ───────────────────────────────────────────────────

function Box({ title, detail, color, wide }) {
  return (
    <div style={{
      background:    `${color}12`,
      border:        `1.5px solid ${color}40`,
      borderRadius:   10,
      padding:       '9px 16px',
      width:          wide ? 280 : 220,
      textAlign:     'center',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, lineHeight: 1.3 }}>{title}</div>
      {detail && (
        <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 4, lineHeight: 1.4 }}>{detail}</div>
      )}
    </div>
  )
}

function Arrow({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{ width: 2, height: 14, background: `${color}50` }} />
      <div style={{
        width: 0, height: 0,
        borderLeft:  '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop:   `7px solid ${color}70`,
      }} />
    </div>
  )
}

function Flow({ steps, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <Box {...s} color={color} />
          {i < steps.length - 1 && <Arrow color={color} />}
        </React.Fragment>
      ))}
    </div>
  )
}

function ParallelBranches({ branches, color, mergeLabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Branch split */}
      <div style={{ width: 2, height: 14, background: `${color}50` }} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {branches.map((b, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: `${color}0A`, border: `1px dashed ${color}30`,
            borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 6, textAlign: 'center' }}>
              {b.label}
            </div>
            <div style={{
              fontSize: 10, color: '#6E6E73', textAlign: 'center', lineHeight: 1.4, maxWidth: 100,
            }}>{b.detail}</div>
            <div style={{
              marginTop: 8, fontSize: 13, fontWeight: 700,
              color, background: `${color}18`, borderRadius: 6, padding: '3px 10px',
            }}>{b.weight}</div>
          </div>
        ))}
      </div>
      {/* Merge arrow */}
      <div style={{ width: 2, height: 14, background: `${color}50`, marginTop: 0 }} />
      <div style={{
        width: 0, height: 0,
        borderLeft:  '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop:   `7px solid ${color}70`,
      }} />
      <Box title={mergeLabel} color={color} wide />
    </div>
  )
}

// ── Methodology content per analysis ─────────────────────────────────────────

const CONTENT = {
  coverage: {
    label: 'Green Coverage',
    icon:  '🌳',
    color: '#2D6A4F',
    tagline: 'How much of the district is actually covered by green area?',
    formula: 'Score = Σ( weight × intersection_area ) / district_area',
    sections: [
      {
        title: 'Data source',
        text: 'OpenStreetMap polygon features: parks, forests, meadows, conservation areas, gardens, recreation grounds, agriculture, individual vegetation.',
      },
      {
        title: 'Key concept',
        text: 'Each green polygon is clipped to the exact district boundary using Sutherland-Hodgman on fan-triangulated district rings. Only the actual overlapping area counts — no approximation.',
      },
    ],
    flow: [
      { title: 'Load OSM greenery GeoJSON', detail: 'Parks, forests, meadows, etc.' },
      { title: 'Filter to polygon features', detail: 'Only Polygon / MultiPolygon have area' },
      { title: 'For each of 42 districts', detail: 'Get boundary polygon from GeoJSON' },
      { title: 'Fan-triangulate district ring', detail: 'N triangles from centroid — each is convex' },
      { title: 'Clip green polygon × each triangle', detail: 'Sutherland-Hodgman algorithm' },
      { title: 'Signed area sum → intersection area B', detail: 'Concave districts handled via signed contributions' },
      { title: 'district area A = shoelace formula', detail: 'Real polygon area, not bounding box' },
      { title: 'raw = Σ( weight_category × B ) / A', detail: 'Weighted green fraction of district' },
      { title: 'normalize across 42 districts → 0–10', detail: 'Highest district = 10' },
    ],
  },

  social: {
    label: 'Social Infrastructure',
    icon:  '👥',
    color: '#6B46C1',
    tagline: 'How many places support social encounter in or near green space?',
    formula: 'Score = Σ( amenity_weight × point_in_district ) / √(district_area)',
    sections: [
      {
        title: 'Data source',
        text: 'OpenStreetMap node features: playgrounds, sports pitches, sports centres, fitness stations, cafés, restaurants, BBQ areas, picnic sites, picnic tables, benches, drinking water, fountains, shelters, toilets.',
      },
      {
        title: 'Amenity weights',
        text: 'Playground = 5 · Sports pitch/centre = 4 · Café / BBQ / fitness = 3 · Restaurant / picnic site / drinking water / fountain / shelter = 2 · Bench / picnic table / toilets = 1',
      },
    ],
    flow: [
      { title: 'Query 14 amenity types from Overpass API', detail: 'Bounding box: Wolfsburg extent' },
      { title: 'Convert OSM nodes to GeoJSON points', detail: 'Ways use centroid coordinate' },
      { title: 'For each of 42 districts', detail: 'Get boundary rings' },
      { title: 'Point-in-polygon test per amenity', detail: 'Ray-casting on real district boundary' },
      { title: 'Accumulate Σ( weight × inside? )', detail: 'Weighted count of amenities' },
      { title: 'Divide by √( district_area )', detail: 'Size-normalised density' },
      { title: 'normalize across 42 districts → 0–10', detail: 'Highest district = 10' },
    ],
  },

  accessibility: {
    label: 'Green Accessibility',
    icon:  '🚶',
    color: '#2B6CB0',
    tagline: 'How close are residents to a meaningful green space?',
    formula: 'Score = Σ( 3 if inside · 1 if within 800m )',
    sections: [
      {
        title: 'Quality green categories',
        text: 'Only high-value areas count: parks & recreation, forests & woods, natural vegetation, protected & conservation areas.',
      },
      {
        title: 'Proximity method',
        text: 'Proximity is tested as vertex-to-vertex distance on the actual polygon geometries, not bounding boxes. Threshold ≈ 0.010° ≈ 800 m.',
      },
    ],
    flow: [
      { title: 'Filter quality green polygons', detail: 'Parks, forests, natural areas, conservation' },
      { title: 'For each of 42 districts', detail: 'Extract boundary rings' },
      { title: 'featureIntersectsDistrict?', detail: 'Polygon intersection test' },
      { title: '→ YES: score += 3', detail: 'Green space is inside the district' },
      { title: 'featureNearDistrict ( < 800 m )?', detail: 'Vertex proximity on real geometry' },
      { title: '→ YES: score += 1', detail: 'Green space is just outside but reachable' },
      { title: 'normalize across 42 districts → 0–10', detail: 'Highest district = 10' },
    ],
  },

  encounter: {
    label: 'Encounter Potential',
    icon:  '✨',
    color: '#C05621',
    tagline: 'How likely are spontaneous social encounters in green spaces?',
    formula: 'Score = Σ( weight_i / total_weights × sub_score_i )',
    sections: [
      {
        title: 'Composite index',
        text: 'Four independently scored dimensions are combined with configurable weights. Default: green quality 35%, social amenities 30%, transit access 20%, pedestrian paths 15%.',
      },
      {
        title: 'Weight controls',
        text: 'All four weights are adjustable in the Analysis tab. The system auto-normalises so the weights always sum to 100% regardless of the values you set.',
      },
    ],
    encounterBranches: true,
  },
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function AnalysisInfoModal() {
  const { gssInfoModal, setGSSInfoModal, encounterWeights } = useAppStore()
  if (!gssInfoModal) return null

  const c = CONTENT[gssInfoModal]
  if (!c) return null

  const ew = encounterWeights || { green: 35, social: 30, transit: 20, paths: 15 }
  const ewTotal = ew.green + ew.social + ew.transit + ew.paths

  return (
    <div
      onClick={e => e.target === e.currentTarget && setGSSInfoModal(null)}
      style={{
        position:  'fixed',
        inset:      0,
        zIndex:     100,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display:   'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:   '24px 16px',
      }}
    >
      <div style={{
        background:     'rgba(255,255,255,0.98)',
        borderRadius:    20,
        boxShadow:      '0 24px 80px rgba(0,0,0,0.22)',
        width:          '100%',
        maxWidth:        780,
        maxHeight:      '90vh',
        display:        'flex',
        flexDirection:  'column',
        overflow:       'hidden',
      }}>
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '20px 28px 16px',
          borderBottom:   '1px solid rgba(0,0,0,0.06)',
          flexShrink:      0,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
              {c.icon} {c.label}
            </div>
            <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 3, letterSpacing: '-0.01em' }}>
              {c.tagline}
            </div>
          </div>
          <button
            onClick={() => setGSSInfoModal(null)}
            style={{
              background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 10, padding: '7px 13px', fontSize: 14,
              color: '#6E6E73', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '24px 28px', display: 'flex', gap: 32 }}>

          {/* Left: flowchart */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: c.color,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
            }}>
              Algorithm
            </div>

            {c.flow && <Flow steps={c.flow} color={c.color} />}

            {c.encounterBranches && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box title="Compute 4 sub-scores independently" detail="Each uses real polygon geometry" color={c.color} wide />
                <Arrow color={c.color} />
                <ParallelBranches
                  color={c.color}
                  branches={[
                    { label: 'Green Coverage', detail: 'Weighted intersection area / district area', weight: `${Math.round(ew.green / ewTotal * 100)}%` },
                    { label: 'Social Amenities', detail: 'Weighted amenity density', weight: `${Math.round(ew.social / ewTotal * 100)}%` },
                    { label: 'Transit Density', detail: 'Bus stops inside district', weight: `${Math.round(ew.transit / ewTotal * 100)}%` },
                    { label: 'Path Density', detail: 'Footways & pedestrian routes', weight: `${Math.round(ew.paths / ewTotal * 100)}%` },
                  ]}
                  mergeLabel="Weighted sum → raw composite score"
                />
                <Arrow color={c.color} />
                <Box title="normalize across 42 districts → 0–10" detail="Highest district = 10" color={c.color} wide />
              </div>
            )}
          </div>

          {/* Right: formula + notes */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: c.color,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
            }}>
              Formula
            </div>
            <div style={{
              background:   `${c.color}0C`,
              border:       `1.5px solid ${c.color}30`,
              borderRadius:  12,
              padding:      '12px 14px',
              fontSize:      12,
              fontFamily:   'monospace',
              color:        '#1D1D1F',
              lineHeight:    1.6,
              marginBottom:  20,
              wordBreak:    'break-all',
            }}>
              {c.formula}
            </div>

            {c.sections?.map((s, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#1D1D1F',
                  letterSpacing: '-0.01em', marginBottom: 5,
                }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: '#3D3D3F', lineHeight: 1.6 }}>
                  {s.text}
                </div>
              </div>
            ))}

            <div style={{
              marginTop: 8, padding: '10px 12px',
              background: '#F5F5F7', borderRadius: 10,
              fontSize: 11, color: '#6E6E73', lineHeight: 1.5,
            }}>
              <strong style={{ color: '#3D3D3F' }}>Data:</strong> OpenStreetMap · ODbL<br />
              All scores normalized 0–10 within Wolfsburg's 42 districts.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
