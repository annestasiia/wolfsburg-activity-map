"""
Post-Car Wolfsburg — Fleet calculation
Based on modal distribution baseline (results_baseline.csv).
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

# ─── INPUT DATA (from baseline) ───────────────────────────────────────────────
D_internal      = 67665   # trips/day inside zone
peak_hour_trips = 8983    # trips at peak hour (08:00)
zone_area_km2   = 4.0     # km²

new_modal_share = {
    "walking":            0.30,
    "e_bike":             0.25,
    "autonomous_shuttle": 0.18,
    "autonomous_bus":     0.10,
    "autonomous_pod":     0.10,
    "car_sharing_ev":     0.07,
}

fleet_params = {
    "e_bike": {
        "capacity":            1,
        "turnover_per_day":    7,
        "peak_factor":         1.35,
        "avg_trip_duration_h": 0.25,
        "source": "Nextbike operational data",
    },
    "autonomous_shuttle": {
        "capacity":            12,
        "turnover_per_day":    40,
        "peak_factor":         1.40,
        "avg_trip_duration_h": 0.25,
        "source": "UITP autonomous shuttle benchmarks",
    },
    "autonomous_bus": {
        "capacity":            25,
        "turnover_per_day":    18,
        "peak_factor":         1.45,
        "avg_trip_duration_h": 0.40,
        "source": "UITP urban bus benchmarks",
    },
    "autonomous_pod": {
        "capacity":            1.5,
        "turnover_per_day":    22,
        "peak_factor":         1.30,
        "avg_trip_duration_h": 0.20,
        "source": "MOIA Hamburg analogue",
    },
    "car_sharing_ev": {
        "capacity":            3.5,
        "turnover_per_day":    5,
        "peak_factor":         1.25,
        "avg_trip_duration_h": 0.50,
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

# ─── STEP 1: Trips per mode per day ───────────────────────────────────────────
trips_by_mode = {
    mode: D_internal * share
    for mode, share in new_modal_share.items()
    if mode != "walking"
}

# ─── STEP 2: Base fleet ───────────────────────────────────────────────────────
fleet_base = {}
for mode, trips in trips_by_mode.items():
    p = fleet_params[mode]
    fleet_base[mode] = math.ceil(trips / (p["turnover_per_day"] * p["capacity"]))

# ─── STEP 3: Peak fleet ───────────────────────────────────────────────────────
fleet_peak = {}
for mode in fleet_base:
    fleet_peak[mode] = math.ceil(fleet_base[mode] * fleet_params[mode]["peak_factor"])

# ─── STEP 4: On street at peak hour ───────────────────────────────────────────
transport_share_total = 1 - new_modal_share["walking"]   # 0.70
on_street_peak = {}
for mode in fleet_base:
    p = fleet_params[mode]
    mode_share = new_modal_share[mode] / transport_share_total
    peak_trips_mode = peak_hour_trips * mode_share
    on_street_peak[mode] = math.ceil(
        (peak_trips_mode / p["capacity"]) * p["avg_trip_duration_h"]
    )

# ─── STEP 5: Charging points ──────────────────────────────────────────────────
charging_needed = {}
for mode in fleet_peak:
    if mode == "e_bike":
        charging_needed[mode] = math.ceil(fleet_peak[mode] * 0.50)
    else:
        charging_needed[mode] = math.ceil(fleet_peak[mode] * 0.30)

# ─── STEP 6: Density per km² ──────────────────────────────────────────────────
density_per_km2 = {
    mode: round(fleet_peak[mode] / zone_area_km2, 1)
    for mode in fleet_peak
}

# ─── STEP 7: Replacement ratio ────────────────────────────────────────────────
cars_replaced     = 49648
total_fleet       = sum(fleet_peak.values())
replacement_ratio = round(cars_replaced / total_fleet, 1)
total_charging    = sum(charging_needed.values())
total_on_street   = sum(on_street_peak.values())

# ─── CONSOLE OUTPUT ───────────────────────────────────────────────────────────
print("\n" + "=" * 54)
print("  FLEET CALCULATION SUMMARY  --  Post-Car Wolfsburg")
print("=" * 54)
for mode in fleet_base:
    label = MODE_LABELS[mode].ljust(20)
    print(f"  {label}  {fleet_base[mode]:>4} base  ->  {fleet_peak[mode]:>4} peak")
print("-" * 54)
print(f"  {'Total fleet (peak)'.ljust(20)}  {total_fleet:>4} units")
print(f"  {'Cars replaced'.ljust(20)}  {cars_replaced:>4,}")
print(f"  Replacement ratio:   1 shared vehicle replaces {replacement_ratio} private cars")
print("-" * 54)
print("  Charging points needed:")
for mode in charging_needed:
    print(f"    {MODE_LABELS[mode].ljust(18)}  {charging_needed[mode]:>4}")
print(f"    {'TOTAL'.ljust(18)}  {total_charging:>4}")
print("=" * 54 + "\n")

# ─── EXPORT CSV ───────────────────────────────────────────────────────────────
out_dir = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(out_dir, exist_ok=True)

rows = []
for mode in fleet_base:
    rows.append({
        "Mode":             MODE_LABELS[mode],
        "Trips_per_day":    round(trips_by_mode[mode]),
        "Fleet_base":       fleet_base[mode],
        "Fleet_peak":       fleet_peak[mode],
        "On_street_peak":   on_street_peak[mode],
        "Charging_needed":  charging_needed[mode],
        "Density_per_km2":  density_per_km2[mode],
        "Source":           fleet_params[mode]["source"],
    })
df = pd.DataFrame(rows)
df.to_csv(os.path.join(out_dir, "results_fleet.csv"), index=False)
print(f"Saved -> {out_dir}\\results_fleet.csv")

# ─── CHART STYLE ──────────────────────────────────────────────────────────────
plt.rcParams.update({
    "font.family":  "sans-serif",
    "font.size":    10,
    "axes.spines.top":    False,
    "axes.spines.right":  False,
    "axes.spines.left":   False,
    "axes.spines.bottom": False,
    "axes.grid":          True,
    "axes.grid.axis":     "x",
    "grid.color":         "#E8E8ED",
    "grid.linewidth":     0.8,
    "figure.facecolor":   "#F5F5F7",
    "axes.facecolor":     "#FFFFFF",
})

modes        = list(fleet_base.keys())
labels       = [MODE_LABELS[m] for m in modes]
colors       = [MODE_COLORS[m] for m in modes]
base_vals    = [fleet_base[m]  for m in modes]
peak_vals    = [fleet_peak[m]  for m in modes]

# ── a) Horizontal bar chart: base vs peak ─────────────────────────────────────
fig, ax = plt.subplots(figsize=(9, 4))
fig.patch.set_facecolor("#F5F5F7")
ax.set_facecolor("#FFFFFF")

y = np.arange(len(modes))
h = 0.32
bars_base = ax.barh(y + h/2, base_vals, height=h, color=colors, alpha=0.45, label="Base fleet")
bars_peak = ax.barh(y - h/2, peak_vals, height=h, color=colors, alpha=0.90, label="Peak fleet")

for bar, val in zip(bars_base, base_vals):
    ax.text(val + 4, bar.get_y() + bar.get_height()/2, str(val),
            va='center', ha='left', fontsize=9, color='#6E6E73')
for bar, val in zip(bars_peak, peak_vals):
    ax.text(val + 4, bar.get_y() + bar.get_height()/2, str(val),
            va='center', ha='left', fontsize=9, fontweight='bold', color='#1D1D1F')

ax.set_yticks(y)
ax.set_yticklabels(labels, fontsize=10)
ax.set_xlabel("Units", fontsize=9, color='#6E6E73')
ax.set_title("Fleet Size — Base vs Peak", fontsize=12, fontweight='bold',
             color='#1D1D1F', pad=12)
ax.legend(loc='lower right', fontsize=9, framealpha=0.9)
ax.tick_params(colors='#6E6E73')
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "fleet_base_vs_peak.png"), dpi=150, bbox_inches='tight')
plt.close()
print(f"Saved -> {out_dir}\\fleet_base_vs_peak.png")

# ── b) Stacked bar: Baseline vs Post-Car ──────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 5))
fig.patch.set_facecolor("#F5F5F7")
ax.set_facecolor("#FFFFFF")

# Baseline: single red bar
ax.bar(0, cars_replaced, color="#E63946", width=0.5, label="Private cars (baseline)")
ax.text(0, cars_replaced + 300, f"{cars_replaced:,}", ha='center', fontsize=10,
        fontweight='bold', color='#E63946')

# Post-Car: stacked
bottom = 0
for mode in modes:
    val = fleet_peak[mode]
    ax.bar(1, val, bottom=bottom, color=MODE_COLORS[mode], width=0.5, label=MODE_LABELS[mode])
    if val > 30:
        ax.text(1, bottom + val/2, f"{val}", ha='center', va='center',
                fontsize=8, color='white', fontweight='bold')
    bottom += val
ax.text(1, bottom + 300, f"{total_fleet:,}", ha='center', fontsize=10,
        fontweight='bold', color='#1D1D1F')

ax.set_xticks([0, 1])
ax.set_xticklabels(["BASELINE\n(private cars)", "POST-CAR\n(shared fleet)"], fontsize=10)
ax.set_ylabel("Units", fontsize=9, color='#6E6E73')
ax.set_title("Fleet Replacement Comparison", fontsize=12, fontweight='bold',
             color='#1D1D1F', pad=12)
ax.text(0.5, -0.14,
        f"1 shared vehicle replaces {replacement_ratio} private cars",
        transform=ax.transAxes, ha='center', fontsize=10,
        color='#6E6E73', style='italic')
ax.legend(loc='upper right', fontsize=8, framealpha=0.9)
ax.tick_params(colors='#6E6E73')
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "fleet_replacement.png"), dpi=150, bbox_inches='tight')
plt.close()
print(f"Saved -> {out_dir}\\fleet_replacement.png")

# ── c) Dot matrix ─────────────────────────────────────────────────────────────
UNIT = 10   # each dot = 10 vehicles
n_cars    = math.ceil(cars_replaced / UNIT)
n_new     = math.ceil(total_fleet / UNIT)
cols      = 50

fig, axes = plt.subplots(2, 1, figsize=(11, 4))
fig.patch.set_facecolor("#F5F5F7")
fig.suptitle("Dot Matrix — Fleet Comparison  (each dot = 10 vehicles)",
             fontsize=11, fontweight='bold', color='#1D1D1F', y=1.01)

# Row 0: private cars (red)
ax0 = axes[0]
ax0.set_facecolor("#F5F5F7")
ax0.set_xlim(-0.5, cols - 0.5)
ax0.set_ylim(-0.5, math.ceil(n_cars / cols) - 0.5)
ax0.set_aspect('equal')
ax0.axis('off')
ax0.set_title(f"Private Cars  ({cars_replaced:,} units)", fontsize=9,
              color='#E63946', loc='left', pad=4)
for i in range(n_cars):
    c, r = i % cols, i // cols
    ax0.plot(c, r, 'o', color='#E63946', markersize=5, alpha=0.75)

# Row 1: new fleet (coloured by mode)
ax1 = axes[1]
ax1.set_facecolor("#F5F5F7")
ax1.set_xlim(-0.5, cols - 0.5)
ax1.set_ylim(-0.5, max(1, math.ceil(n_new / cols) - 0.5))
ax1.set_aspect('equal')
ax1.axis('off')
ax1.set_title(f"Post-Car Fleet  ({total_fleet:,} units)", fontsize=9,
              color='#1D1D1F', loc='left', pad=4)

dot_idx = 0
for mode in modes:
    n_dots = math.ceil(fleet_peak[mode] / UNIT)
    for _ in range(n_dots):
        c, r = dot_idx % cols, dot_idx // cols
        ax1.plot(c, r, 'o', color=MODE_COLORS[mode], markersize=5, alpha=0.85)
        dot_idx += 1

legend_patches = [mpatches.Patch(color=MODE_COLORS[m], label=MODE_LABELS[m]) for m in modes]
ax1.legend(handles=legend_patches, loc='lower right', fontsize=8,
           framealpha=0.9, ncol=3)

plt.tight_layout()
plt.savefig(os.path.join(out_dir, "fleet_dot_matrix.png"), dpi=150, bbox_inches='tight')
plt.close()
print(f"Saved -> {out_dir}\\fleet_dot_matrix.png")

# ── d) Summary card 2×3 ───────────────────────────────────────────────────────
fig = plt.figure(figsize=(9, 3.5))
fig.patch.set_facecolor("#F5F5F7")
gs = GridSpec(2, 3, figure=fig, hspace=0.5, wspace=0.4)

cards = [
    ("Total fleet (peak)",     f"{total_fleet:,}",             "units",   "#0071E3"),
    ("Cars replaced",          f"{cars_replaced:,}",           "baseline", "#E63946"),
    ("Replacement ratio",      f"1 : {replacement_ratio}",     "shared → private", "#7C3AED"),
    ("Total charging points",  f"{total_charging:,}",          "simultaneous", "#2D6A4F"),
    ("On-street peak",         f"{total_on_street:,}",         "units at 08:00", "#E67E22"),
    ("Zone coverage",          f"{round(total_fleet/zone_area_km2, 1)}",
                                "units / km²",  "#2980B9"),
]

for idx, (title, value, sub, color) in enumerate(cards):
    row, col = divmod(idx, 3)
    ax = fig.add_subplot(gs[row, col])
    ax.set_facecolor("#FFFFFF")
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.text(0.5, 0.70, value, transform=ax.transAxes,
            ha='center', va='center', fontsize=18, fontweight='bold', color=color)
    ax.text(0.5, 0.32, title, transform=ax.transAxes,
            ha='center', va='center', fontsize=9, fontweight='600', color='#1D1D1F')
    ax.text(0.5, 0.10, sub, transform=ax.transAxes,
            ha='center', va='center', fontsize=8, color='#AEAEB2')

fig.suptitle("Fleet Summary — Post-Car Wolfsburg", fontsize=12,
             fontweight='bold', color='#1D1D1F', y=1.03)
plt.savefig(os.path.join(out_dir, "fleet_summary_card.png"), dpi=150, bbox_inches='tight')
plt.close()
print(f"Saved -> {out_dir}\\fleet_summary_card.png\n")
