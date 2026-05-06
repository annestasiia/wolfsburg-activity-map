import React, { useState, useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { GREENERY_CATEGORIES } from '../../utils/greeneryConfig'

// ── Helpers ────────────────────────────────────────────────────────────────

function countFeatures(geoJSON) {
  const counts = {}
  if (!geoJSON) return counts

  for (const f of geoJSON.features) {
    const catId    = f.properties._categoryId
    const tagKey   = f.properties._tagKey
    const tagValue = f.properties._tagValue

    counts[catId] = (counts[catId] || 0) + 1

    const subKey = catId === 'others'
      ? `others__${tagKey}__${tagValue}`
      : `${catId}__${tagKey}__${tagValue}`
    counts[subKey] = (counts[subKey] || 0) + 1
  }
  return counts
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TagChip({ label, count, enabled, parentEnabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!parentEnabled}
      style={{
        padding:      '4px 10px',
        borderRadius:  980,
        fontSize:      12,
        fontWeight:    500,
        background:    enabled ? 'rgba(45,106,79,0.12)' : '#F5F5F7',
        border:       `1px solid ${enabled ? '#2D6A4F' : 'rgba(0,0,0,0.08)'}`,
        cursor:       parentEnabled ? 'pointer' : 'default',
        color:         enabled ? '#1D1D1F' : '#6E6E73',
        fontFamily:   'inherit',
        transition:   'all 0.15s ease',
        opacity:       parentEnabled ? 1 : 0.45,
        display:      'flex',
        alignItems:   'center',
        gap:           5,
      }}
    >
      {label}
      {count > 0 && (
        <span style={{ fontSize: 10, color: '#AEAEB2' }}>{count}</span>
      )}
    </button>
  )
}

function CategoryRow({ cat, counts, expanded, onToggle, onExpandToggle,
                        catEnabled, tagToggles, onTagToggle }) {
  const count = counts[cat.id] || 0
  const tags  = cat.tags

  return (
    <div>
      {/* ── Category header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={onToggle}
          style={{
            flex:          1,
            display:      'flex',
            alignItems:   'center',
            gap:           8,
            padding:      '9px 13px',
            borderRadius:  10,
            background:    catEnabled ? `${cat.color}22` : '#F5F5F7',
            border:       `1px solid ${catEnabled ? cat.color : 'rgba(0,0,0,0.08)'}`,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   'all 0.15s ease',
            textAlign:    'left',
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{cat.icon}</span>
          <span style={{
            fontSize:   13,
            fontWeight: 500,
            color:      catEnabled ? '#1D1D1F' : '#6E6E73',
            flex:       1,
            lineHeight: 1.3,
          }}>
            {cat.label}
          </span>
          {count > 0 && (
            <span style={{
              fontSize:   11,
              color:      catEnabled ? cat.color : '#AEAEB2',
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {count}
            </span>
          )}
        </button>

        {/* Expand chevron — only if there are tags to show */}
        {tags.length > 0 && (
          <button
            onClick={onExpandToggle}
            style={{
              padding:      '9px 11px',
              borderRadius:  10,
              background:    expanded ? '#E8F4EC' : '#F5F5F7',
              border:       `1px solid ${expanded ? '#2D6A4F' : 'rgba(0,0,0,0.08)'}`,
              cursor:       'pointer',
              fontSize:      11,
              color:         expanded ? '#2D6A4F' : '#6E6E73',
              fontFamily:   'inherit',
              lineHeight:    1,
              transition:   'all 0.15s ease',
            }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* ── Individual tag chips ── */}
      {expanded && tags.length > 0 && (
        <div style={{
          display:    'flex',
          flexWrap:   'wrap',
          gap:         5,
          marginTop:   6,
          paddingLeft: 10,
        }}>
          {tags.map(tag => {
            const subKey = cat.id === 'others'
              ? `${tag.key}__${tag.value}`
              : `${cat.id}__${tag.key}__${tag.value}`
            const tagEnabled = tagToggles[subKey] !== false
            const tagCount   = counts[
              cat.id === 'others'
                ? `others__${tag.key}__${tag.value}`
                : `${cat.id}__${tag.key}__${tag.value}`
            ] || 0

            return (
              <TagChip
                key={`${tag.key}=${tag.value}`}
                label={tag.label}
                count={tagCount}
                enabled={tagEnabled}
                parentEnabled={catEnabled}
                onClick={() => onTagToggle(tag.key, tag.value)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────

export default function GreeneryPanel({ noTitle = false }) {
  const {
    greeneryGeoJSON, greeneryDataLoading, greeneryDataError,
    greeneryCategoryToggles,
    greeneryTagToggles,
    greeneryOthersTagToggles,
    showGreeneryDistrictBorders,
    toggleGreeneryCategory,
    toggleGreeneryTag,
    toggleGreeneryOthersTag,
    toggleGreeneryDistrictBorders,
  } = useAppStore()

  const [expanded, setExpanded] = useState(new Set())

  const counts = useMemo(() => countFeatures(greeneryGeoJSON), [greeneryGeoJSON])

  // Derive Others tags dynamically from the GeoJSON data
  const othersTags = useMemo(() => {
    if (!greeneryGeoJSON) return []
    const seen = new Map()
    for (const f of greeneryGeoJSON.features) {
      if (f.properties._categoryId !== 'others') continue
      const k = `${f.properties._tagKey}__${f.properties._tagValue}`
      if (!seen.has(k)) {
        seen.set(k, {
          key:   f.properties._tagKey,
          value: f.properties._tagValue,
          label: f.properties._tagLabel,
        })
      }
    }
    return Array.from(seen.values())
  }, [greeneryGeoJSON])

  const toggleExpand = (catId) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  const totalFeatures = greeneryGeoJSON?.features.length ?? 0

  return (
    <div>
      {!noTitle && <p className="panel-label">Greenery</p>}

      {/* ── Loading state ── */}
      {greeneryDataLoading && (
        <p style={{ fontSize: 13, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
          Loading greenery data from OpenStreetMap…
        </p>
      )}

      {/* ── Error state ── */}
      {!greeneryDataLoading && greeneryDataError && (
        <div style={{
          background:   '#FFF3F3',
          border:       '1px solid #FFCDD2',
          borderRadius:  10,
          padding:      '10px 14px',
          fontSize:      13,
          color:         '#C62828',
        }}>
          Failed to load greenery data. Check your connection and reload the page.
        </div>
      )}

      {/* ── Empty / not yet loaded ── */}
      {!greeneryDataLoading && !greeneryDataError && !greeneryGeoJSON && (
        <p style={{ fontSize: 13, color: '#AEAEB2' }}>
          Greenery data is loading…
        </p>
      )}

      {/* ── District borders toggle ── */}
      <button
        onClick={toggleGreeneryDistrictBorders}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:             8,
          width:          '100%',
          padding:        '9px 13px',
          borderRadius:    10,
          background:      showGreeneryDistrictBorders ? 'rgba(29,29,31,0.07)' : '#F5F5F7',
          border:         `1px solid ${showGreeneryDistrictBorders ? 'rgba(29,29,31,0.30)' : 'rgba(0,0,0,0.08)'}`,
          cursor:         'pointer',
          fontFamily:     'inherit',
          textAlign:      'left',
          marginBottom:    10,
          transition:     'all 0.15s ease',
        }}
      >
        <span style={{ fontSize: 14, letterSpacing: 1, color: showGreeneryDistrictBorders ? '#1D1D1F' : '#6E6E73' }}>
          ⬡
        </span>
        <span style={{
          fontSize:   13,
          fontWeight: 500,
          flex:       1,
          color:      showGreeneryDistrictBorders ? '#1D1D1F' : '#6E6E73',
        }}>
          District Borders
        </span>
        <span style={{
          fontSize:     10,
          fontWeight:   600,
          color:        showGreeneryDistrictBorders ? '#1D1D1F' : '#AEAEB2',
          letterSpacing: '0.05em',
        }}>
          {showGreeneryDistrictBorders ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* ── Category list ── */}
      {greeneryGeoJSON && !greeneryDataLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {GREENERY_CATEGORIES.map(cat => {
            const isOthers   = cat.id === 'others'
            const catTags    = isOthers ? othersTags : cat.tags
            const catEnabled = greeneryCategoryToggles[cat.id] !== false

            const tagTogglesForCat = isOthers
              ? greeneryOthersTagToggles
              : Object.fromEntries(
                  cat.tags.map(t => [
                    `${cat.id}__${t.key}__${t.value}`,
                    greeneryTagToggles[`${cat.id}__${t.key}__${t.value}`],
                  ])
                )

            return (
              <CategoryRow
                key={cat.id}
                cat={{ ...cat, tags: catTags }}
                counts={counts}
                expanded={expanded.has(cat.id)}
                catEnabled={catEnabled}
                tagToggles={tagTogglesForCat}
                onToggle={() => toggleGreeneryCategory(cat.id)}
                onExpandToggle={() => toggleExpand(cat.id)}
                onTagToggle={(key, value) =>
                  isOthers
                    ? toggleGreeneryOthersTag(key, value)
                    : toggleGreeneryTag(cat.id, key, value)
                }
              />
            )
          })}

          {/* ── Summary + attribution ── */}
          <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 6, letterSpacing: '-0.01em' }}>
            {totalFeatures} features · Toggle categories or individual tags to control map visibility
          </p>
          <p style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>
            © <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#AEAEB2', textDecoration: 'underline' }}
            >OpenStreetMap contributors</a> · ODbL
          </p>
        </div>
      )}
    </div>
  )
}
