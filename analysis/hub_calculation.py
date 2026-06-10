"""
Hub count and fleet distribution — Wolfsburg City Centre
Inputs: fixed fleet totals from fleet_calculation.py (v2 peak-hour algorithm)
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

OUT = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUT, exist_ok=True)

# ─── INPUT DATA ──────────────────────────────────────────────────────────────
fleet_total = {
    "e_bike":             641,
    "autonomous_shuttle": 55,
    "autonomous_bus":     33,
    "autonomous_pod":     369,
    "car_sharing_ev":     175,
}

zone_area_km2  = 4.0
hub_s_radius_m = 200
hub_m_radius_m = 400

MODE_LABELS = {
    "e_bike":             "E-Bike",
    "autonomous_shuttle": "Auto Shuttle",
    "autonomous_bus":     "Auto Bus",
    "autonomous_pod":     "Auto Pod",
    "car_sharing_ev":     "Car-Share EV",
}

HUB_COLORS = {
    "hub_l": "#1A1A1A",
    "hub_m": "#2D6A4F",
    "hub_s": "#95B8A0",
}
HUB_LABELS = {"hub_l": "Hub L", "hub_m": "Hub M", "hub_s": "Hub S"}

MODE_COLORS = {
    "e_bike":             "#27AE60",
    "autonomous_shuttle": "#8E44AD",
    "autonomous_bus":     "#2C3E50",
    "autonomous_pod":     "#2980B9",
    "car_sharing_ev":     "#E67E22",
}

# ─── STEP 1 — HUB COUNTS ─────────────────────────────────────────────────────
zone_area_m2 = zone_area_km2 * 1_000_000

hub_s_area  = math.pi * hub_s_radius_m**2
hub_s_count = math.ceil((zone_area_m2 / hub_s_area) * 1.35)

hub_m_area          = math.pi * hub_m_radius_m**2
hub_m_from_geometry = math.ceil((zone_area_m2 / hub_m_area) * 1.35)
hub_m_from_shuttle  = math.ceil(fleet_total["autonomous_shuttle"] / 3)
hub_m_count         = max(hub_m_from_geometry, hub_m_from_shuttle)

hub_l_from_fleet = math.ceil(
    (fleet_total["autonomous_bus"] + fleet_total["car_sharing_ev"]) / 8
)
hub_l_count = min(max(hub_l_from_fleet, 3), 6)

hub_counts = {"hub_l": hub_l_count, "hub_m": hub_m_count, "hub_s": hub_s_count}

# ─── STEP 2 — FLEET DISTRIBUTION BY TIER ─────────────────────────────────────
distribution = {
    "car_sharing_ev":     {"hub_l": 1.00, "hub_m": 0.00, "hub_s": 0.00},
    "autonomous_bus":     {"hub_l": 1.00, "hub_m": 0.00, "hub_s": 0.00},
    "autonomous_shuttle": {"hub_l": 0.50, "hub_m": 0.50, "hub_s": 0.00},
    "autonomous_pod":     {"hub_l": 0.30, "hub_m": 0.50, "hub_s": 0.20},
    "e_bike":             {"hub_l": 0.00, "hub_m": 0.30, "hub_s": 0.70},
}

fleet_at_tier = {"hub_l": {}, "hub_m": {}, "hub_s": {}}
for mode, shares in distribution.items():
    for tier, share in shares.items():
        fleet_at_tier[tier][mode] = math.ceil(fleet_total[mode] * share)

# ─── STEP 3 — FLEET PER HUB (with 20% reserve) ───────────────────────────────
fleet_per_hub = {}
for tier, count in hub_counts.items():
    fleet_per_hub[tier] = {
        mode: math.ceil(fleet_at_tier[tier].get(mode, 0) / count * 1.20)
        for mode in fleet_total
    }

# ─── STEP 4 — INFRASTRUCTURE PER HUB ─────────────────────────────────────────
charging_rate = {
    "e_bike":             0.50,
    "autonomous_pod":     0.30,
    "autonomous_shuttle": 0.30,
    "autonomous_bus":     0.30,
    "car_sharing_ev":     0.30,
}
footprint_m2_per_unit = {
    "e_bike":             2,
    "autonomous_pod":     8,
    "autonomous_shuttle": 30,
    "autonomous_bus":     55,
    "car_sharing_ev":     12,
}

charging_per_hub  = {}
footprint_per_hub = {}
for tier in ["hub_l", "hub_m", "hub_s"]:
    charging_per_hub[tier] = sum(
        math.ceil(fleet_per_hub[tier].get(mode, 0) * rate)
        for mode, rate in charging_rate.items()
    )
    footprint_per_hub[tier] = sum(
        fleet_per_hub[tier].get(mode, 0) * fp
        for mode, fp in footprint_m2_per_unit.items()
    )

# ─── TOTALS ───────────────────────────────────────────────────────────────────
total_charging  = sum(charging_per_hub[t]  * hub_counts[t] for t in hub_counts)
total_footprint = sum(footprint_per_hub[t] * hub_counts[t] for t in hub_counts)
zone_area_m2_total = zone_area_km2 * 1_000_000
footprint_pct = total_footprint / zone_area_m2_total * 100

# ─── CONSOLE OUTPUT ───────────────────────────────────────────────────────────
print("\n" + "="*54)
print("HUB COUNT")
print("="*54)
print(f"Hub L: {hub_l_count:>3}  (max 6, from large fleet)")
print(f"Hub M: {hub_m_count:>3}  (max geometry vs shuttle method)")
print(f"Hub S: {hub_s_count:>3}  (200m coverage, 4 km2 zone)")

print("\n" + "="*54)
print("FLEET PER HUB  (incl. 20% reserve)")
print("="*54)
for tier in ["hub_l", "hub_m", "hub_s"]:
    print(f"\n{HUB_LABELS[tier]} ({hub_counts[tier]} hubs):")
    for mode in fleet_total:
        qty = fleet_per_hub[tier].get(mode, 0)
        if qty > 0:
            print(f"  {MODE_LABELS[mode]:<22} {qty:>4} units")
    print(f"  {'Charging points':<22} {charging_per_hub[tier]:>4}")
    print(f"  {'Est. footprint':<22} {footprint_per_hub[tier]:>4} m2")

print("\n" + "="*54)
print("TOTALS")
print("="*54)
print(f"Total charging points: {total_charging:,}")
print(f"Total fleet footprint: {total_footprint:,} m2")
print(f"Footprint / zone:      {footprint_pct:.2f}%")
print("="*54 + "\n")

# ─── EXPORT CSVs ─────────────────────────────────────────────────────────────
rows_detail = []
for tier in ["hub_l", "hub_m", "hub_s"]:
    for mode in fleet_total:
        rows_detail.append({
            "tier":           HUB_LABELS[tier],
            "mode":           MODE_LABELS[mode],
            "fleet_at_tier":  fleet_at_tier[tier].get(mode, 0),
            "fleet_per_hub":  fleet_per_hub[tier].get(mode, 0),
            "hub_count":      hub_counts[tier],
        })
pd.DataFrame(rows_detail).to_csv(os.path.join(OUT, "results_hubs.csv"), index=False)

summary_rows = []
for tier in ["hub_l", "hub_m", "hub_s"]:
    row = {"tier": HUB_LABELS[tier], "hub_count": hub_counts[tier],
           "charging_per_hub": charging_per_hub[tier],
           "footprint_per_hub_m2": footprint_per_hub[tier]}
    for mode in fleet_total:
        row[f"per_hub_{mode}"] = fleet_per_hub[tier].get(mode, 0)
    summary_rows.append(row)
pd.DataFrame(summary_rows).to_csv(os.path.join(OUT, "results_hub_summary.csv"), index=False)

print(f"Saved -> {OUT}\\results_hubs.csv")
print(f"Saved -> {OUT}\\results_hub_summary.csv")

# ─── STYLE HELPERS ───────────────────────────────────────────────────────────
plt.rcParams.update({
    "font.family":    "sans-serif",
    "font.size":      10,
    "axes.spines.top":    False,
    "axes.spines.right":  False,
    "axes.spines.left":   False,
    "axes.spines.bottom": False,
    "xtick.bottom":  False,
    "ytick.left":    False,
    "figure.facecolor": "white",
    "axes.facecolor":   "white",
})

modes_order = ["e_bike", "autonomous_shuttle", "autonomous_bus", "autonomous_pod", "car_sharing_ev"]
tiers_order = ["hub_l", "hub_m", "hub_s"]

# ─── (a) HEATMAP — fleet per hub ─────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(7, 3.6))
matrix = np.array([
    [fleet_per_hub[t].get(m, 0) for t in tiers_order]
    for m in modes_order
])
cmap = plt.cm.colors.LinearSegmentedColormap.from_list("g", ["#FFFFFF", "#2D6A4F"])
im = ax.imshow(matrix, cmap=cmap, aspect="auto")
ax.set_xticks(range(3)); ax.set_xticklabels([HUB_LABELS[t] for t in tiers_order], fontsize=11, fontweight="600")
ax.set_yticks(range(5)); ax.set_yticklabels([MODE_LABELS[m] for m in modes_order], fontsize=10)
ax.tick_params(length=0)
for i, m in enumerate(modes_order):
    for j, t in enumerate(tiers_order):
        v = matrix[i, j]
        color = "white" if v > matrix.max() * 0.55 else "#1A1A1A"
        ax.text(j, i, str(v) if v > 0 else "–", ha="center", va="center",
                fontsize=11, fontweight="600", color=color)
ax.set_title("Fleet per Hub (incl. 20% reserve)", fontsize=12, fontweight="700",
             pad=12, loc="left", color="#1A1A1A")
fig.tight_layout(pad=1.8)
fig.savefig(os.path.join(OUT, "hub_heatmap.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_heatmap.png")

# ─── (b) STACKED BAR — total fleet by tier ───────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
x = np.arange(3)
bottoms = np.zeros(3)
for mode in modes_order:
    vals = np.array([fleet_at_tier[t].get(mode, 0) for t in tiers_order])
    bars = ax.bar(x, vals, bottom=bottoms, color=MODE_COLORS[mode], label=MODE_LABELS[mode],
                  width=0.52, zorder=2)
    for xi, (v, b) in enumerate(zip(vals, bottoms)):
        if v > 12:
            ax.text(xi, b + v / 2, str(v), ha="center", va="center",
                    fontsize=9, fontweight="600", color="white")
    bottoms += vals

ax.set_xticks(x)
ax.set_xticklabels([f"{HUB_LABELS[t]}\n({hub_counts[t]} hubs)" for t in tiers_order],
                   fontsize=10, fontweight="600")
ax.set_ylabel("Total fleet units", fontsize=10, color="#6E6E73", labelpad=8)
ax.yaxis.grid(True, color="#E8E8ED", zorder=0)
ax.set_axisbelow(True)
leg = ax.legend(loc="upper right", fontsize=8, frameon=False,
                ncol=2, labelspacing=0.4, columnspacing=0.8)
ax.set_title("Total Fleet by Hub Tier", fontsize=12, fontweight="700",
             pad=12, loc="left", color="#1A1A1A")
fig.tight_layout(pad=1.8)
fig.savefig(os.path.join(OUT, "hub_stacked_bar.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_stacked_bar.png")

# ─── (c) HUB PROFILE CARDS ───────────────────────────────────────────────────
fig = plt.figure(figsize=(11, 4.2))
gs = GridSpec(1, 3, figure=fig, wspace=0.06)

card_data = {
    "hub_l": {
        "modes": ["car_sharing_ev", "autonomous_bus", "autonomous_shuttle", "autonomous_pod"],
        "desc": "Large interchange hub\n(parking garage / transit node)",
    },
    "hub_m": {
        "modes": ["autonomous_shuttle", "autonomous_pod", "e_bike"],
        "desc": "District mobility hub\n(street-level, covered)",
    },
    "hub_s": {
        "modes": ["e_bike", "autonomous_pod"],
        "desc": "Neighbourhood micro-hub\n(on-street docking)",
    },
}

for col, tier in enumerate(tiers_order):
    ax = fig.add_subplot(gs[0, col])
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis("off")

    # Card background
    rect = mpatches.FancyBboxPatch((0.04, 0.04), 0.92, 0.92,
                                    boxstyle="round,pad=0.02",
                                    linewidth=1.5,
                                    edgecolor=HUB_COLORS[tier],
                                    facecolor="#F9F9F9")
    ax.add_patch(rect)

    # Header strip
    header = mpatches.FancyBboxPatch((0.04, 0.78), 0.92, 0.18,
                                      boxstyle="round,pad=0.01",
                                      linewidth=0,
                                      facecolor=HUB_COLORS[tier])
    ax.add_patch(header)
    ax.text(0.50, 0.875, HUB_LABELS[tier], ha="center", va="center",
            fontsize=15, fontweight="800", color="white", transform=ax.transAxes)

    # Hub count badge
    ax.text(0.50, 0.715, f"{hub_counts[tier]} hubs", ha="center", va="center",
            fontsize=10, fontweight="600", color=HUB_COLORS[tier], transform=ax.transAxes)
    ax.text(0.50, 0.665, card_data[tier]["desc"], ha="center", va="center",
            fontsize=7.5, color="#6E6E73", transform=ax.transAxes, linespacing=1.4)

    # Fleet rows
    y = 0.595
    for mode in card_data[tier]["modes"]:
        qty = fleet_per_hub[tier].get(mode, 0)
        if qty == 0:
            continue
        dot_x = 0.13
        ax.plot(dot_x, y, "o", markersize=6, color=MODE_COLORS[mode], transform=ax.transAxes, clip_on=False)
        ax.text(dot_x + 0.09, y, MODE_LABELS[mode], ha="left", va="center",
                fontsize=9, color="#1A1A1A", transform=ax.transAxes)
        ax.text(0.90, y, f"{qty}", ha="right", va="center",
                fontsize=9, fontweight="700", color="#1A1A1A", transform=ax.transAxes)
        y -= 0.10

    # Divider
    y -= 0.02
    ax.plot([0.08, 0.92], [y, y], color="#E8E8ED", linewidth=0.8, transform=ax.transAxes)
    y -= 0.06

    # Charging & footprint
    ax.text(0.13, y, "Charging points", ha="left", va="center",
            fontsize=9, color="#6E6E73", transform=ax.transAxes)
    ax.text(0.90, y, f"{charging_per_hub[tier]}", ha="right", va="center",
            fontsize=9, fontweight="700", color="#1A1A1A", transform=ax.transAxes)
    y -= 0.09
    ax.text(0.13, y, "Footprint", ha="left", va="center",
            fontsize=9, color="#6E6E73", transform=ax.transAxes)
    ax.text(0.90, y, f"{footprint_per_hub[tier]:,} m2", ha="right", va="center",
            fontsize=9, fontweight="700", color="#1A1A1A", transform=ax.transAxes)

fig.suptitle("Hub Profile Cards", fontsize=13, fontweight="700",
             x=0.06, ha="left", y=1.01, color="#1A1A1A")
fig.tight_layout(pad=1.2)
fig.savefig(os.path.join(OUT, "hub_profile_cards.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_profile_cards.png")

# ─── (d) SUMMARY CARD 2×3 ────────────────────────────────────────────────────
fig, axes = plt.subplots(2, 3, figsize=(9, 4.2))
fig.patch.set_facecolor("white")

summary_cells = [
    # row 0
    {"label": "Hub L",        "value": str(hub_l_count),   "sub": "large hubs",         "color": HUB_COLORS["hub_l"]},
    {"label": "Hub M",        "value": str(hub_m_count),   "sub": "district hubs",       "color": HUB_COLORS["hub_m"]},
    {"label": "Hub S",        "value": str(hub_s_count),   "sub": "micro-hubs",          "color": HUB_COLORS["hub_s"]},
    # row 1
    {"label": "Total Charging","value": f"{total_charging:,}", "sub": "charging points",  "color": "#2980B9"},
    {"label": "Hub Footprint", "value": f"{total_footprint:,}", "sub": f"m²  ({footprint_pct:.1f}% of zone)", "color": "#E67E22"},
    {"label": "Total Fleet",   "value": f"{sum(fleet_total.values()):,}", "sub": "vehicles + bikes", "color": "#8E44AD"},
]

for idx, (ax, cell) in enumerate(zip(axes.flat, summary_cells)):
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    rect = mpatches.FancyBboxPatch((0.04, 0.06), 0.92, 0.88,
                                    boxstyle="round,pad=0.03",
                                    linewidth=1.2,
                                    edgecolor=cell["color"] + "55",
                                    facecolor=cell["color"] + "0D")
    ax.add_patch(rect)
    top_strip = mpatches.FancyBboxPatch((0.04, 0.76), 0.92, 0.18,
                                         boxstyle="round,pad=0.01",
                                         linewidth=0,
                                         facecolor=cell["color"] + "22")
    ax.add_patch(top_strip)
    ax.text(0.50, 0.855, cell["label"], ha="center", va="center",
            fontsize=9.5, fontweight="700", color=cell["color"], transform=ax.transAxes)
    ax.text(0.50, 0.52, cell["value"], ha="center", va="center",
            fontsize=22, fontweight="300", color="#1A1A1A", transform=ax.transAxes, linespacing=1)
    ax.text(0.50, 0.22, cell["sub"], ha="center", va="center",
            fontsize=8, color="#6E6E73", transform=ax.transAxes)

fig.suptitle("Hub Network Summary", fontsize=13, fontweight="700",
             x=0.04, ha="left", y=1.03, color="#1A1A1A")
plt.subplots_adjust(wspace=0.06, hspace=0.12, left=0.02, right=0.98, top=0.93, bottom=0.04)
fig.savefig(os.path.join(OUT, "hub_summary_card.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_summary_card.png")
print("\nAll hub outputs saved.\n")
