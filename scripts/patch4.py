#!/usr/bin/env python3
"""
Patch 4 — Comprehensive monochrome color sweep on DataPanel.jsx
Replace all remaining colored elements with black/grey palette.
"""
import re

DP_FILE = r'c:\Users\mmlll\Documents\Github\WWWWW\src\components\DataPanel.jsx'
with open(DP_FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# ── Global hex color replacements ───────────────────────────────────
replacements = [
    # Reds
    ("#E63946", "#111111"),
    # Blues
    ("#2980B9", "#5E5E5E"),
    ("#1D70B8", "#5E5E5E"),
    # Greens
    ("#0A7E45", "#0A0A0A"),
    ("#2D6A4F", "#2A2A2A"),
    ("#27AE60", "#0D0D0D"),
    ("#52A882", "#909090"),
    # Purples / dark
    ("#8E44AD", "#3A3A3A"),
    ("#2C3E50", "#6B6B6B"),
    # Oranges
    ("#E67E22", "#7A7A7A"),
    ("#FF8C42", "#BBBBBB"),
    # Light greys that were used as neutral already — keep
    ("#BDC3C7", "#C8C8C8"),
]

for old, new in replacements:
    count = src.count(old)
    if count:
        src = src.replace(old, new)
        print(f"  {old} -> {new}  ({count}x)")

# ── Replace rgba colored backgrounds with neutral ────────────────────
src = re.sub(r"rgba\(230,57,70,[0-9.]+\)", "rgba(0,0,0,0.04)", src)
src = re.sub(r"rgba\(41,128,185,[0-9.]+\)", "rgba(0,0,0,0.04)", src)
src = re.sub(r"rgba\(39,174,96,[0-9.]+\)", "rgba(0,0,0,0.03)", src)
src = re.sub(r"rgba\(10,126,69,[0-9.]+\)", "rgba(0,0,0,0.03)", src)

# ── COMP_COLORS_AREA — hub area stacked bar colors → greyscale ──────
src = src.replace(
    "const COMP_COLORS_AREA = { S_fleet_area: '#2D6A4F', S_circ_area: '#52A882', S_charging_area: '#2980B9', S_program_area: '#BDC3C7' }",
    "const COMP_COLORS_AREA = { S_fleet_area: '#111111', S_circ_area: '#555555', S_charging_area: '#888888', S_program_area: '#C8C8C8' }",
    1
)

# ── KCard color prop in intro slide — map colored to grey ───────────
src = src.replace('color="#2980B9"', 'color={C.text2}', 1)
src = src.replace('color="#8E44AD"', 'color={C.text2}', 1)
src = src.replace('color="#2D6A4F"', 'color={C.text2}', 1)
src = src.replace('color="#E63946"', 'color={C.text2}', 1)

# ── Fleet summary stats array colors → grey scale ───────────────────
src = src.replace(
    "{ label: 'D_transport (net)',  value: fmt(D_transport),                               sub: `−${reduction_pct}% vs D_total`,               color: '#0A0A0A' }",
    "{ label: 'D_transport (net)',  value: fmt(D_transport),                               sub: `−${reduction_pct}% vs D_total`,               color: C.text1 }",
    1
)
src = src.replace(
    "{ label: 'Total fleet',        value: fmt(total_fleet),                                sub: 'all modes · peak hour',                        color: '#5E5E5E' }",
    "{ label: 'Total fleet',        value: fmt(total_fleet),                                sub: 'all modes · peak hour',                        color: C.text2 }",
    1
)
src = src.replace(
    "{ label: 'Cars replaced',      value: fmt(CARS_REPLACED),                             sub: 'baseline private cars/day',                    color: '#111111' }",
    "{ label: 'Cars replaced',      value: fmt(CARS_REPLACED),                             sub: 'baseline private cars/day',                    color: C.text2 }",
    1
)
src = src.replace(
    "{ label: 'Replacement ratio',  value: `1 : ${replacement_ratio}`,                    sub: 'shared vehicle → private cars',                color: '#3A3A3A' }",
    "{ label: 'Replacement ratio',  value: `1 : ${replacement_ratio}`,                    sub: 'shared vehicle → private cars',                color: C.text2 }",
    1
)
src = src.replace(
    "{ label: 'Total charging pts', value: fmt(total_charging),                            sub: 'simultaneous',                                 color: '#7A7A7A' }",
    "{ label: 'Total charging pts', value: fmt(total_charging),                            sub: 'simultaneous',                                 color: C.text2 }",
    1
)

# ── Hub summary stats colors ─────────────────────────────────────────
src = src.replace(
    "{ label: 'Total Charging', value: fmt(hub_total_charging), sub: 'charging points (all hubs)', color: '#5E5E5E' }",
    "{ label: 'Total Charging', value: fmt(hub_total_charging), sub: 'charging points (all hubs)', color: C.text2 }",
    1
)
src = src.replace(
    "{ label: 'Hub Footprint', value: fmt(hub_total_footprint), sub: `m²  (${hub_footprint_pct}% of zone)`, color: '#7A7A7A' }",
    "{ label: 'Hub Footprint', value: fmt(hub_total_footprint), sub: `m²  (${hub_footprint_pct}% of zone)`, color: C.text2 }",
    1
)
src = src.replace(
    "{ label: 'Total Fleet', value: fmt(total_fleet), sub: 'vehicles + bikes', color: '#3A3A3A' }",
    "{ label: 'Total Fleet', value: fmt(total_fleet), sub: 'vehicles + bikes', color: C.text2 }",
    1
)

# ── Hub area summary stats color ─────────────────────────────────────
src = src.replace(
    "{ label: 'Total footprint', value: `${fmt(area_total_all_hubs)} m²`, sub: `${area_pct_of_zone}% of 4 km² zone`, color: '#7A7A7A' }",
    "{ label: 'Total footprint', value: `${fmt(area_total_all_hubs)} m²`, sub: `${area_pct_of_zone}% of 4 km² zone`, color: C.text2 }",
    1
)
src = src.replace(
    "{ label: 'Circ. factor', value: `×${CIRCULATION_FACTOR.hub_s}–×${CIRCULATION_FACTOR.hub_l}`, sub: 'fleet area multiplier by tier', color: '#5E5E5E' }",
    "{ label: 'Circ. factor', value: `×${CIRCULATION_FACTOR.hub_s}–×${CIRCULATION_FACTOR.hub_l}`, sub: 'fleet area multiplier by tier', color: C.text2 }",
    1
)

# ── Fix demand row in FlowChart (intro slide trips formula colors) ────
# Replace the colored trip formula text rows
src = src.replace(
    "{ label: 'Residents', val: total_residents, factor: `× ${T_RESIDENT}`, result: total_residents * T_RESIDENT, color: '#5E5E5E' }",
    "{ label: 'Residents', val: total_residents, factor: `× ${T_RESIDENT}`, result: total_residents * T_RESIDENT, color: C.text1 }",
    1
)
src = src.replace(
    "{ label: 'Workers',   val: WORKERS,         factor: `× ${T_WORKER}`,   result: WORKERS * T_WORKER,          color: '#3A3A3A' }",
    "{ label: 'Workers',   val: WORKERS,         factor: `× ${T_WORKER}`,   result: WORKERS * T_WORKER,          color: C.text1 }",
    1
)
src = src.replace(
    "{ label: 'Visitors',  val: visitors,        factor: `× ${T_VISITOR}`,  result: visitors * T_VISITOR,        color: '#2A2A2A' }",
    "{ label: 'Visitors',  val: visitors,        factor: `× ${T_VISITOR}`,  result: visitors * T_VISITOR,        color: C.text1 }",
    1
)

# ── HourlyChart peak bar color ────────────────────────────────────────
src = src.replace(
    "background: isPeak(h) ? '#111111' : '#5E5E5E'",
    "background: isPeak(h) ? '#0A0A0A' : '#C0C0C0'",
    1
)

# ── DistrictChart bar color ───────────────────────────────────────────
src = src.replace(
    "background: '#5E5E5E', borderRadius: 3",
    "background: '#111111', borderRadius: 3",
    1
)

# ── Fix AreaTable accent color (green → text1) ────────────────────────
src = src.replace(
    "color: accent ? '#0A0A0A' : C.text1",
    "color: C.text1",
    1
)
# Fix the large D_transport number that was green
src = src.replace(
    "color: '#0A0A0A', fontVariantNumeric: 'tabular-nums'",
    "color: C.text1, fontVariantNumeric: 'tabular-nums'",
    1
)
# Fix total_charging green label
src = src.replace(
    "color: '#0A0A0A' }}>{fmt(total_charging)}</span>",
    "color: C.text1 }}>{fmt(total_charging)}</span>",
    1
)
# Fix D_transport in FlowChart
src = src.replace(
    "color: '#0A0A0A' }}>{fmt(D_transport)}</div>",
    "color: C.text1 }}>{fmt(D_transport)}</div>",
    1
)
# labels in FlowChart
src = src.replace(
    "color: '#0A0A0A' }}>D_transport (net)</span>",
    "color: C.text1 }}>D_transport (net)</span>",
    1
)
# Fix inbound/internal badge colors
src = src.replace(
    "color: '#111111', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 4 }}>inbound</span>",
    "color: C.text3, background: C.card, padding: '1px 6px', borderRadius: 4 }}>inbound</span>",
    1
)
src = src.replace(
    "color: '#5E5E5E', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 4 }}>internal</span>",
    "color: C.text3, background: C.card, padding: '1px 6px', borderRadius: 4 }}>internal</span>",
    1
)
# Hub infra table colored cell text
src = src.replace(
    "fontWeight: 600, color: '#5E5E5E', fontSize: 12 }}>Charging pts / hub</td>",
    "fontWeight: 600, color: C.text2, fontSize: 12 }}>Charging pts / hub</td>",
    1
)
src = src.replace(
    "fontWeight: 700, color: '#5E5E5E'",
    "fontWeight: 600, color: C.text2",
    1
)
src = src.replace(
    "fontWeight: 600, color: '#7A7A7A', fontSize: 12 }}>Footprint / hub (m²)</td>",
    "fontWeight: 600, color: C.text2, fontSize: 12 }}>Footprint / hub (m²)</td>",
    1
)
src = src.replace(
    "fontWeight: 700, color: '#7A7A7A'",
    "fontWeight: 600, color: C.text2",
    1
)
# Private cars bar label color in replacement chart
src = src.replace(
    "color: '#111111', fontWeight: 600, marginTop: 6 }}>Private cars</div>",
    "color: C.text3, fontWeight: 400, marginTop: 6 }}>Private cars</div>",
    1
)
# Area total number orange
src = src.replace(
    "color: '#7A7A7A' }}>{fmt(area_total_all_hubs)} m²</div>",
    "color: C.text1 }}>{fmt(area_total_all_hubs)} m²</div>",
    1
)
# Fix intro trip row color usage (left of = sign in the formula)
src = src.replace(
    "color: row.color }}>",
    "color: C.text1 }}>",
    1
)

# ── ReplacementChart: fix remaining label ────────────────────────────
src = src.replace(
    "color: 'C.text2', marginTop: 3",
    "color: C.text2, marginTop: 3",
    1
)

with open(DP_FILE, 'w', encoding='utf-8', newline='') as f:
    f.write(src)

with open(DP_FILE, 'r', encoding='utf-8') as f:
    total = sum(1 for _ in f)
print(f"Done. Lines: {total}")

# Quick color audit
import subprocess
result = subprocess.run(
    ['python', '-c', f"""
import re
with open(r'{DP_FILE}', 'r', encoding='utf-8') as f:
    src = f.read()
bright = re.findall(r"'#([0-9A-Fa-f]{{6}})'", src)
unique = sorted(set('#'+c for c in bright))
print('Remaining hex colors:', unique)
"""],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:400])
