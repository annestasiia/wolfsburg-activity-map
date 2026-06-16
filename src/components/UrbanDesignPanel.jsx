import React, { useState } from 'react'
import { FONT, SERIF, C, TERRA, CATS, CAT_COLOR, ELEMENTS, HubIcon } from '../data/hubElements.jsx'
import HubScene from './hub/HubScene.jsx'

// ── Element Circle ──────────────────────────────────────────────────────────
function ElementCircle({ el }) {
  const [hovered, setHovered] = useState(false)
  const color = CAT_COLOR[el.cat] || '#888'
  const isOptional = el.type === 'optional'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color + '18',
        border: isOptional
          ? `2.5px dashed ${color}`
          : `2.5px solid ${color}`,
        cursor: 'default',
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
        boxShadow: 'none',
        color,
      }}>
        <HubIcon id={el.id} color={color} />
      </div>

      <div style={{ fontFamily: FONT, fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.35, maxWidth: 80, letterSpacing: '-0.01em' }}>
        {el.name}
      </div>

      {hovered && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: C.text1, color: 'white', borderRadius: 8, padding: '8px 12px',
          fontSize: 13, fontFamily: FONT, lineHeight: 1.5, width: 200, zIndex: 100,
          boxShadow: 'none', pointerEvents: 'none',
          textAlign: 'left',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: color }}>{el.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.85)' }}>{el.def}</div>
        </div>
      )}
    </div>
  )
}

// ── Design Elements Section ─────────────────────────────────────────────────
function DesignElementsSection() {
  const coreEls    = ELEMENTS.filter(e => e.type === 'core')
  const optionalEls = ELEMENTS.filter(e => e.type === 'optional')

  const coreByCat = CATS.map(cat => ({
    ...cat,
    items: coreEls.filter(e => e.cat === cat.id),
  })).filter(c => c.items.length > 0)

  return (
    <div>
      <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text2, lineHeight: 1.75, margin: '0 0 40px', maxWidth: 560 }}>
        68 hubs form a recognizable design family across Wolfsburg. Each hub is built from
        the same modular element types, assembled differently per site. A reddish stone ground
        field marks the hub territory; a canopy or structural element is readable from 50 metres.
        Directional lines in the stone guide users without signage. Mobility is the anchor —
        social and cultural life is the ambition.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 32 }}>
        {CATS.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: cat.color + '14', border: `1px solid ${cat.color}35` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
            <span style={{ fontFamily: FONT, fontSize: 13, color: cat.color, fontWeight: 600, letterSpacing: '-0.01em' }}>{cat.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #888' }} />
            <span style={{ fontFamily: FONT, fontSize: 13, color: C.text3 }}>Core</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px dashed #888' }} />
            <span style={{ fontFamily: FONT, fontSize: 13, color: C.text3 }}>Optional</span>
          </div>
        </div>
      </div>

      {coreByCat.map(cat => (
        <div key={cat.id} style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: cat.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{cat.label}</span>
            <div style={{ flex: 1, height: 1, background: cat.color + '25' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '20px 12px' }}>
            {cat.items.map(el => <ElementCircle key={el.id} el={el} />)}
          </div>
        </div>
      ))}

      <div style={{ height: 1, background: C.border, margin: '8px 0 36px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Context-specific optional elements</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '20px 12px' }}>
        {optionalEls.map(el => <ElementCircle key={el.id} el={el} />)}
      </div>
    </div>
  )
}

// ── Tier dimensions (for the dimensions card) ───────────────────────────────
const TIER_DIMS = {
  s: { label: 'S-Hub', width: '10–15 m', length: '15–20 m', context: 'Residential / secondary street' },
  m: { label: 'M-Hub', width: '18–25 m', length: '25–35 m', context: 'Main neighbourhood street' },
  l: { label: 'L-Hub', width: '30–50 m', length: '40–60 m', context: 'Major street / square / campus edge' },
}

// ── Tier Table ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Mandatory': TERRA + '28',
  'Standard':  '#2471A3' + '20',
  'Optional':  '#1E8449' + '18',
  '—':         '#FFFFFF',
}
const STATUS_TEXT = {
  'Mandatory': TERRA,
  'Standard':  '#2471A3',
  'Optional':  '#1E8449',
  '—':         C.text3,
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function TierTable() {
  const [rows, setRows] = useState(ELEMENTS.map(e => ({ id: e.id, name: e.name, cat: e.cat, s: e.s, m: e.m, l: e.l })))
  const [editing, setEditing] = useState(null) // { rowId, col }
  const [editVal, setEditVal] = useState('')

  const startEdit = (rowId, col, val) => { setEditing({ rowId, col }); setEditVal(val) }
  const commitEdit = () => {
    if (!editing) return
    setRows(rows.map(r => r.id === editing.rowId ? { ...r, [editing.col]: editVal } : r))
    setEditing(null)
  }

  const genMarkdown = () => {
    const header = '# Hub Typology — Element Assignments\n\n| Element | Category | S-Hub | M-Hub | L-Hub |\n|---------|----------|-------|-------|-------|\n'
    return header + rows.map(r => `| ${r.name} | ${r.cat} | ${r.s} | ${r.m} | ${r.l} |`).join('\n')
  }

  const btnStyle = { fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.card, color: C.text2, letterSpacing: '0.04em' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: FONT, fontSize: 13, color: C.text3 }}>Click any cell to edit · Changes are local to this session</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle} onClick={() => downloadFile(genMarkdown(), 'hub-typologies.md')}>Download .md</button>
          <button style={btnStyle} onClick={() => downloadFile(rows.map(r => `${r.name} | S: ${r.s} | M: ${r.m} | L: ${r.l}`).join('\n'), 'hub-typologies.txt')}>Download .txt</button>
        </div>
      </div>

      <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
          <thead>
            <tr style={{ background: '#FFFFFF' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: '46%' }}>Element</th>
              {['S-Hub', 'M-Hub', 'L-Hub'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isNewCat = i === 0 || rows[i-1].cat !== row.cat
              const catColor = CAT_COLOR[row.cat] || '#888'
              return (
                <React.Fragment key={row.id}>
                  {isNewCat && (
                    <tr>
                      <td colSpan={4} style={{ padding: '10px 14px 4px', background: '#FFFFFF', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: catColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {CATS.find(c => c.id === row.cat)?.label}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: `1px solid ${C.border}`, background: '#FFFFFF' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: C.text1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: catColor + '14', border: `1.5px solid ${catColor}55`,
                        }}>
                          <HubIcon id={row.id} color={catColor} size={17} />
                        </span>
                        {row.name}
                      </div>
                    </td>
                    {['s','m','l'].map(col => {
                      const isEd = editing?.rowId === row.id && editing?.col === col
                      const val = row[col]
                      return (
                        <td key={col} style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {isEd ? (
                            <input
                              autoFocus
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
                              style={{ width: '100%', textAlign: 'center', fontFamily: FONT, fontSize: 13, padding: '4px 6px', borderRadius: 6, border: `1px solid ${TERRA}`, outline: 'none', background: TERRA + '10' }}
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(row.id, col, val)}
                              style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                background: STATUS_COLORS[val] || '#FFFFFF',
                                color: STATUS_TEXT[val] || C.text3,
                              }}
                            >{val}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Hub Typologies Section ──────────────────────────────────────────────────
function HubTypologiesSection() {
  const [activeTier, setActiveTier] = useState('s')

  const tierBtnStyle = (t) => ({
    fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: '7px 20px', borderRadius: 4, letterSpacing: '0.04em',
    cursor: 'pointer', border: `1px solid ${activeTier === t ? TERRA : C.border}`,
    background: activeTier === t ? TERRA : C.card,
    color: activeTier === t ? 'white' : C.text2,
  })

  const d = TIER_DIMS[activeTier]

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {['s','m','l'].map(t => (
          <button key={t} style={tierBtnStyle(t)} onClick={() => setActiveTier(t)}>
            {TIER_DIMS[t].label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 28 }}>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: TERRA, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          {d.label} — Ground Field Dimensions
        </div>
        <div style={{ display: 'flex', gap: 32, fontFamily: FONT }}>
          <div><span style={{ fontSize: 22, fontWeight: 700, color: C.text1 }}>{d.width}</span><span style={{ fontSize: 13, color: C.text3, marginLeft: 4 }}>wide (across street)</span></div>
          <div><span style={{ fontSize: 22, fontWeight: 700, color: C.text1 }}>{d.length}</span><span style={{ fontSize: 13, color: C.text3, marginLeft: 4 }}>long (along street)</span></div>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: C.text3, marginTop: 8 }}>{d.context}</div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: C.text2, marginTop: 6, fontStyle: 'italic' }}>
          Includes road surface — the stone field spans the full carriageway. Dimensions are context-responsive working ranges.
        </div>
      </div>

      {/* Interactive plan + axonometric scene */}
      <HubScene tier={activeTier} />

      <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.text3, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '44px 0 16px' }}>Element Assignments by Tier</div>
      <TierTable />
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────
export default function UrbanDesignPanel() {
  const [tab, setTab] = useState('elements')
  const [progress, setProgress] = useState(0)
  const scrollRef = React.useRef(null)

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setProgress(scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const tabStyle = (t) => ({
    fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 4, letterSpacing: '0.04em',
    cursor: 'pointer', border: 'none', background: tab === t ? TERRA + '18' : 'transparent',
    color: tab === t ? TERRA : C.text3,
  })

  // Typologies tab gets a wider band so plan + axonometric sit side by side legibly
  const contentMax = tab === 'typologies' ? 1180 : 800

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'var(--nav-w)', right: 0, zIndex: 10, background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: C.border, flexShrink: 0 }}>
        <div style={{ height: '100%', background: TERRA, width: `${progress * 100}%`, transition: 'width 80ms linear' }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: contentMax, margin: '0 auto', padding: '56px 48px 120px' }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: TERRA, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
              Urban Design · Wolfsburg 2026
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 400, color: C.text1, lineHeight: 1.08, letterSpacing: '-0.5px', margin: '0 0 20px' }}>
              Hub Design System
            </h1>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text2, lineHeight: 1.75, margin: 0, maxWidth: 520 }}>
              A modular toolkit for designing 68 mobility hubs across Wolfsburg — from minimal
              last-mile stops to neighbourhood anchors with full community programme.
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 40, padding: 4, background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 10, width: 'fit-content' }}>
            <button style={tabStyle('elements')} onClick={() => setTab('elements')}>Design Elements</button>
            <button style={tabStyle('typologies')} onClick={() => setTab('typologies')}>Hub Typologies</button>
          </div>

          {tab === 'elements'   && <DesignElementsSection />}
          {tab === 'typologies' && <HubTypologiesSection />}
        </div>
      </div>
    </div>
  )
}
