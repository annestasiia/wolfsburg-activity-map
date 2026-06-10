"""
Post-Car Wolfsburg — Fleet calculation v2
New algorithm: trip flow decomposition → peak-hour fleet sizing.
Sources: Nextbike, UITP, MOIA Hamburg, Share Now / Stadtmobil
"""
import math
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.gridspec import GridSpec
from matplotlib.path import Path
import matplotlib.patches as mpatches

# ─── INPUT: baseline values ───────────────────────────────────────────────────
total_residents    = 17400
workers_in_zone    = 18000
trips_per_resident = 3.2
trips_per_worker   = 2.1
trips_per_visitor  = 1.5
visitor_share      = 0.20
visitors           = (total_residents + workers_in_zone) * visitor_share  # 7080
D_total            = (total_residents * trips_per_resident
                      + workers_in_zone  * trips_per_worker
                      + visitors         * trips_per_visitor)              # 104100
peak_hour_trips    = 8983    # trips at peak hour 08:00
zone_area_km2      = 4.0
cars_replaced      = 49648   # baseline private cars/day

fleet_params = {
    "e_bike": {
        "capacity":            1,
        "avg_trip_duration_h": 0.25,
        "peak_factor":         1.20,
        "source": "Nextbike operational data",
    },
    "autonomous_shuttle": {
        "capacity":            12,
        "avg_trip_duration_h": 0.25,
        "peak_factor":         1.30,
        "source": "UITP benchmarks",
    },
    "autonomous_bus": {
        "capacity":            25,
        "avg_trip_duration_h": 0.40,
        "peak_factor":         1.35,
        "source": "UITP urban bus benchmarks",
    },
    "autonomous_pod": {
        "capacity":            1.5,
        "avg_trip_duration_h": 0.20,
        "peak_factor":         1.20,
        "source": "MOIA Hamburg analogue",
    },
    "car_sharing_ev": {
        "capacity":            3.5,
        "avg_trip_duration_h": 0.50,
        "peak_factor":         1.15,
        "source": "Share Now / Stadtmobil data",
    },
}

MODE_COLORS = {
    "e_bike":             "#27AE60",
    "autonomous_shuttle": "#8E44AD",
    "autonomous_bus":     "#2C3E50",
    "autonomous_pod":     "#2980B9",
    "car_sharing_ev":     "#E67E22",
}
MODE_LABELS = {
    "e_bike":             "E-Bike",
    "autonomous_shuttle": "Auto Shuttle",
    "autonomous_bus":     "Auto Bus",
    "autonomous_pod":     "Auto Pod",
    "car_sharing_ev":     "Car-Share EV",
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — TRIP FLOW DECOMPOSITION
# ═══════════════════════════════════════════════════════════════════════════════

# Flow 1: inbound (cross-zone-boundary)
inbound_worker_trips  = workers_in_zone * trips_per_worker * 0.50
inbound_visitor_trips = visitors * trips_per_visitor * 0.80
inbound_trips         = inbound_worker_trips + inbound_visitor_trips

# Flow 2: resident trips (generated inside zone)
resident_trips = total_residents * trips_per_resident

# Flow 3: internal trips of workers/visitors already inside zone
internal_worker_trips  = workers_in_zone * trips_per_worker * 0.50
internal_visitor_trips = visitors * trips_per_visitor * 0.20
internal_other_trips   = internal_worker_trips + internal_visitor_trips

all_internal_trips = resident_trips + internal_other_trips

# Distance filter: zone 4 km², avg trip ≤ 2 km → ~60% internal trips are walkable
walking_share_internal = 0.60
transport_internal     = all_internal_trips * (1 - walking_share_internal)
walking_filtered       = all_internal_trips * walking_share_internal

# Net transport demand
D_transport       = inbound_trips + transport_internal
reduction_vs_total = (D_total - D_transport) / D_total

print("\n" + "=" * 54)
print("  TRIP STRUCTURE ANALYSIS")
print("=" * 54)
print(f"  Inbound trips/day:        {inbound_trips:>8,.0f}  (въезд в зону)")
print(f"  Internal transport/day:   {transport_internal:>8,.0f}  (внутри зоны, транспорт)")
print(f"  Walking filtered out:     {walking_filtered:>8,.0f}  (пешие внутренние)")
print(f"  D_transport (net):        {D_transport:>8,.0f}")
print(f"  Reduction vs D_total:     {reduction_vs_total:>8.1%}")
print("=" * 54)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — MODAL SPLIT BY FLOW TYPE
# ═══════════════════════════════════════════════════════════════════════════════

inbound_modal = {
    "autonomous_bus":     0.35,
    "autonomous_shuttle": 0.25,
    "car_sharing_ev":     0.25,
    "autonomous_pod":     0.15,
}
internal_modal = {
    "e_bike":             0.45,
    "autonomous_pod":     0.35,
    "autonomous_shuttle": 0.20,
}

trips_by_mode = {}
for mode, share in inbound_modal.items():
    trips_by_mode[mode] = trips_by_mode.get(mode, 0) + inbound_trips * share
for mode, share in internal_modal.items():
    trips_by_mode[mode] = trips_by_mode.get(mode, 0) + transport_internal * share

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — FLEET FROM PEAK HOUR
# ═══════════════════════════════════════════════════════════════════════════════

mode_shares = {mode: trips / D_transport for mode, trips in trips_by_mode.items()}

peak_trips_by_mode = {
    mode: peak_hour_trips * share
    for mode, share in mode_shares.items()
}

# On-street fleet at peak hour = (peak_trips / capacity) × avg_trip_duration
fleet_peak = {}
for mode, pt in peak_trips_by_mode.items():
    p = fleet_params[mode]
    fleet_peak[mode] = math.ceil((pt / p["capacity"]) * p["avg_trip_duration_h"])

# Total fleet = on-street peak × peak_factor (reserve + charging + standby)
fleet_total = {}
for mode in fleet_peak:
    fleet_total[mode] = math.ceil(fleet_peak[mode] * fleet_params[mode]["peak_factor"])

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — CHARGING POINTS
# ═══════════════════════════════════════════════════════════════════════════════

charging_needed = {}
for mode in fleet_total:
    rate = 0.50 if mode == "e_bike" else 0.30
    charging_needed[mode] = math.ceil(fleet_total[mode] * rate)
total_charging = sum(charging_needed.values())

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — COMPARISON WITH BASELINE
# ═══════════════════════════════════════════════════════════════════════════════

total_fleet       = sum(fleet_total.values())
replacement_ratio = round(cars_replaced / total_fleet, 1)

# ─── CONSOLE OUTPUT ───────────────────────────────────────────────────────────
print("\n" + "=" * 72)
print("  FLEET CALCULATION (from peak hour)")
print("=" * 72)
header = f"  {'Mode':<22}| {'Trips/day':>10} | {'Peak/hour':>10} | {'On-street':>10} | {'Total fleet':>11}"
print(header)
print("-" * 72)
for mode in fleet_peak:
    print(f"  {MODE_LABELS[mode]:<22}| {trips_by_mode[mode]:>10,.0f} | "
          f"{peak_trips_by_mode[mode]:>10,.0f} | {fleet_peak[mode]:>10} | {fleet_total[mode]:>11}")
print("-" * 72)
print(f"  {'TOTAL FLEET':<22}  {'':>10}   {'':>10}   {'':>10}   {total_fleet:>11}")
print(f"  CARS REPLACED:   {cars_replaced:,}")
print(f"  RATIO:           1 shared vehicle replaces {replacement_ratio} private cars")
print("-" * 72)
print("  CHARGING POINTS NEEDED:")
for mode in charging_needed:
    print(f"    {MODE_LABELS[mode]:<20}  {charging_needed[mode]:>4}")
print(f"    {'TOTAL':<20}  {total_charging:>4}")
print("=" * 72 + "\n")

# ─── EXPORT CSV ───────────────────────────────────────────────────────────────
out_dir = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(out_dir, exist_ok=True)

rows = []
for mode in fleet_peak:
    rows.append({
        "Mode":             MODE_LABELS[mode],
        "Trips_day":        round(trips_by_mode[mode]),
        "Peak_hour_trips":  round(peak_trips_by_mode[mode]),
        "On_street_peak":   fleet_peak[mode],
        "Fleet_total":      fleet_total[mode],
        "Charging_needed":  charging_needed[mode],
        "Source":           fleet_params[mode]["source"],
    })
df = pd.DataFrame(rows)
df.to_csv(os.path.join(out_dir, "results_fleet.csv"), index=False)
print(f"Saved -> {out_dir}\\results_fleet.csv")

# ─── CHART STYLE ──────────────────────────────────────────────────────────────
plt.rcParams.update({
    "font.family": "sans-serif", "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.spines.left": False, "axes.spines.bottom": False,
    "axes.grid": True, "axes.grid.axis": "x",
    "grid.color": "#E8E8ED", "grid.linewidth": 0.8,
    "figure.facecolor": "#F5F5F7", "axes.facecolor": "#FFFFFF",
})

modes  = list(fleet_peak.keys())
labels = [MODE_LABELS[m] for m in modes]
colors = [MODE_COLORS[m] for m in modes]

# ── a) Flow decomposition — stacked bar (Sankey-style) ────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 5), gridspec_kw={"width_ratios": [1, 1.6]})
fig.patch.set_facecolor("#F5F5F7")
fig.suptitle("Trip Flow Decomposition — Wolfsburg City Centre",
             fontsize=13, fontweight="bold", color="#1D1D1F", y=1.01)

ax_left, ax_right = axes

# Left: D_total breakdown into 3 flows
flows_left = {
    "Inbound (cross-boundary)": (inbound_trips,         "#E63946"),
    "Internal transport":        (transport_internal,    "#2980B9"),
    "Walking (filtered)":        (walking_filtered,      "#AEAEB2"),
}
bottom = 0
for label_f, (val, col) in flows_left.items():
    ax_left.bar(0, val, bottom=bottom, color=col, width=0.5, alpha=0.88)
    if val > 2000:
        ax_left.text(0, bottom + val/2, f"{val:,.0f}", ha="center", va="center",
                     fontsize=9, fontweight="bold", color="white")
    bottom += val

ax_left.text(0, D_total + 1500, f"D_total\n{D_total:,.0f}", ha="center",
             fontsize=9, color="#1D1D1F", fontweight="bold")
ax_left.set_xlim(-0.8, 0.8)
ax_left.set_xticks([])
ax_left.set_title("D_total split", fontsize=10, color="#6E6E73")
ax_left.set_ylabel("Trips / day", fontsize=9, color="#6E6E73")

patches_left = [mpatches.Patch(color=c, label=l, alpha=0.88)
                for l, (_, c) in flows_left.items()]
ax_left.legend(handles=patches_left, loc="upper right", fontsize=8, framealpha=0.9)

# Right: mode trips stacked (inbound portion + internal portion)
inbound_per_mode  = {m: inbound_trips * inbound_modal.get(m, 0) for m in modes}
internal_per_mode = {m: transport_internal * internal_modal.get(m, 0) for m in modes}

x = np.arange(len(modes))
w = 0.5
b_inb = np.zeros(len(modes))
b_int = np.zeros(len(modes))

for i, mode in enumerate(modes):
    iv = inbound_per_mode[mode]
    tv = internal_per_mode[mode]
    if iv > 0:
        ax_right.bar(x[i], iv, bottom=b_inb[i], color=colors[i], width=w, alpha=0.55,
                     label="_nolegend_")
    if tv > 0:
        ax_right.bar(x[i], tv, bottom=b_inb[i]+iv, color=colors[i], width=w, alpha=0.90,
                     label="_nolegend_")
    total_v = iv + tv
    ax_right.text(x[i], total_v + 200, f"{total_v:,.0f}", ha="center",
                  fontsize=8, fontweight="bold", color=colors[i])

ax_right.set_xticks(x)
ax_right.set_xticklabels(labels, fontsize=9)
ax_right.set_title("Trips/day by mode  (light = inbound · dark = internal)",
                   fontsize=10, color="#6E6E73")
ax_right.set_ylabel("Trips / day", fontsize=9, color="#6E6E73")

plt.tight_layout()
plt.savefig(os.path.join(out_dir, "fleet_flow.png"), dpi=150, bbox_inches="tight")
plt.close()
print(f"Saved -> {out_dir}\\fleet_flow.png")

# ── b) Grouped bar — On-street peak vs Total fleet ────────────────────────────
fig, ax = plt.subplots(figsize=(9, 4))
fig.patch.set_facecolor("#F5F5F7")
ax.set_facecolor("#FFFFFF")

y = np.arange(len(modes))
h = 0.32
peak_vals  = [fleet_peak[m]  for m in modes]
total_vals = [fleet_total[m] for m in modes]

bars_bg  = ax.barh(y - h/2, total_vals, height=h, color=colors, alpha=0.35, label="Total fleet (with reserve)")
bars_fg  = ax.barh(y + h/2, peak_vals,  height=h, color=colors, alpha=0.90, label="On-street at peak hour")

for bar, val in zip(bars_bg, total_vals):
    ax.text(val + 2, bar.get_y() + bar.get_height()/2, str(val),
            va="center", ha="left", fontsize=9, color="#6E6E73")
for bar, val in zip(bars_fg, peak_vals):
    ax.text(val + 2, bar.get_y() + bar.get_height()/2, str(val),
            va="center", ha="left", fontsize=9, fontweight="bold", color="#1D1D1F")

ax.set_yticks(y)
ax.set_yticklabels(labels, fontsize=10)
ax.set_xlabel("Units", fontsize=9, color="#6E6E73")
ax.set_title("Fleet — On-street Peak vs Total with Reserve", fontsize=12,
             fontweight="bold", color="#1D1D1F", pad=12)
ax.legend(loc="lower right", fontsize=9, framealpha=0.9)
ax.tick_params(colors="#6E6E73")
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "fleet_peak_vs_total.png"), dpi=150, bbox_inches="tight")
plt.close()
print(f"Saved -> {out_dir}\\fleet_peak_vs_total.png")

# ── c) Dot matrix ─────────────────────────────────────────────────────────────
UNIT = 50
n_cars  = math.ceil(cars_replaced / UNIT)
n_fleet = math.ceil(total_fleet   / UNIT)
COLS    = 40

fig, axes = plt.subplots(2, 1, figsize=(11, 4))
fig.patch.set_facecolor("#F5F5F7")
fig.suptitle(f"Dot Matrix  (each dot = {UNIT} vehicles)",
             fontsize=11, fontweight="bold", color="#1D1D1F", y=1.01)

def draw_dots(ax, count, cols, color_fn, title, title_color):
    ax.set_facecolor("#F5F5F7")
    ax.set_xlim(-0.5, cols - 0.5)
    ax.set_ylim(-0.8, max(1, math.ceil(count/cols) - 0.2))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=9, color=title_color, loc="left", pad=4)
    for i in range(count):
        c, r = i % cols, i // cols
        ax.plot(c, r, "o", color=color_fn(i), markersize=6, alpha=0.80)

draw_dots(axes[0], n_cars, COLS, lambda _: "#E63946",
          f"Private Cars  ({cars_replaced:,} units)", "#E63946")

# Fleet dots coloured by mode
mode_dot_counts = [math.ceil(fleet_total[m] / UNIT) for m in modes]
def fleet_color(idx):
    acc = 0
    for i, m in enumerate(modes):
        acc += mode_dot_counts[i]
        if idx < acc:
            return MODE_COLORS[m]
    return "#ccc"

draw_dots(axes[1], n_fleet, COLS, fleet_color,
          f"Post-Car Fleet  ({total_fleet:,} units)", "#1D1D1F")

patches = [mpatches.Patch(color=MODE_COLORS[m], label=MODE_LABELS[m]) for m in modes]
axes[1].legend(handles=patches, loc="lower right", fontsize=8, framealpha=0.9, ncol=3)

plt.tight_layout()
plt.savefig(os.path.join(out_dir, "fleet_dot_matrix.png"), dpi=150, bbox_inches="tight")
plt.close()
print(f"Saved -> {out_dir}\\fleet_dot_matrix.png")

# ── d) Summary card 2×3 ───────────────────────────────────────────────────────
fig = plt.figure(figsize=(9, 3.5))
fig.patch.set_facecolor("#F5F5F7")
gs  = GridSpec(2, 3, figure=fig, hspace=0.55, wspace=0.4)

summary_cards = [
    ("D_transport (net)",     f"{D_transport:,.0f}",     "trips/day",            "#0071E3"),
    ("Total fleet",           f"{total_fleet:,}",        "peak units",           "#0A7E45"),
    ("Cars replaced",         f"{cars_replaced:,}",      "baseline private cars", "#E63946"),
    ("Replacement ratio",     f"1 : {replacement_ratio}","shared → private",     "#7C3AED"),
    ("Charging points",       f"{total_charging:,}",     "simultaneous",         "#8E44AD"),
    ("Walking share",         f"{walking_share_internal*100:.0f} %",
                                                          "of internal trips",    "#2D6A4F"),
]
for idx, (title, value, sub, color) in enumerate(summary_cards):
    row, col = divmod(idx, 3)
    ax = fig.add_subplot(gs[row, col])
    ax.set_facecolor("#FFFFFF")
    for sp in ax.spines.values(): sp.set_visible(False)
    ax.set_xticks([]); ax.set_yticks([])
    ax.text(0.5, 0.70, value, transform=ax.transAxes,
            ha="center", va="center", fontsize=18, fontweight="bold", color=color)
    ax.text(0.5, 0.32, title, transform=ax.transAxes,
            ha="center", va="center", fontsize=9, fontweight="600", color="#1D1D1F")
    ax.text(0.5, 0.10, sub, transform=ax.transAxes,
            ha="center", va="center", fontsize=8, color="#AEAEB2")

fig.suptitle("Fleet Summary — Post-Car Wolfsburg v2",
             fontsize=12, fontweight="bold", color="#1D1D1F", y=1.03)
plt.savefig(os.path.join(out_dir, "fleet_summary_card.png"), dpi=150, bbox_inches="tight")
plt.close()
print(f"Saved -> {out_dir}\\fleet_summary_card.png\n")
