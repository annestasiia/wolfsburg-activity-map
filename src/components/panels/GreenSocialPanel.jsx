import React, { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { useGreenSocialData } from '../../hooks/useGreenSocialData'
import {
  generateInsights,
  scoreToGSAColor,
  SOCIAL_AMENITY_TYPES,
} from '../../utils/greenSocialAnalysis'

// ── Analysis definitions ──────────────────────────────────────────────────────

const ANALYSES = [
  {
    id:          'coverage',
    label:       'Green Coverage',
    icon:        '🌳',
    color:       '#2D6A4F',
    description: 'Quantity and quality of green space per district — parks, forests, natural vegetation — normalized by area.',
    needsSocial: false,
  },
  {
    id:          'social',
    label:       'Social Infrastructure',
    icon:        '👥',
    color:       '#6B46C1',
    description: 'Density of social amenities in and around green spaces: playgrounds, sports areas, benches, cafés, BBQs.',
    needsSocial: true,
  },
  {
    id:          'encounter',
    label:       'Encounter Potential',
    icon:        '✨',
    color:       '#C05621',
    description: 'Composite index: green quality (35%) × social amenities (30%) × transit access (20%) × pedestrian path density (15%).',
    needsSocial: true,
  },
  {
    id:          'accessibility',
    label:       'Green Accessibility',
    icon:        '🚶',
    color:       '#2B6CB0',
    description: 'Proximity and presence of quality green areas (parks, forests, nature reserves) within and adjacent to each district.',
    needsSocial: false,
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ name, score, type, isTop }) {
  const color = scoreToGSAColor(score, type)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width:        118,
        fontSize:      12,
        color:        '#1D1D1F',
        flexShrink:    0,
        fontWeight:    isTop ? 600 : 400,
        whiteSpace:   'nowrap',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
      }}>
        {name}
      </div>
      <div style={{ flex: 1, height: 7, background: '#E8E8ED', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width:        `${(score / 10) * 100}%`,
          height:       '100%',
          background:    color,
          borderRadius:  4,
          transition:   'width 0.4s ease',
          minWidth:      score > 0 ? 3 : 0,
        }} />
      </div>
      <span style={{
        fontSize:  11,
        color:    '#6E6E73',
        width:     26,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

function ToggleRow({ active, onToggle, icon, label, rightLabel, color = '#2D6A4F' }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:         8,
        padding:    '8px 12px',
        borderRadius: 9,
        fontFamily: 'inherit',
        background:  active ? `${color}12` : '#F5F5F7',
        border:     `1px solid ${active ? color : 'rgba(0,0,0,0.08)'}`,
        cursor:     'pointer',
        transition: 'all 0.15s ease',
        width:      '100%',
        textAlign:  'left',
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{
        fontSize:   12,
        fontWeight: 500,
        flex:       1,
        color:      active ? '#1D1D1F' : '#6E6E73',
      }}>
        {label}
      </span>
      <span style={{
        fontSize:     10,
        fontWeight:   600,
        color:        active ? color : '#AEAEB2',
        letterSpacing:'0.04em',
      }}>
        {rightLabel}
      </span>
    </button>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function GreenSocialPanel() {
  useGreenSocialData()

  const {
    greenSocialActiveAnalysis,
    setGreenSocialActiveAnalysis,
    greenSocialScores,
    greenSocialError,
    socialAmenitiesGeoJSON,
    socialAmenitiesLoading,
    showSocialAmenities,
    toggleShowSocialAmenities,
    showGreenSocialMap,
    toggleShowGreenSocialMap,
    greeneryGeoJSON,
  } = useAppStore()

  const activeAnalysis = ANALYSES.find(a => a.id === greenSocialActiveAnalysis)
  const color          = activeAnalysis?.color || '#2D6A4F'

  const sortedDistricts = useMemo(() => {
    if (!greenSocialScores || !Object.keys(greenSocialScores).length) return []
    return Object.entries(greenSocialScores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, v]) => isFinite(v))
  }, [greenSocialScores])

  const insights = useMemo(() =>
    greenSocialActiveAnalysis && sortedDistricts.length
      ? generateInsights(greenSocialScores, greenSocialActiveAnalysis)
      : [],
    [greenSocialScores, greenSocialActiveAnalysis, sortedDistricts.length]
  )

  const needsGreenery    = !greeneryGeoJSON
  const waitingForSocial = activeAnalysis?.needsSocial && !socialAmenitiesGeoJSON && !socialAmenitiesLoading

  // Amenity type breakdown for social/encounter analyses
  const amenityBreakdown = useMemo(() => {
    if (!socialAmenitiesGeoJSON) return []
    const counts = {}
    for (const f of socialAmenitiesGeoJSON.features) {
      const t = f.properties._type
      counts[t] = (counts[t] || 0) + 1
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [socialAmenitiesGeoJSON])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Header description ── */}
      <p style={{
        fontSize: 12, color: '#6E6E73', lineHeight: 1.55,
        letterSpacing: '-0.01em', margin: 0,
      }}>
        Understand how green infrastructure supports social life, mobility, and encounter
        across Wolfsburg's 42 districts.
      </p>

      {/* ── Analysis type selector ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {ANALYSES.map(a => {
          const active = greenSocialActiveAnalysis === a.id
          return (
            <button
              key={a.id}
              onClick={() => setGreenSocialActiveAnalysis(active ? null : a.id)}
              style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:            5,
                padding:       '11px 8px',
                borderRadius:   12,
                background:     active ? `${a.color}18` : '#F5F5F7',
                border:        `1.5px solid ${active ? a.color : 'rgba(0,0,0,0.08)'}`,
                cursor:        'pointer',
                fontFamily:    'inherit',
                transition:    'all 0.15s ease',
                boxShadow:      active ? `0 2px 8px ${a.color}28` : 'none',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{a.icon}</span>
              <span style={{
                fontSize:   11,
                fontWeight: 600,
                color:      active ? a.color : '#6E6E73',
                textAlign:  'center',
                lineHeight:  1.3,
                letterSpacing: '-0.01em',
              }}>
                {a.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Active analysis description ── */}
      {activeAnalysis && (
        <p style={{
          fontSize: 12, color: '#3D3D3F', lineHeight: 1.55, margin: 0,
          background: `${color}0C`, borderRadius: 9,
          padding: '9px 12px',
          border: `1px solid ${color}22`,
          letterSpacing: '-0.01em',
        }}>
          {activeAnalysis.description}
        </p>
      )}

      {/* ── Need to load greenery data first ── */}
      {needsGreenery && greenSocialActiveAnalysis && (
        <div style={{
          background: '#FFFDE7', border: '1px solid #F9A825',
          borderRadius: 10, padding: '10px 13px', fontSize: 12, color: '#7B5700',
          lineHeight: 1.5,
        }}>
          Switch to the <strong>Layers</strong> tab first to load OSM greenery data, then return here.
        </div>
      )}

      {/* ── Map layer toggles (visible once analysis is selected + data ready) ── */}
      {greenSocialActiveAnalysis && !needsGreenery && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <ToggleRow
            active={showGreenSocialMap}
            onToggle={toggleShowGreenSocialMap}
            icon="🗺️"
            label="District heatmap on map"
            rightLabel={showGreenSocialMap ? 'ON' : 'OFF'}
            color={color}
          />
          <ToggleRow
            active={showSocialAmenities}
            onToggle={toggleShowSocialAmenities}
            icon="📍"
            label="Social amenity points"
            rightLabel={
              socialAmenitiesLoading
                ? 'loading…'
                : showSocialAmenities
                  ? `${socialAmenitiesGeoJSON?.features.length ?? 0} pts`
                  : 'OFF'
            }
            color="#845EF7"
          />
        </div>
      )}

      {/* ── Loading social data ── */}
      {socialAmenitiesLoading && (
        <p style={{ fontSize: 12, color: '#AEAEB2', letterSpacing: '-0.01em', margin: 0 }}>
          Fetching social amenities from OpenStreetMap…
        </p>
      )}

      {/* ── Waiting for social data to compute ── */}
      {waitingForSocial && (
        <p style={{ fontSize: 12, color: '#AEAEB2', margin: 0 }}>
          Waiting for social amenity data…
        </p>
      )}

      {/* ── Error ── */}
      {greenSocialError && (
        <div style={{
          background: '#FFF3F3', border: '1px solid #FFCDD2',
          borderRadius: 10, padding: '9px 12px', fontSize: 12, color: '#C62828',
        }}>
          {greenSocialError}
        </div>
      )}

      {/* ── Results ── */}
      {sortedDistricts.length > 0 && !greenSocialError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* District ranking */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 8, letterSpacing: '-0.01em' }}>
              District ranking · {activeAnalysis?.label}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sortedDistricts.map(([name, score], i) => (
                <ScoreBar
                  key={name}
                  name={name}
                  score={score}
                  type={greenSocialActiveAnalysis}
                  isTop={i < 3}
                />
              ))}
            </div>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div style={{
              background:   `${color}08`,
              border:       `1px solid ${color}22`,
              borderRadius:  10,
              padding:      '10px 12px',
              display:      'flex',
              flexDirection:'column',
              gap:           5,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color, margin: 0, letterSpacing: '-0.01em' }}>
                Key findings
              </p>
              {insights.map((text, i) => (
                <p key={i} style={{ fontSize: 11, color: '#3D3D3F', margin: 0, lineHeight: 1.55 }}>
                  {text}
                </p>
              ))}
            </div>
          )}

          {/* Social amenity breakdown */}
          {amenityBreakdown.length > 0 &&
            (greenSocialActiveAnalysis === 'social' || greenSocialActiveAnalysis === 'encounter') && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, letterSpacing: '-0.01em' }}>
                Social amenities · {socialAmenitiesGeoJSON.features.length} found
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {amenityBreakdown.map(([type, count]) => {
                  const meta = SOCIAL_AMENITY_TYPES[type]
                  if (!meta) return null
                  return (
                    <span key={type} style={{
                      fontSize:   11,
                      padding:   '3px 8px',
                      borderRadius: 980,
                      background: `${meta.color}18`,
                      border:    `1px solid ${meta.color}40`,
                      color:     '#3D3D3F',
                    }}>
                      {meta.icon} {meta.label}{' '}
                      <span style={{ color: '#AEAEB2' }}>{count}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attribution */}
          <p style={{ fontSize: 11, color: '#AEAEB2', margin: 0 }}>
            Data:{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#AEAEB2', textDecoration: 'underline' }}
            >
              OpenStreetMap
            </a>{' '}
            · ODbL · Scores normalized 0–10 within Wolfsburg
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!greenSocialActiveAnalysis && (
        <p style={{ fontSize: 12, color: '#AEAEB2', margin: 0, letterSpacing: '-0.01em' }}>
          Select an analysis type above to begin.
        </p>
      )}
    </div>
  )
}
