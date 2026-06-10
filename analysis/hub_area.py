"""
Hub area calculation — Wolfsburg City Centre
S_hub = S_fleet + S_circulation + S_charging + S_program
Inputs: fleet_per_hub values from hub_calculation.py (fixed — do not recalculate)
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

ceil = math.ceil

# --- INPUT: fleet per hub (from hub_calculation.py, incl. 20% reserve) -------
fleet_per_hub = {
    "hub_l": {"e_bike": 0,  "autonomous_shuttle": 6,  "autonomous_bus": 7,  "autonomous_pod": 23, "car_sharing_ev": 35},
    "hub_m": {"e_bike": 13, "autonomous_shuttle": 2,  "autonomous_bus": 0,  "autonomous_pod": 12, "car_sharing_ev": 0 },
    "hub_s": {"e_bike": 13, "autonomous_shuttle": 0,  "autonomous_bus": 0,  "autonomous_pod": 3,  "car_sharing_ev": 0 },
}
hub_counts = {"hub_l": 6, "hub_m": 19, "hub_s": 43}

# --- AREA PARAMETERS ---------------------------------------------------------
footprint_per_unit = {
    "e_bike":             2.5,   # m2 — rack + clearance
    "autonomous_pod":     10,    # m2 — compact vehicle
    "autonomous_shuttle": 35,    # m2 — minibus
    "autonomous_bus":     60,    # m2 — full-size bus
    "car_sharing_ev":     15,    # m2 — standard car
}
charging_station_footprint = {
    "e_bike": 0.5,   # m2 per dock
    "other":  4.0,   # m2 per EV charger
}
charging_rate = {
    "e_bike": 0.50, "autonomous_pod": 0.30,
    "autonomous_shuttle": 0.30, "autonomous_bus": 0.30, "car_sharing_ev": 0.30,
}
circulation_factor = {
    "hub_l": 1.60,  # large depot — wide driveways
    "hub_m": 1.40,  # district node
    "hub_s": 1.20,  # minimal on-street point
}
PROGRAM_SHARE = 0.10  # 10% of (fleet×circ + charging) for shelter, info, waiting

MODES = ["e_bike", "autonomous_shuttle", "autonomous_bus", "autonomous_pod", "car_sharing_ev"]
TIERS = ["hub_l", "hub_m", "hub_s"]
HUB_LABELS = {"hub_l": "Hub L", "hub_m": "Hub M", "hub_s": "Hub S"}
HUB_COLORS = {"hub_l": "#1A1A1A", "hub_m": "#2D6A4F", "hub_s": "#95B8A0"}
MODE_COLORS = {
    "e_bike": "#27AE60", "autonomous_shuttle": "#8E44AD",
    "autonomous_bus": "#2C3E50", "autonomous_pod": "#2980B9", "car_sharing_ev": "#E67E22",
}
MODE_LABELS = {
    "e_bike": "E-Bike", "autonomous_shuttle": "Auto Shuttle",
    "autonomous_bus": "Auto Bus", "autonomous_pod": "Auto Pod", "car_sharing_ev": "Car-Share EV",
}

# --- STEP 1 — S_fleet  (raw parking footprint) --------------------------------
S_fleet = {}
for tier in TIERS:
    S_fleet[tier] = sum(
        fleet_per_hub[tier].get(mode, 0) * footprint_per_unit[mode]
        for mode in MODES
    )

# --- STEP 2 — S_circulation  (factor - 1) × S_fleet -------------------------
S_circ = {tier: S_fleet[tier] * (circulation_factor[tier] - 1) for tier in TIERS}

# --- STEP 3 — S_charging -----------------------------------------------------
S_charging = {}
charging_detail = {}
for tier in TIERS:
    detail = {}
    for mode in MODES:
        n = fleet_per_hub[tier].get(mode, 0)
        chargers = ceil(n * charging_rate[mode])
        fp = charging_station_footprint["e_bike"] if mode == "e_bike" else charging_station_footprint["other"]
        detail[mode] = chargers * fp
    charging_detail[tier] = detail
    S_charging[tier] = sum(detail.values())

# --- STEP 4 — S_program (10% of sub-total) -----------------------------------
S_sub = {tier: S_fleet[tier] + S_circ[tier] + S_charging[tier] for tier in TIERS}
S_program = {tier: S_sub[tier] * PROGRAM_SHARE for tier in TIERS}

# --- TOTAL PER HUB -----------------------------------------------------------
S_hub = {tier: S_fleet[tier] + S_circ[tier] + S_charging[tier] + S_program[tier] for tier in TIERS}

# --- TOTALS ACROSS ALL HUBS --------------------------------------------------
zone_area_m2         = 4_000_000
total_area_all_hubs  = sum(S_hub[t] * hub_counts[t] for t in TIERS)
total_footprint_pct  = total_area_all_hubs / zone_area_m2 * 100

# --- CONSOLE OUTPUT ----------------------------------------------------------
print("\n" + "="*60)
print("HUB AREA BREAKDOWN  (m2 per single hub)")
print("="*60)
for tier in TIERS:
    print(f"\n{HUB_LABELS[tier]} ({hub_counts[tier]} hubs):")
    print(f"  S_fleet       {S_fleet[tier]:>8.1f} m2")
    print(f"  S_circulation {S_circ[tier]:>8.1f} m2  (factor {circulation_factor[tier]})")
    print(f"  S_charging    {S_charging[tier]:>8.1f} m2")
    print(f"  S_program     {S_program[tier]:>8.1f} m2  (10% of sub-total)")
    print(f"  {'-'*29}")
    print(f"  S_hub TOTAL   {S_hub[tier]:>8.1f} m2")
    print(f"  All {hub_counts[tier]} hubs    {S_hub[tier]*hub_counts[tier]:>8.1f} m2")

print(f"\n{'='*60}")
print(f"TOTAL HUB FOOTPRINT:  {total_area_all_hubs:,.0f} m2  ({total_footprint_pct:.2f}% of 4 km2 zone)")
print(f"  ~ {total_area_all_hubs/10000:.2f} ha")
print("="*60 + "\n")

# --- EXPORT CSVs -------------------------------------------------------------
rows = []
for tier in TIERS:
    rows.append({
        "tier":        HUB_LABELS[tier],
        "hub_count":   hub_counts[tier],
        "S_fleet":     round(S_fleet[tier], 1),
        "S_circ":      round(S_circ[tier], 1),
        "S_charging":  round(S_charging[tier], 1),
        "S_program":   round(S_program[tier], 1),
        "S_hub":       round(S_hub[tier], 1),
        "S_all_hubs":  round(S_hub[tier] * hub_counts[tier], 1),
    })
df = pd.DataFrame(rows)
df.to_csv(os.path.join(OUT, "results_hub_area.csv"), index=False)
print(f"Saved -> {OUT}\\results_hub_area.csv")

# --- STYLE -------------------------------------------------------------------
plt.rcParams.update({
    "font.family": "sans-serif", "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.spines.left": False, "axes.spines.bottom": False,
    "xtick.bottom": False, "ytick.left": False,
    "figure.facecolor": "white", "axes.facecolor": "white",
})

COMP_COLORS = {
    "S_fleet":     "#2D6A4F",
    "S_circ":      "#52A882",
    "S_charging":  "#2980B9",
    "S_program":   "#BDC3C7",
}
COMP_LABELS = {
    "S_fleet":     "Fleet parking",
    "S_circ":      "Circulation",
    "S_charging":  "Charging",
    "S_program":   "Program / shelter",
}

# --- (a) Stacked horizontal bar — area components per hub --------------------
fig, ax = plt.subplots(figsize=(9, 3.4))
y_pos = np.arange(len(TIERS))
comp_keys = ["S_fleet", "S_circ", "S_charging", "S_program"]
comp_vals = {
    "S_fleet":    [S_fleet[t]    for t in TIERS],
    "S_circ":     [S_circ[t]     for t in TIERS],
    "S_charging": [S_charging[t] for t in TIERS],
    "S_program":  [S_program[t]  for t in TIERS],
}
lefts = np.zeros(len(TIERS))
for ck in comp_keys:
    vals = np.array(comp_vals[ck])
    bars = ax.barh(y_pos, vals, left=lefts, color=COMP_COLORS[ck],
                   label=COMP_LABELS[ck], height=0.5, zorder=2)
    for yi, (v, l) in enumerate(zip(vals, lefts)):
        if v > 15:
            ax.text(l + v/2, yi, f"{v:.0f}", ha="center", va="center",
                    fontsize=8, fontweight="600", color="white")
    lefts += vals

# Total labels at end of bar
for yi, tier in enumerate(TIERS):
    ax.text(S_hub[tier] + 12, yi, f"{S_hub[tier]:.0f} m2",
            va="center", fontsize=9, fontweight="700", color=HUB_COLORS[tier])

ax.set_yticks(y_pos)
ax.set_yticklabels([f"{HUB_LABELS[t]}\n({hub_counts[t]} hubs)" for t in TIERS],
                   fontsize=10, fontweight="600")
ax.tick_params(length=0)
ax.xaxis.grid(True, color="#E8E8ED", zorder=0)
ax.set_xlabel("m2 per hub", fontsize=10, color="#6E6E73")
ax.legend(loc="lower right", fontsize=8, frameon=False, ncol=4, columnspacing=1.0)
ax.set_title("Hub Area Breakdown  (m2 per single hub)", fontsize=12, fontweight="700",
             pad=12, loc="left", color="#1A1A1A")
fig.tight_layout(pad=1.8)
fig.savefig(os.path.join(OUT, "hub_area_breakdown.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_area_breakdown.png")

# --- (b) Total footprint — all hubs combined (stacked by tier) ---------------
fig, ax = plt.subplots(figsize=(6, 4))
tier_totals = [S_hub[t] * hub_counts[t] for t in TIERS]
bars = ax.bar(
    [HUB_LABELS[t] for t in TIERS],
    tier_totals,
    color=[HUB_COLORS[t] for t in TIERS],
    width=0.52, zorder=2
)
ax.yaxis.grid(True, color="#E8E8ED", zorder=0)
for bar, val in zip(bars, tier_totals):
    ax.text(bar.get_x() + bar.get_width()/2, val + 100, f"{val:,.0f} m2",
            ha="center", fontsize=9, fontweight="700", color=bar.get_facecolor())
ax.set_ylabel("Total footprint (m2)", fontsize=10, color="#6E6E73")
ax.set_title("Total Hub Footprint by Tier", fontsize=12, fontweight="700",
             pad=12, loc="left", color="#1A1A1A")
# annotate total
ax.text(0.98, 0.95, f"All hubs combined:\n{total_area_all_hubs:,.0f} m2  ({total_footprint_pct:.2f}% of zone)",
        transform=ax.transAxes, ha="right", va="top", fontsize=9,
        color="#1A1A1A", linespacing=1.5,
        bbox=dict(boxstyle="round,pad=0.4", facecolor="#F5F5F7", edgecolor="#E8E8ED", linewidth=1))
fig.tight_layout(pad=1.8)
fig.savefig(os.path.join(OUT, "hub_area_totals.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_area_totals.png")

# --- (c) Fleet footprint contribution per mode × tier ------------------------
fig, axes = plt.subplots(1, 3, figsize=(11, 3.8), sharey=False)
for ai, tier in enumerate(TIERS):
    ax = axes[ai]
    mode_areas = {m: fleet_per_hub[tier].get(m, 0) * footprint_per_unit[m] for m in MODES}
    non_zero  = {m: v for m, v in mode_areas.items() if v > 0}
    if non_zero:
        labels  = [MODE_LABELS[m]  for m in non_zero]
        colors  = [MODE_COLORS[m]  for m in non_zero]
        values  = list(non_zero.values())
        wedges, texts, autotexts = ax.pie(
            values, labels=None, colors=colors,
            autopct=lambda p: f"{p:.0f}%" if p > 5 else "",
            startangle=90, pctdistance=0.72,
            wedgeprops=dict(width=0.55, edgecolor="white", linewidth=2),
        )
        for at in autotexts:
            at.set_fontsize(9); at.set_fontweight("700"); at.set_color("white")
    ax.set_title(f"{HUB_LABELS[tier]}\n{S_fleet[tier]:.0f} m2 fleet area",
                 fontsize=10, fontweight="700", color=HUB_COLORS[tier], pad=8)

# Shared legend
legend_handles = [mpatches.Patch(color=MODE_COLORS[m], label=MODE_LABELS[m]) for m in MODES]
fig.legend(handles=legend_handles, loc="lower center", ncol=5, fontsize=8,
           frameon=False, columnspacing=1.0, handlelength=1.2, bbox_to_anchor=(0.5, -0.06))
fig.suptitle("Fleet Parking Area by Mode (S_fleet per hub)", fontsize=12, fontweight="700",
             x=0.04, ha="left", y=1.02, color="#1A1A1A")
plt.subplots_adjust(wspace=0.18, bottom=0.12)
fig.savefig(os.path.join(OUT, "hub_area_fleet_pie.png"), dpi=150, bbox_inches="tight")
plt.close(fig)
print("Saved -> hub_area_fleet_pie.png")

print("\nAll hub area outputs saved.\n")
