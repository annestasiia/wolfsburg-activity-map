import React, { useState, useRef } from 'react'
import { HUB_LAYOUTS, CONNECTIVITY } from '../../data/hubLayouts.js'
import { ELEMENT_BY_ID, CAT_COLOR, FONT, C, TERRA, HubIcon } from '../../data/hubElements.jsx'

// ── colour helpers ───────────────────────────────────────────────────────────
function hexToRgb(h) { h = h.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)] }
function rgbToHex(r,g,b) { const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0'); return '#'+c(r)+c(g)+c(b) }
function lighten(hex, f) {
  const [r,g,b] = hexToRgb(hex)
  if (f >= 0) return rgbToHex(r+(255-r)*f, g+(255-g)*f, b+(255-b)*f)
  const k = 1 + f; return rgbToHex(r*k, g*k, b*k)
}

const STONE = '#C97B4A'        // reddish stone field tone
const STONE_BG = '#EDD9C9'
const ROAD = '#D7D5D1'
const FORE = 0.58              // axon vertical foreshorten
const ZS = 0.92                // axon height scale

const colorOf = (ref) => CAT_COLOR[ELEMENT_BY_ID[ref]?.cat] || '#888'
const TIER_KEY = { s: 's', m: 'm', l: 'l' }

// ════════════════════════════════════════════════════════════════════════════
//  PLAN VIEW — top-down architectural drawing
// ════════════════════════════════════════════════════════════════════════════
function PlanView({ layout, hoveredRef, selectedRef, onHover, onSelect, svgRef }) {
  const { field, zones, elements } = layout
  const PAD = { l: 50, r: 20, t: 24, b: 44 }
  const innerW = 430
  const s = innerW / field.length
  const innerH = field.width * s
  const W = innerW + PAD.l + PAD.r
  const H = innerH + PAD.t + PAD.b
  const PX = x => PAD.l + x * s
  const PY = y => PAD.t + y * s

  // directional wayfinding lines: from a wayfinding origin to mobility elements
  const origin = elements.find(e => e.ref === 'hub-marker') || elements.find(e => e.ref === 'info-terminal')
  const mobility = elements.filter(e => ELEMENT_BY_ID[e.ref]?.cat === 'mobility')

  const glyph = (el) => {
    const color = colorOf(el.ref)
    const active = hoveredRef === el.ref || selectedRef === el.ref
    const dim = (hoveredRef || selectedRef) && !active
    const x0 = PX(el.x - el.w/2), y0 = PY(el.y - el.d/2)
    const ww = el.w * s, hh = el.d * s
    const cx = PX(el.x), cy = PY(el.y)
    const k = el.kind
    const fill = k === 'pad' || k === 'building' ? color + '22' : color + '33'
    const inner = []

    if (k === 'tree') {
      inner.push(<circle key="c" cx={cx} cy={cy} r={Math.max(ww,hh)/2} fill={color+'2e'} stroke={color} strokeWidth={1.2} />)
      inner.push(<circle key="t" cx={cx} cy={cy} r={2.2} fill={color} />)
    } else if (k === 'pad') {
      inner.push(<rect key="r" x={x0} y={y0} width={ww} height={hh} fill={color+'20'} stroke={color} strokeWidth={1.1} strokeDasharray="4 3" rx={2} />)
      for (let i = 1; i <= 3; i++) {
        const xx = x0 + (ww*i/4)
        inner.push(<line key={'h'+i} x1={xx} y1={y0+3} x2={xx} y2={y0+hh-3} stroke={color} strokeWidth={0.6} opacity={0.5} />)
      }
    } else if (k === 'rack') {
      inner.push(<rect key="r" x={x0} y={y0} width={ww} height={hh} fill={color+'1e'} stroke={color} strokeWidth={1} rx={2} />)
      const n = 5
      for (let i = 0; i < n; i++) {
        const xx = x0 + (ww*(i+0.5)/n)
        inner.push(<line key={'b'+i} x1={xx} y1={y0+2} x2={xx} y2={y0+hh-2} stroke={color} strokeWidth={1} />)
      }
    } else if (k === 'canopy') {
      inner.push(<rect key="r" x={x0} y={y0} width={ww} height={hh} fill={color+'18'} stroke={color} strokeWidth={1.3} strokeDasharray="6 4" rx={4} />)
      inner.push(<line key="d1" x1={x0} y1={y0} x2={x0+ww} y2={y0+hh} stroke={color} strokeWidth={0.6} opacity={0.4} />)
      inner.push(<line key="d2" x1={x0+ww} y1={y0} x2={x0} y2={y0+hh} stroke={color} strokeWidth={0.6} opacity={0.4} />)
    } else {
      inner.push(<rect key="r" x={x0} y={y0} width={ww} height={hh} fill={fill} stroke={color} strokeWidth={1.1} rx={2} />)
    }

    return (
      <g key={el.uid}
        onMouseEnter={() => onHover(el.ref)} onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(el.ref)}
        style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity 0.15s',
          filter: active ? `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 6px ${color}90)` : 'none' }}
      >
        {inner}
        {/* hit area */}
        <rect x={x0-3} y={y0-3} width={ww+6} height={hh+6} fill="transparent" />
      </g>
    )
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
      {/* zones */}
      {zones.map(z => {
        const y = PY(z.y0), h = (z.y1 - z.y0) * s
        const fillc = z.road ? ROAD : z.building ? '#DAD4CB' : STONE_BG
        const op = z.road ? 1 : z.building ? 1 : 0.45 + (z.key.includes('1') ? 0.12 : z.key.includes('3') ? 0.12 : 0)
        return <rect key={z.key} x={PX(0)} y={y} width={innerW} height={h} fill={fillc} opacity={op} />
      })}
      {/* stone field outline */}
      <rect x={PX(0)} y={PY(0)} width={innerW} height={innerH} fill="none" stroke={STONE} strokeWidth={1.6} />
      {/* carriageway centreline */}
      {zones.filter(z => z.road).map(z => {
        const yc = PY((z.y0+z.y1)/2)
        return <line key="cl" x1={PX(0)} y1={yc} x2={PX(field.length)} y2={yc} stroke="#fff" strokeWidth={1.4} strokeDasharray="10 8" />
      })}
      {/* zone divider lines + labels */}
      {zones.map((z, i) => (
        <g key={'zl'+z.key}>
          {i > 0 && <line x1={PX(0)} y1={PY(z.y0)} x2={PX(field.length)} y2={PY(z.y0)} stroke={z.road ? '#B9B6B1' : STONE} strokeWidth={0.7} strokeDasharray={z.road ? 'none' : '3 3'} opacity={0.7} />}
          <text x={PAD.l - 6} y={PY((z.y0+z.y1)/2)} textAnchor="end" dominantBaseline="middle" fontSize={7.5} fontFamily={FONT} fill={z.road ? '#9a9a9a' : TERRA} transform={`rotate(-90 ${PAD.l-6} ${PY((z.y0+z.y1)/2)})`}>{z.label}</text>
        </g>
      ))}
      {/* directional lines */}
      {origin && mobility.map(m => (
        <line key={'dir'+m.uid} x1={PX(origin.x)} y1={PY(origin.y)} x2={PX(m.x)} y2={PY(m.y)} stroke={STONE} strokeWidth={0.7} strokeDasharray="2 3" opacity={0.5} />
      ))}
      {/* elements */}
      {elements.map(glyph)}

      {/* dimension — width (left) */}
      <g stroke={C.text3} strokeWidth={0.7} fontFamily={FONT}>
        <line x1={PAD.l-30} y1={PY(0)} x2={PAD.l-30} y2={PY(field.width)} />
        <line x1={PAD.l-33} y1={PY(0)} x2={PAD.l-27} y2={PY(0)} />
        <line x1={PAD.l-33} y1={PY(field.width)} x2={PAD.l-27} y2={PY(field.width)} />
      </g>
      {/* dimension — length (bottom) */}
      <g stroke={C.text3} strokeWidth={0.7} fontFamily={FONT}>
        <line x1={PX(0)} y1={H-16} x2={PX(field.length)} y2={H-16} />
        <line x1={PX(0)} y1={H-19} x2={PX(0)} y2={H-13} />
        <line x1={PX(field.length)} y1={H-19} x2={PX(field.length)} y2={H-13} />
      </g>
      <rect x={PX(field.length/2)-30} y={H-26} width={60} height={13} fill="#fff" />
      <text x={PX(field.length/2)} y={H-16} textAnchor="middle" fontSize={9} fontFamily={FONT} fill={C.text2} fontWeight={600}>{field.length} m</text>

      {/* north arrow */}
      <g transform={`translate(${W-26} ${PAD.t+12})`}>
        <line x1={0} y1={9} x2={0} y2={-9} stroke={C.text2} strokeWidth={1} />
        <path d="M0,-11 L3,-4 L0,-6 L-3,-4 Z" fill={C.text2} />
        <text x={0} y={20} textAnchor="middle" fontSize={8} fontFamily={FONT} fill={C.text3}>N</text>
      </g>
      {/* scale bar (5 m) */}
      <g transform={`translate(${W-PAD.r-5*s} ${H-30})`}>
        <rect x={0} y={0} width={5*s} height={4} fill="none" stroke={C.text2} strokeWidth={0.7} />
        <rect x={0} y={0} width={2.5*s} height={4} fill={C.text2} />
        <text x={5*s} y={-3} textAnchor="end" fontSize={8} fontFamily={FONT} fill={C.text3}>5 m</text>
      </g>
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  AXONOMETRIC VIEW — rotatable military projection
// ════════════════════════════════════════════════════════════════════════════
function AxonView({ layout, azimuth, hoveredRef, selectedRef, onHover, onSelect, svgRef }) {
  const { field, zones, elements } = layout
  const VW = 540, VH = 400, M = 26
  const θ = azimuth * Math.PI / 180
  const cosT = Math.cos(θ), sinT = Math.sin(θ)
  const cx = field.length / 2, cy = field.width / 2
  const rot = (x, y) => ({ rx: (x-cx)*cosT - (y-cy)*sinT, ry: (x-cx)*sinT + (y-cy)*cosT })
  const rotDir = (nx, ny) => ({ x: nx*cosT - ny*sinT, y: nx*sinT + ny*cosT })

  // fit pass — project field bbox + max height, derive scale & offset
  const maxH = Math.max(...elements.map(e => e.h), 4)
  const probe = []
  ;[[0,0],[field.length,0],[field.length,field.width],[0,field.width]].forEach(([x,y]) => {
    const r = rot(x,y)
    probe.push([r.rx, r.ry*FORE])
    probe.push([r.rx, r.ry*FORE - maxH*ZS])
  })
  const xs = probe.map(p=>p[0]), ys = probe.map(p=>p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const S = Math.min((VW-2*M)/(maxX-minX), (VH-2*M)/(maxY-minY))
  const ox = M - minX*S + ((VW-2*M)-(maxX-minX)*S)/2
  const oy = M - minY*S + ((VH-2*M)-(maxY-minY)*S)/2
  const scr = (rx, ry, z) => [ox + rx*S, oy + ry*FORE*S - z*ZS*S]
  const proj = (x, y, z) => { const r = rot(x,y); return scr(r.rx, r.ry, z) }
  const ctx = { rot, rotDir, scr, proj, S, color: '#888' }

  // ── extruded box → array of polygons (sorted faces + top) ──
  const extrudeBox = (bx, by, w, d, zB, zT, base, key, topAmt = 0.32) => {
    const fp = [[bx-w/2,by-d/2],[bx+w/2,by-d/2],[bx+w/2,by+d/2],[bx-w/2,by+d/2]]
    const r = fp.map(([x,y]) => rot(x,y))
    const bot = r.map(rr => scr(rr.rx, rr.ry, zB))
    const top = r.map(rr => scr(rr.rx, rr.ry, zT))
    const normals = [[0,-1],[1,0],[0,1],[-1,0]]
    const stroke = lighten(base, -0.28)
    const sides = []
    for (let i = 0; i < 4; i++) {
      const j = (i+1)%4
      const nr = rotDir(normals[i][0], normals[i][1])
      const amt = -0.05 + 0.18*nr.x - 0.10*nr.y
      sides.push({ depth: (r[i].ry+r[j].ry)/2, pts: [bot[i],bot[j],top[j],top[i]], fill: lighten(base, amt) })
    }
    sides.sort((a,b) => a.depth - b.depth)
    const nodes = sides.map((sd, i) => (
      <polygon key={key+'s'+i} points={sd.pts.map(p=>p.join(',')).join(' ')} fill={sd.fill} stroke={stroke} strokeWidth={0.5} strokeLinejoin="round" />
    ))
    nodes.push(<polygon key={key+'top'} points={top.map(p=>p.join(',')).join(' ')} fill={lighten(base, topAmt)} stroke={stroke} strokeWidth={0.5} strokeLinejoin="round" />)
    return nodes
  }

  const massNodes = (el) => {
    const base = colorOf(el.ref)
    const { x, y, w, d, h, kind, uid } = el
    if (kind === 'pad') {
      const pts = [[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]].map(([px,py]) => proj(px,py,0.04))
      return [<polygon key={uid+'p'} points={pts.map(p=>p.join(',')).join(' ')} fill={base+'30'} stroke={base} strokeWidth={1} strokeDasharray="5 3" strokeLinejoin="round" />]
    }
    if (kind === 'tree') {
      const trunk = extrudeBox(x, y, 0.4, 0.4, 0, h*0.42, '#8B6B4A', uid+'tr')
      const c = proj(x, y, h*0.92), R = (w/2)*S*1.05
      const canopy = [
        <ellipse key={uid+'ca'} cx={c[0]} cy={c[1]} rx={R} ry={R*0.92} fill={lighten(base,0.04)} stroke={lighten(base,-0.22)} strokeWidth={0.6} />,
        <ellipse key={uid+'ch'} cx={c[0]-R*0.28} cy={c[1]-R*0.3} rx={R*0.5} ry={R*0.45} fill={lighten(base,0.24)} opacity={0.8} />,
      ]
      return [...trunk, ...canopy]
    }
    if (kind === 'canopy') {
      const nodes = []
      const inx = w/2 - 0.3, iny = d/2 - 0.3
      ;[[-inx,-iny],[inx,-iny],[inx,iny],[-inx,iny]].forEach((p,i) =>
        nodes.push(...extrudeBox(x+p[0], y+p[1], 0.22, 0.22, 0, h-0.22, lighten(base,-0.1), uid+'pt'+i)))
      nodes.push(...extrudeBox(x, y, w, d, h-0.22, h, base, uid+'rf', 0.38))
      return nodes
    }
    if (kind === 'shed') {
      const nodes = []
      nodes.push(...extrudeBox(x, y - d/2 + 0.1, w, 0.18, 0, h-0.2, lighten(base,-0.06), uid+'bw'))
      ;[[-(w/2-0.2),(d/2-0.15)],[(w/2-0.2),(d/2-0.15)]].forEach((p,i) =>
        nodes.push(...extrudeBox(x+p[0], y+p[1], 0.16, 0.16, 0, h-0.2, lighten(base,-0.1), uid+'sp'+i)))
      nodes.push(...extrudeBox(x, y, w, d, h-0.2, h, base, uid+'sr', 0.36))
      return nodes
    }
    if (kind === 'rack') {
      const nodes = extrudeBox(x, y, w, d, 0, 0.06, lighten(base,-0.12), uid+'bs')
      const n = 5
      for (let i = 0; i < n; i++) {
        const bx = x - w/2 + w*(i+0.5)/n
        nodes.push(...extrudeBox(bx, y, 0.12, d*0.7, 0, h, base, uid+'bar'+i))
      }
      return nodes
    }
    if (kind === 'terminal') {
      const nodes = extrudeBox(x, y, w, d, 0, h, base, uid+'bd')
      nodes.push(...extrudeBox(x, y, w*0.85, d*0.85, h-0.2, h, lighten(base,0.28), uid+'sc'))
      return nodes
    }
    if (kind === 'building') {
      const nodes = []
      nodes.push(...extrudeBox(x, y, w, d, 0, 1.4, '#B9B2A8', uid+'pl'))
      nodes.push(...extrudeBox(x, y, w, d, 1.4, h, '#CFC9C0', uid+'bm', 0.16))
      nodes.push(...extrudeBox(x, y, w, d, h, h+0.4, '#E2DDD5', uid+'pa', 0.2))
      return nodes
    }
    if (kind === 'greenwall') {
      const nodes = extrudeBox(x, y, w, d, 0, h, '#2E7D4F', uid+'gw')
      ;[0.2,0.45,0.7].forEach((t,i) => {
        const p = proj(x - w/2 + t*w, y - d/2, h*(0.35+0.18*i))
        nodes.push(<circle key={uid+'lf'+i} cx={p[0]} cy={p[1]} r={S*0.5} fill={lighten('#2E7D4F',0.18)} opacity={0.85} />)
      })
      return nodes
    }
    if (kind === 'marker') {
      const nodes = extrudeBox(x, y, w, d, 0, h, base, uid+'po')
      nodes.push(...extrudeBox(x, y, w+0.6, 0.16, h-0.9, h-0.2, lighten(base,0.1), uid+'sg'))
      return nodes
    }
    if (kind === 'box') {
      const nodes = extrudeBox(x, y, w, d, 0, h, base, uid+'bx')
      nodes.push(...extrudeBox(x, y, w, d, h, h+0.25, lighten(base,0.2), uid+'rf'))
      return nodes
    }
    // post, board, default
    return extrudeBox(x, y, w, d, 0, h, base, uid+'b')
  }

  // ground stone field polygon
  const fieldPoly = [[0,0],[field.length,0],[field.length,field.width],[0,field.width]].map(([x,y]) => proj(x,y,0))
  // zone bands on ground
  const zoneBands = zones.map(z => {
    const pts = [[0,z.y0],[field.length,z.y0],[field.length,z.y1],[0,z.y1]].map(([x,y]) => proj(x,y,0))
    const fillc = z.road ? ROAD : z.building ? '#D6CFC4' : STONE_BG
    const op = z.road || z.building ? 0.95 : 0.5
    return <polygon key={'zb'+z.key} points={pts.map(p=>p.join(',')).join(' ')} fill={fillc} opacity={op} stroke={z.road ? 'none' : lighten(STONE,0.3)} strokeWidth={0.4} />
  })

  // sort elements back-to-front by rotated ry of centre
  const ordered = [...elements].map(e => ({ e, depth: rot(e.x, e.y).ry })).sort((a,b) => a.depth - b.depth)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'grab', touchAction: 'none' }}>
      <rect x={0} y={0} width={VW} height={VH} fill="#FBFAF8" />
      {/* ground */}
      <polygon points={fieldPoly.map(p=>p.join(',')).join(' ')} fill={STONE_BG} stroke={STONE} strokeWidth={1.4} strokeLinejoin="round" />
      {zoneBands}
      <polygon points={fieldPoly.map(p=>p.join(',')).join(' ')} fill="none" stroke={STONE} strokeWidth={1.4} strokeLinejoin="round" />
      {/* elements back-to-front */}
      {ordered.map(({ e }) => {
        const active = hoveredRef === e.ref || selectedRef === e.ref
        const dim = (hoveredRef || selectedRef) && !active
        const color = colorOf(e.ref)
        const sh = proj(e.x, e.y, 0)
        return (
          <g key={e.uid}
            onMouseEnter={() => onHover(e.ref)} onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(e.ref)}
            style={{ cursor: 'pointer', opacity: dim ? 0.38 : 1, transition: 'opacity 0.15s',
              filter: active ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 9px ${color}80)` : 'none' }}
          >
            {/* soft ground shadow */}
            <ellipse cx={sh[0]} cy={sh[1]} rx={Math.max(e.w,e.d)*S*0.55} ry={Math.max(e.w,e.d)*S*0.55*FORE} fill="#000" opacity={0.07} />
            {massNodes(e)}
          </g>
        )
      })}
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  CONNECTIVITY STRIP
// ════════════════════════════════════════════════════════════════════════════
function ConnDiagram({ id }) {
  // schematic plan, 120 × 70
  const stone = STONE, road = '#C9C7C3'
  if (id === 'cross') {
    return (
      <svg viewBox="0 0 120 70" style={{ width: '100%', height: 'auto' }}>
        <rect x="0" y="28" width="120" height="14" fill={road} />
        <rect x="40" y="6" width="40" height="58" fill={stone} opacity="0.55" />
        <rect x="40" y="6" width="40" height="58" fill="none" stroke={stone} strokeWidth="1.2" />
        {[46,54,62,70].map(x => <rect key={x} x={x} y="29" width="3" height="12" fill="#fff" opacity="0.8" />)}
      </svg>
    )
  }
  if (id === 'raised') {
    return (
      <svg viewBox="0 0 120 70" style={{ width: '100%', height: 'auto' }}>
        <rect x="0" y="30" width="120" height="10" fill={road} />
        <path d="M40 40 C40 18 80 18 80 40 Z" fill={stone} opacity="0.5" />
        <path d="M40 40 C40 18 80 18 80 40" fill="none" stroke={stone} strokeWidth="1.4" />
        <rect x="44" y="22" width="32" height="6" fill={stone} opacity="0.7" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 70" style={{ width: '100%', height: 'auto' }}>
      <rect x="0" y="30" width="120" height="12" fill={road} />
      <rect x="8" y="8" width="44" height="18" fill={stone} opacity="0.5" stroke={stone} strokeWidth="1" />
      <rect x="68" y="44" width="44" height="18" fill={stone} opacity="0.5" stroke={stone} strokeWidth="1" />
      <line x1="30" y1="26" x2="90" y2="44" stroke={stone} strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  )
}

function ConnectivityStrip() {
  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.text3, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>Street Connectivity Strategies</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {CONNECTIVITY.map(s => (
          <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ background: '#FBFAF8', borderRadius: 6, padding: '6px 6px 2px' }}><ConnDiagram id={s.id} /></div>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.text1, marginTop: 10 }}>{s.title}</div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.text3, lineHeight: 1.5, marginTop: 4 }}>{s.caption}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  EXPORT HELPERS
// ════════════════════════════════════════════════════════════════════════════
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function exportSVG(svgEl, filename) {
  if (!svgEl) return
  const xml = new XMLSerializer().serializeToString(svgEl)
  downloadBlob(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + xml], { type: 'image/svg+xml' }), filename)
}
function exportPNG(svgEl, filename, scale = 2) {
  if (!svgEl) return
  const xml = new XMLSerializer().serializeToString(svgEl)
  const vb = svgEl.viewBox.baseVal
  const w = (vb && vb.width) || svgEl.clientWidth || 800
  const h = (vb && vb.height) || svgEl.clientHeight || 600
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w*scale; canvas.height = h*scale
    const cx = canvas.getContext('2d')
    cx.fillStyle = '#fff'; cx.fillRect(0,0,canvas.width,canvas.height)
    cx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(b => b && downloadBlob(b, filename), 'image/png')
  }
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
}

// ════════════════════════════════════════════════════════════════════════════
//  DETAIL CARD + ELEMENT LIST
// ════════════════════════════════════════════════════════════════════════════
function zoneOf(layout, ref) {
  const el = layout.elements.find(e => e.ref === ref)
  if (!el) return null
  const z = layout.zones.find(z => el.y >= z.y0 && el.y < z.y1)
  return z ? z.label : null
}

function DetailCard({ layout, tier, ref_, onClose }) {
  const el = ELEMENT_BY_ID[ref_]
  if (!el) return (
    <div style={{ flex: 1, minWidth: 240, padding: '18px 20px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, color: C.text3, display: 'flex', alignItems: 'center' }}>
      Hover or click an element in the plan, the 3D view, or the list to see its details.
    </div>
  )
  const color = CAT_COLOR[el.cat]
  const role = el[TIER_KEY[tier]]
  const zone = zoneOf(layout, ref_)
  return (
    <div style={{ flex: 1, minWidth: 240, padding: '18px 20px', background: C.card, border: `1px solid ${color}40`, borderRadius: 10, position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: C.text3, lineHeight: 1 }}>✕</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color+'16', border: `2px solid ${color}` }}>
          <HubIcon id={el.id} color={color} size={22} />
        </span>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: C.text1, letterSpacing: '-0.01em' }}>{el.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            <span style={{ fontFamily: FONT, fontSize: 11, color: color, fontWeight: 600 }}>{el.cat.charAt(0).toUpperCase()+el.cat.slice(1)}</span>
          </div>
        </div>
      </div>
      <p style={{ fontFamily: FONT, fontSize: 13, color: C.text2, lineHeight: 1.6, margin: '0 0 14px' }}>{el.def}</p>
      <div style={{ display: 'flex', gap: 22, fontFamily: FONT }}>
        <div>
          <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Zone</div>
          <div style={{ fontSize: 13, color: C.text1, fontWeight: 600 }}>{zone || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Role in {tier.toUpperCase()}-Hub</div>
          <div style={{ fontSize: 13, color: role === 'Mandatory' ? TERRA : role === 'Standard' ? '#2471A3' : C.text2, fontWeight: 600 }}>{role}</div>
        </div>
      </div>
    </div>
  )
}

function ElementList({ layout, hoveredRef, selectedRef, onHover, onSelect }) {
  const refs = []
  layout.elements.forEach(e => { if (!refs.includes(e.ref)) refs.push(e.ref) })
  return (
    <div style={{ width: 250, flexShrink: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Elements in this hub</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {refs.map(ref => {
          const el = ELEMENT_BY_ID[ref]; if (!el) return null
          const color = CAT_COLOR[el.cat]
          const active = hoveredRef === ref || selectedRef === ref
          return (
            <div key={ref}
              onMouseEnter={() => onHover(ref)} onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(ref)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                background: active ? color+'16' : 'transparent', transition: 'background 0.12s' }}
            >
              <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color+'14', border: `1.5px solid ${active ? color : color+'55'}` }}>
                <HubIcon id={el.id} color={color} size={16} />
              </span>
              <span style={{ fontFamily: FONT, fontSize: 12.5, color: active ? C.text1 : C.text2, fontWeight: active ? 600 : 400, lineHeight: 1.2 }}>{el.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN SCENE
// ════════════════════════════════════════════════════════════════════════════
const DEFAULT_AZ = 28

export default function HubScene({ tier }) {
  const layout = HUB_LAYOUTS[tier] || HUB_LAYOUTS.s
  const [hoveredRef, setHoveredRef] = useState(null)
  const [selectedRef, setSelectedRef] = useState(null)
  const [azimuth, setAzimuth] = useState(DEFAULT_AZ)
  const planRef = useRef(null)
  const axonRef = useRef(null)
  const drag = useRef(null)

  const onSelect = (ref) => setSelectedRef(prev => prev === ref ? null : ref)

  // rotation drag
  const onDown = (e) => { drag.current = { x: e.clientX, az: azimuth }; e.currentTarget.style.cursor = 'grabbing' }
  const onMove = (e) => { if (!drag.current) return; setAzimuth(drag.current.az + (e.clientX - drag.current.x) * 0.5) }
  const onUp = (e) => { drag.current = null; if (e.currentTarget) e.currentTarget.style.cursor = 'grab' }

  const figCaption = { fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }
  const expBtn = { fontFamily: FONT, fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.card, color: C.text2 }
  const presetBtn = (label, az) => (
    <button onClick={() => setAzimuth(az)} style={{ ...expBtn, padding: '4px 9px', background: Math.round(((azimuth%360)+360)%360) === az ? TERRA+'18' : C.card, color: Math.round(((azimuth%360)+360)%360) === az ? TERRA : C.text2 }}>{label}</button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* PLAN */}
        <figure style={{ flex: '1 1 360px', minWidth: 320, margin: 0 }}>
          <div style={figCaption}>Plan · top-down</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <PlanView layout={layout} hoveredRef={hoveredRef} selectedRef={selectedRef} onHover={setHoveredRef} onSelect={onSelect} svgRef={planRef} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={expBtn} onClick={() => exportSVG(planRef.current, `hub-${tier}-plan.svg`)}>Export SVG</button>
            <button style={expBtn} onClick={() => exportPNG(planRef.current, `hub-${tier}-plan.png`)}>Export PNG</button>
          </div>
        </figure>

        {/* AXON */}
        <figure style={{ flex: '1 1 360px', minWidth: 320, margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={figCaption}>Axonometric · drag to rotate</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {presetBtn('NE', 28)}{presetBtn('SE', 118)}{presetBtn('SW', 208)}{presetBtn('NW', 298)}
              <button onClick={() => setAzimuth(DEFAULT_AZ)} style={{ ...expBtn, padding: '4px 9px' }}>Reset</button>
            </div>
          </div>
          <div
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          >
            <AxonView layout={layout} azimuth={azimuth} hoveredRef={hoveredRef} selectedRef={selectedRef} onHover={setHoveredRef} onSelect={onSelect} svgRef={axonRef} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={expBtn} onClick={() => exportSVG(axonRef.current, `hub-${tier}-axon.svg`)}>Export SVG</button>
            <button style={expBtn} onClick={() => exportPNG(axonRef.current, `hub-${tier}-axon.png`)}>Export PNG</button>
          </div>
        </figure>
      </div>

      {/* list + detail */}
      <div style={{ display: 'flex', gap: 24, marginTop: 28, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <ElementList layout={layout} hoveredRef={hoveredRef} selectedRef={selectedRef} onHover={setHoveredRef} onSelect={onSelect} />
        <DetailCard layout={layout} tier={tier} ref_={selectedRef} onClose={() => setSelectedRef(null)} />
      </div>

      <ConnectivityStrip />
    </div>
  )
}
