#!/usr/bin/env python3
"""
Patch 3:
  1. BottomBar: hide for strategy/capacity/urban/simulation sections
  2. DataPanel full design overhaul:
     - Pure white background
     - Monochrome greyscale palette for all charts
     - DotMatrix: compact (UNIT=50, COLS=55, small dots)
     - ReplacementChart: red → dark grey
     - MethodsOverlay: move outside overflow:hidden, remove broken animation
  3. Slide wrapper: cleaner header separator
"""

# ═══════════════════════════════════════════════════════
# PART A — BottomBar.jsx
# ═══════════════════════════════════════════════════════
BB_FILE = r'c:\Users\mmlll\Documents\Github\WWWWW\src\components\BottomBar.jsx'
with open(BB_FILE, 'r', encoding='utf-8') as f:
    bb = f.read()

OLD_BB = "  if (activeMode === 'greenery' || activeMode === 'intermodal' || activeMode === 'data') return null"
NEW_BB = (
  "  // Hide entirely for full-screen section panels\n"
  "  if (activeSection === 'strategy' || activeSection === 'capacity' ||\n"
  "      activeSection === 'urban'    || activeSection === 'simulation') return null\n"
  "  if (activeMode === 'greenery' || activeMode === 'intermodal' || activeMode === 'data') return null"
)
assert OLD_BB in bb, "BottomBar guard not found"
bb = bb.replace(OLD_BB, NEW_BB, 1)
with open(BB_FILE, 'w', encoding='utf-8', newline='') as f:
    f.write(bb)
print("BottomBar patched")

# ═══════════════════════════════════════════════════════
# PART B — DataPanel.jsx
# ═══════════════════════════════════════════════════════
DP_FILE = r'c:\Users\mmlll\Documents\Github\WWWWW\src\components\DataPanel.jsx'
with open(DP_FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# ── B1: Monochrome color constants ──────────────────────────────────
src = src.replace(
    "const MODAL = {\n"
    "  private_car:    { share: 0.62, label: 'Private car',    color: '#E63946' },\n"
    "  public_transit: { share: 0.10, label: 'Public transit', color: '#1D70B8' },\n"
    "  walking:        { share: 0.20, label: 'Walking',        color: '#2D6A4F' },\n"
    "  cycling:        { share: 0.08, label: 'Cycling',        color: '#FF8C42' },\n"
    "}",
    "const MODAL = {\n"
    "  private_car:    { share: 0.62, label: 'Private car',    color: '#111111' },\n"
    "  public_transit: { share: 0.10, label: 'Public transit', color: '#555555' },\n"
    "  walking:        { share: 0.20, label: 'Walking',        color: '#909090' },\n"
    "  cycling:        { share: 0.08, label: 'Cycling',        color: '#BBBBBB' },\n"
    "}",
    1
)

src = src.replace(
    "const MODE_META = {\n"
    "  e_bike:             { label: 'E-Bike',       color: '#27AE60' },\n"
    "  autonomous_shuttle: { label: 'Auto Shuttle', color: '#8E44AD' },\n"
    "  autonomous_bus:     { label: 'Auto Bus',     color: '#2C3E50' },\n"
    "  autonomous_pod:     { label: 'Auto Pod',     color: '#2980B9' },\n"
    "  car_sharing_ev:     { label: 'Car-Share EV', color: '#E67E22' },\n"
    "}",
    "const MODE_META = {\n"
    "  e_bike:             { label: 'E-Bike',       color: '#0D0D0D' },\n"
    "  autonomous_shuttle: { label: 'Auto Shuttle', color: '#404040' },\n"
    "  autonomous_bus:     { label: 'Auto Bus',     color: '#6B6B6B' },\n"
    "  autonomous_pod:     { label: 'Auto Pod',     color: '#999999' },\n"
    "  car_sharing_ev:     { label: 'Car-Share EV', color: '#C4C4C4' },\n"
    "}",
    1
)

src = src.replace(
    "const HUB_COLORS_UI = { hub_l: '#1A1A1A', hub_m: '#2D6A4F', hub_s: '#95B8A0' }",
    "const HUB_COLORS_UI = { hub_l: '#111111', hub_m: '#606060', hub_s: '#AAAAAA' }",
    1
)

src = src.replace(
    "const C = { bg: '#FAFAF9', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }",
    "const C = { bg: '#FFFFFF', card: '#F6F6F6', border: '#E4E4E4', text1: '#0A0A0A', text2: '#3C3C3C', text3: '#909090' }",
    1
)

# ── B2: Slide wrapper — add separator, tighten header ───────────────
src = src.replace(
    "// Consistent slide frame: header always at same top position, content fills remaining space\n"
    "function Slide({ eyebrow, title, sub, children }) {\n"
    "  return (\n"
    "    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '52px 56px 36px 56px', boxSizing: 'border-box', maxWidth: 960, margin: '0 auto' }}>\n"
    "      {/* HEADER — fixed top, same level on every slide */}\n"
    "      <div className=\"dp-a\" style={{ flexShrink: 0, marginBottom: 28 }}>\n"
    "        {eyebrow && <div style={{ fontFamily: SANS, fontSize: 11, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{eyebrow}</div>}\n"
    "        <h2 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: C.text1, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px' }}>{title}</h2>\n"
    "        {sub && <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, marginTop: 14, lineHeight: 1.75, maxWidth: 580, marginBottom: 0 }}>{sub}</p>}\n"
    "      </div>\n"
    "      {/* CONTENT — fills all remaining vertical space */}\n"
    "      <div className=\"dp-a\" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>\n"
    "        {children}\n"
    "      </div>",
    "// Consistent slide frame: header always at same top position, content fills remaining space\n"
    "function Slide({ eyebrow, title, sub, children }) {\n"
    "  return (\n"
    "    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '48px 64px 32px 56px', boxSizing: 'border-box', maxWidth: 960, margin: '0 auto' }}>\n"
    "      {/* HEADER */}\n"
    "      <div className=\"dp-a\" style={{ flexShrink: 0, marginBottom: 0 }}>\n"
    "        {eyebrow && <div style={{ fontFamily: SANS, fontSize: 10, color: C.text3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{eyebrow}</div>}\n"
    "        <h2 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, color: C.text1, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px' }}>{title}</h2>\n"
    "        {sub && <p style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 10, lineHeight: 1.65, maxWidth: 600, marginBottom: 0 }}>{sub}</p>}\n"
    "      </div>\n"
    "      <div style={{ height: 1, background: C.border, flexShrink: 0, margin: '20px 0 0' }} />\n"
    "      {/* CONTENT */}\n"
    "      <div className=\"dp-a\" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 20 }}>\n"
    "        {children}\n"
    "      </div>",
    1
)

# ── B3: Redesign DotMatrix — compact + monochrome ───────────────────
OLD_DOT = (
    "function DotMatrix() {\n"
    "  const UNIT = 10, COLS = 60\n"
    "  const carDots  = Math.ceil(CARS_REPLACED / UNIT)\n"
    "  const fleetDots= Math.ceil(total_fleet / UNIT)\n"
    "  const modeOrder = Object.keys(MODE_META)\n"
    "  const modeDots  = modeOrder.map(m => Math.ceil(fleet[m].total / UNIT))\n"
    "  const fleetColorFn = idx => {\n"
    "    let acc = 0\n"
    "    for (let i = 0; i < modeOrder.length; i++) { acc += modeDots[i]; if (idx < acc) return MODE_META[modeOrder[i]].color }\n"
    "    return C.border\n"
    "  }\n"
    "  const renderDots = (count, colorFn) => {\n"
    "    const rows = []\n"
    "    for (let r = 0; r < Math.ceil(count / COLS); r++) {\n"
    "      const cells = []\n"
    "      for (let c = 0; c < COLS; c++) {\n"
    "        const idx = r * COLS + c\n"
    "        if (idx >= count) break\n"
    "        cells.push(<div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: colorFn(idx), flexShrink: 0 }} />)\n"
    "      }\n"
    "      rows.push(<div key={r} style={{ display: 'flex', gap: 3 }}>{cells}</div>)\n"
    "    }\n"
    "    return rows\n"
    "  }\n"
    "  return (\n"
    "    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>\n"
    "      <div>\n"
    "        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: '#E63946', marginBottom: 8 }}>\n"
    "          Private Cars — {fmt(CARS_REPLACED)} <span style={{ fontWeight: 400, color: C.text3 }}>(each dot = {UNIT} vehicles)</span>\n"
    "        </div>\n"
    "        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(carDots, () => '#E63946')}</div>\n"
    "      </div>\n"
    "      <div>\n"
    "        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.text1, marginBottom: 8 }}>\n"
    "          Post-Car Fleet — {fmt(total_fleet)} <span style={{ fontWeight: 400, color: C.text3 }}>(each dot = {UNIT} vehicles)</span>\n"
    "        </div>\n"
    "        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{renderDots(fleetDots, fleetColorFn)}</div>\n"
    "        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>\n"
    "          {modeOrder.map(m => (\n"
    "            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>\n"
    "              <div style={{ width: 9, height: 9, borderRadius: '50%', background: MODE_META[m].color }} />\n"
    "              <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{MODE_META[m].label}</span>\n"
    "            </div>\n"
    "          ))}\n"
    "        </div>\n"
    "      </div>\n"
    "    </div>\n"
    "  )\n"
    "}"
)

NEW_DOT = (
    "function DotMatrix() {\n"
    "  const UNIT = 50, COLS = 55, DOT = 5, GAP = 2\n"
    "  const carDots   = Math.ceil(CARS_REPLACED / UNIT)\n"
    "  const fleetDots = Math.ceil(total_fleet / UNIT)\n"
    "  const modeOrder = Object.keys(MODE_META)\n"
    "  const modeDots  = modeOrder.map(m => Math.ceil(fleet[m].total / UNIT))\n"
    "  const fleetColorFn = idx => {\n"
    "    let acc = 0\n"
    "    for (let i = 0; i < modeOrder.length; i++) { acc += modeDots[i]; if (idx < acc) return MODE_META[modeOrder[i]].color }\n"
    "    return C.border\n"
    "  }\n"
    "  const renderGrid = (count, colorFn) => {\n"
    "    const rows = []\n"
    "    for (let r = 0; r < Math.ceil(count / COLS); r++) {\n"
    "      const cells = []\n"
    "      for (let c = 0; c < COLS; c++) {\n"
    "        const idx = r * COLS + c\n"
    "        if (idx >= count) break\n"
    "        cells.push(<div key={c} style={{ width: DOT, height: DOT, borderRadius: 1, background: colorFn(idx), flexShrink: 0 }} />)\n"
    "      }\n"
    "      rows.push(<div key={r} style={{ display: 'flex', gap: GAP }}>{cells}</div>)\n"
    "    }\n"
    "    return rows\n"
    "  }\n"
    "  return (\n"
    "    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>\n"
    "      {/* Big ratio number */}\n"
    "      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>\n"
    "        <div style={{ fontFamily: SERIF, fontSize: 72, fontWeight: 400, color: C.text1, lineHeight: 1, letterSpacing: '-2px' }}>1 : {replacement_ratio}</div>\n"
    "        <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, lineHeight: 1.5, maxWidth: 180 }}>shared vehicle replaces {replacement_ratio} private cars in daily circulation</div>\n"
    "      </div>\n"
    "      {/* Dot grids */}\n"
    "      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>\n"
    "        <div>\n"
    "          <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.text3, marginBottom: 6 }}>\n"
    "            Private cars today — {fmt(CARS_REPLACED)} <span style={{ letterSpacing: 0 }}>· 1 dot = {UNIT} vehicles</span>\n"
    "          </div>\n"
    "          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>{renderGrid(carDots, () => '#0A0A0A')}</div>\n"
    "        </div>\n"
    "        <div>\n"
    "          <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.text3, marginBottom: 6 }}>\n"
    "            Post-car shared fleet — {fmt(total_fleet)}\n"
    "          </div>\n"
    "          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>{renderGrid(fleetDots, fleetColorFn)}</div>\n"
    "          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>\n"
    "            {modeOrder.map(m => (\n"
    "              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>\n"
    "                <div style={{ width: 7, height: 7, borderRadius: 1, background: MODE_META[m].color }} />\n"
    "                <span style={{ fontFamily: SANS, fontSize: 11, color: C.text3 }}>{MODE_META[m].label} {fmt(fleet[m].total)}</span>\n"
    "              </div>\n"
    "            ))}\n"
    "          </div>\n"
    "        </div>\n"
    "      </div>\n"
    "    </div>\n"
    "  )\n"
    "}"
)
assert OLD_DOT in src, "DotMatrix not found"
src = src.replace(OLD_DOT, NEW_DOT, 1)

# ── B4: ReplacementChart — red → dark grey ──────────────────────────
src = src.replace("background: '#E63946'", "background: '#111111'", 1)
src = src.replace("color: '#E63946'", "color: '#111111'", 1)
src = src.replace("color: '#E63946'", "color: '#111111'", 1)  # second occurrence label
src = src.replace(
    "color: '#2D6A4F', marginTop: 3 }}>shared vehicle replaces {replacement_ratio} private cars</div>",
    "color: C.text2, marginTop: 3 }}>shared vehicle replaces {replacement_ratio} private cars</div>",
    1
)
# Fix the green stat box in replacement chart
src = src.replace(
    "background: 'rgba(10,126,69,0.05)', border: '1px solid rgba(10,126,69,0.14)'",
    "background: C.card, border: `1px solid ${C.border}`",
    1
)
src = src.replace(
    "color: '#0A7E45', letterSpacing: '-0.02em' }}>1 : {replacement_ratio}</div>",
    "color: C.text1, letterSpacing: '-0.02em' }}>1 : {replacement_ratio}</div>",
    1
)

# ── B5: MethodsOverlay — move outside overflow:hidden, remove broken animation ─
# Step 1: Remove overlay from inside the slide area
OLD_METHODS_IN = (
    "        {/* Methodology overlay */}\n"
    "        {showMethods && <MethodsOverlay onClose={() => setShowMethods(false)} />}\n"
    "\n"
    "        <SlideHandle total={ALL_SLIDES.length} slide={slide} onGo={(i) => { busy.current = false; setSlide(i) }} />\n"
    "      </div>\n"
    "    </div>\n"
    "  )\n"
    "}"
)
NEW_METHODS_IN = (
    "        <SlideHandle total={ALL_SLIDES.length} slide={slide} onGo={(i) => { busy.current = false; setSlide(i) }} />\n"
    "      </div>\n"
    "\n"
    "      {/* Methodology overlay — outside overflow:hidden so it scrolls properly */}\n"
    "      {showMethods && <MethodsOverlay onClose={() => setShowMethods(false)} />}\n"
    "    </div>\n"
    "  )\n"
    "}"
)
assert OLD_METHODS_IN in src, "OLD_METHODS_IN not found"
src = src.replace(OLD_METHODS_IN, NEW_METHODS_IN, 1)

# Step 2: Simplify MethodsOverlay — remove IntersectionObserver, make content always visible
OLD_OVERLAY_EFFECT = (
    "function MethodsOverlay({ onClose }) {\n"
    "  const scrollRef = React.useRef(null)\n"
    "\n"
    "  useEffect(() => {\n"
    "    const el = scrollRef.current\n"
    "    if (!el) return\n"
    "    const obs = new IntersectionObserver(\n"
    "      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('dp-v') }),\n"
    "      { threshold: 0.05, root: el }\n"
    "    )\n"
    "    el.querySelectorAll('.dp-a').forEach(n => obs.observe(n))\n"
    "    return () => obs.disconnect()\n"
    "  }, [])"
)
NEW_OVERLAY_EFFECT = (
    "function MethodsOverlay({ onClose }) {\n"
    "  const scrollRef = React.useRef(null)"
)
assert OLD_OVERLAY_EFFECT in src, "OLD_OVERLAY_EFFECT not found"
src = src.replace(OLD_OVERLAY_EFFECT, NEW_OVERLAY_EFFECT, 1)

# Remove dp-a classes inside MethodsOverlay — replace with always-visible divs
# Since dp-a items start invisible, they break the overlay. Replace className="dp-a" with nothing inside overlay.
# Strategy: The MethodsOverlay is between function MethodsOverlay and the next function S23_Methods.
# We'll remove all occurrences of dp-a className within overlay by replacing them
# More targeted approach: use a marker approach
# Find the overlay function text and replace dp-a inside it
start_marker = "function MethodsOverlay({ onClose }) {"
end_marker = "\nfunction S23_Methods()"
start_idx = src.index(start_marker)
end_idx = src.index(end_marker)
overlay_section = src[start_idx:end_idx]
overlay_section = overlay_section.replace('className="dp-a" style={{', 'style={{')
overlay_section = overlay_section.replace('className="dp-a"', '')
src = src[:start_idx] + overlay_section + src[end_idx:]

# Step 3: Make MethodsOverlay cover full DataPanel (including nav) by checking its position
# The overlay is now after </div> closing the slide area but still inside the outerRef div.
# It should be position:absolute, inset:0 which covers the whole DataPanel — no change needed.

# ── B6: CSS — white background in slide animation ───────────────────
src = src.replace(
    ".dp-slide{position:absolute;inset:0;animation:dp-in 350ms cubic-bezier(.4,0,.2,1) both}",
    ".dp-slide{position:absolute;inset:0;animation:dp-in 350ms cubic-bezier(.4,0,.2,1) both;background:#FFFFFF}",
    1
)

# ── B7: ModeCards — remove colored top borders, use grey ────────────
# Fix green background on mode summary cards
src = src.replace(
    "background: 'rgba(10,126,69,0.04)', border: '1px solid rgba(10,126,69,0.12)'",
    "background: C.card, border: `1px solid ${C.border}`",
    1
)
# Remove hardcoded colored borders (mode colored top borders on cards)
# Search for pattern with hub color borders
import re
src = re.sub(r"borderTop: `3px solid \$\{MODE_META\[mode\]\.color\}`", "borderTop: `2px solid ${MODE_META[mode].color}`", src)

# ── B8: Fix ModalShareChart — improve label contrast ────────────────
# The chart uses MODAL colors which are now grey - make sure text stays readable

# ── B9: Remove any remaining green accent colors ─────────────────────
src = src.replace("color: '#2D6A4F'", "color: C.text1", 1)  # replacement chart label

# ── B10: HourlyChart — simplify ──────────────────────────────────────
# Current chart uses '#2C3E50' for bars - already neutral, keep

# ── B11: FlowChart — remove green/blue ───────────────────────────────
src = src.replace("background: 'rgba(41,128,185,0.08)'", "background: C.card", 1)
src = src.replace("background: 'rgba(39,174,96,0.08)'", "background: C.card", 1)
src = src.replace("color: '#27AE60'", "color: C.text1", 1)
src = src.replace("color: '#2980B9'", "color: C.text1", 1)

# ── B12: BaselineTable styling fix ───────────────────────────────────
src = src.replace(
    "background: i % 2 === 0 ? C.bg : C.card",
    "background: i % 2 === 0 ? '#FFFFFF' : '#F8F8F8'",
    1
)

with open(DP_FILE, 'w', encoding='utf-8', newline='') as f:
    f.write(src)

with open(DP_FILE, 'r', encoding='utf-8') as f:
    total = sum(1 for _ in f)
print(f"DataPanel patched. Total lines: {total}")
