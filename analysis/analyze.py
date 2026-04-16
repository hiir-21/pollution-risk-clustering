"""
Pollution Risk Clustering — Gujarat Cities
DAV 16 | Hiir Jadav, Preet Kaur, Aarya Gogia, Vrushank Thakkar

Analysis Script
===============
Reads raw CPCB CSV files (GJ001, GJ002, GJ003, GJ005),
performs preprocessing, K-Means clustering, time-series
decomposition, and correlation analysis.

Usage:
    python analyze.py

Requirements:
    pip install pandas numpy scikit-learn scipy matplotlib seaborn

Place this file in the same folder as:
    GJ001.csv, GJ002.csv, GJ003.csv, GJ005.csv, stations_info.csv
"""

import os
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from scipy.stats import pearsonr

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

CITY_FILES = {
    "Ahmedabad":   "GJ001.csv",
    "Ankleshwar":  "GJ002.csv",
    "Vapi":        "GJ003.csv",
    "Gandhinagar": "GJ005.csv",
}

# Standardised pollutant column names → short keys
POLLUTANT_MAP = {
    "PM2.5 (ug/m3)": "PM2.5",
    "PM10 (ug/m3)":  "PM10",
    "NO2 (ug/m3)":   "NO2",
    "SO2 (ug/m3)":   "SO2",
    "CO (mg/m3)":    "CO",
    "Ozone (ug/m3)": "O3",
}

POLLUTANTS   = list(POLLUTANT_MAP.values())   # ['PM2.5','PM10','NO2','SO2','CO','O3']
CITY_COLORS  = {
    "Ahmedabad":  "#E05C2A",
    "Ankleshwar": "#9333EA",
    "Vapi":       "#C41E1E",
    "Gandhinagar":"#2D8A5E",
}
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — LOAD & CLEAN RAW DATA
# ─────────────────────────────────────────────────────────────────────────────

def load_city(fname: str, city: str) -> pd.DataFrame:
    """
    Load one city CSV, parse datetime, rename pollutant columns,
    remove IQR outliers, and interpolate short gaps.
    Returns a DataFrame indexed by datetime with columns = POLLUTANTS.
    """
    print(f"  Loading {fname}  ({city})")
    df = pd.read_csv(fname, low_memory=False)

    # Parse datetime — handle 'From Date' column
    df["datetime"] = pd.to_datetime(df["From Date"], errors="coerce")
    df = df.dropna(subset=["datetime"]).set_index("datetime").sort_index()

    out = pd.DataFrame(index=df.index)
    out["city"] = city

    for raw_col, short in POLLUTANT_MAP.items():
        if raw_col in df.columns:
            s = pd.to_numeric(df[raw_col], errors="coerce")

            # IQR × 3.0 outlier removal
            Q1, Q3 = s.quantile(0.25), s.quantile(0.75)
            IQR = Q3 - Q1
            lower, upper = Q1 - 3 * IQR, Q3 + 3 * IQR
            outliers_removed = ((s < lower) | (s > upper)).sum()
            s = s.where((s >= lower) & (s <= upper))

            # Linear interpolation — max gap 72 hours (3 days)
            filled = s.isna().sum()
            s = s.interpolate(method="linear", limit=72)
            filled -= s.isna().sum()

            out[short] = s
            print(f"    {short}: avg={s.mean():.1f}, coverage={s.notna().mean()*100:.0f}%, "
                  f"outliers_removed={outliers_removed}, gaps_filled={filled}")
        else:
            out[short] = np.nan
            print(f"    {short}: NOT FOUND in {fname}")

    return out


print("=" * 65)
print("STEP 1 — Loading and cleaning raw CPCB data")
print("=" * 65)
raw = {}
for city, fname in CITY_FILES.items():
    if not os.path.exists(fname):
        print(f"  ERROR: {fname} not found. Place it in the same folder as analyze.py")
        continue
    raw[city] = load_city(fname, city)

print(f"\n  Cities loaded: {list(raw.keys())}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — MONTHLY AGGREGATION
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 2 — Aggregating hourly → monthly averages")
print("=" * 65)

monthly = {}
for city, df in raw.items():
    m = df[POLLUTANTS].resample("ME").mean()
    # Drop months with < 50% coverage (< ~360 hourly readings)
    counts = df[POLLUTANTS].resample("ME").count()
    # Use PM2.5 as reference for coverage filter
    min_readings = 360
    m = m[counts["PM2.5"] >= min_readings]
    monthly[city] = m
    print(f"  {city}: {len(m)} valid monthly records ({m.index[0].strftime('%Y-%m')} → {m.index[-1].strftime('%Y-%m')})")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — CITY-LEVEL FEATURE MATRIX
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 3 — Building city-level feature matrix")
print("=" * 65)

features = {}
for city, m in monthly.items():
    row = {}
    for p in POLLUTANTS:
        row[p + "_mean"] = m[p].mean()
        row[p + "_std"]  = m[p].std()

    # Seasonal amplitude: Nov–Feb avg minus Jun–Sep avg (for PM2.5)
    winter = m[m.index.month.isin([11, 12, 1, 2])]["PM2.5"].mean()
    summer = m[m.index.month.isin([6, 7, 8, 9])]["PM2.5"].mean()
    row["seasonal_amplitude"] = winter - summer

    # Trend slope (PM2.5): linear regression coefficient over time
    pm25_valid = m["PM2.5"].dropna()
    if len(pm25_valid) > 5:
        x = np.arange(len(pm25_valid))
        slope = np.polyfit(x, pm25_valid.values, 1)[0]
        row["trend_slope"] = slope
    else:
        row["trend_slope"] = 0.0

    features[city] = row

feature_df = pd.DataFrame(features).T
print("\n  Feature matrix (before normalisation):")
print(feature_df.round(2).to_string())

# Min-Max normalisation
scaler = MinMaxScaler()
feature_scaled = pd.DataFrame(
    scaler.fit_transform(feature_df),
    index=feature_df.index,
    columns=feature_df.columns
)
print("\n  Feature matrix (after Min-Max normalisation):")
print(feature_scaled.round(3).to_string())

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — K-MEANS CLUSTERING
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 4 — K-Means clustering (Elbow + Silhouette)")
print("=" * 65)

X = feature_scaled.values
inertias = []
silhouettes = []
k_range = range(2, len(X))

for k in k_range:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X)
    inertias.append(km.inertia_)
    if k < len(X):  # silhouette needs at least 2 clusters with >1 sample
        try:
            sil = silhouette_score(X, labels)
            silhouettes.append(sil)
        except Exception:
            silhouettes.append(np.nan)
    else:
        silhouettes.append(np.nan)
    print(f"  k={k}: inertia={km.inertia_:.4f}, silhouette={silhouettes[-1]:.4f}")

best_k = k_range[np.argmax(silhouettes)]
print(f"\n  → Optimal k = {best_k} (highest silhouette: {max(silhouettes):.4f})")

# Final clustering with best_k
km_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
cluster_labels = km_final.fit_predict(X)

cluster_df = pd.DataFrame({
    "city":    feature_df.index,
    "cluster": cluster_labels,
    "PM2.5_mean": feature_df["PM2.5_mean"].values,
})

# Rank clusters by mean PM2.5 (0=lowest, best_k-1=highest)
cluster_pm25_rank = cluster_df.groupby("cluster")["PM2.5_mean"].mean().sort_values()
risk_map = {c: i for i, c in enumerate(cluster_pm25_rank.index)}
risk_labels = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}
cluster_df["risk_tier"] = cluster_df["cluster"].map(risk_map).map(risk_labels)

print("\n  Cluster assignments:")
print(cluster_df[["city", "cluster", "PM2.5_mean", "risk_tier"]].to_string(index=False))

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — CORRELATION ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 5 — Pollutant correlation analysis")
print("=" * 65)

combined = pd.concat([df[POLLUTANTS] for df in raw.values()])
corr_matrix = combined.corr(method="pearson")
print("\n  Pearson correlation matrix (combined, all cities):")
print(corr_matrix.round(3).to_string())

# Highlight strongest pairs
print("\n  Notable correlations (|r| > 0.3):")
for i, p1 in enumerate(POLLUTANTS):
    for j, p2 in enumerate(POLLUTANTS):
        if j > i:
            r = corr_matrix.loc[p1, p2]
            if abs(r) > 0.3:
                print(f"    {p1} ↔ {p2}: r = {r:.3f}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — TIME-SERIES DECOMPOSITION
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 6 — Time-series decomposition (additive, 12-month rolling)")
print("=" * 65)

decomp_results = {}
for city, m in monthly.items():
    pm25 = m["PM2.5"].dropna()
    if len(pm25) < 14:
        print(f"  {city}: insufficient data for decomposition (n={len(pm25)}), skipping")
        continue

    # Trend: 12-month centered rolling mean
    trend = pm25.rolling(window=12, center=True, min_periods=6).mean()

    # Seasonal: average deviation from trend by calendar month
    residual_raw = pm25 - trend
    seasonal_avg = residual_raw.groupby(residual_raw.index.month).mean()
    seasonal = pd.Series(
        [seasonal_avg.get(d.month, 0) for d in pm25.index],
        index=pm25.index
    )

    # Residual: what remains after trend + seasonal
    residual = pm25 - trend - seasonal

    decomp_results[city] = {
        "observed": pm25,
        "trend":    trend,
        "seasonal": seasonal,
        "residual": residual,
    }

    print(f"\n  {city} ({len(pm25)} monthly points):")
    print(f"    Trend range:    {trend.min():.1f} – {trend.max():.1f} μg/m³")
    print(f"    Seasonal range: {seasonal.min():.1f} to +{seasonal.max():.1f} μg/m³")
    print(f"    Residual std:   {residual.std():.2f} μg/m³")
    print(f"    Seasonal pattern (avg by month):")
    for mo, val in seasonal_avg.items():
        month_name = pd.Timestamp(2023, mo, 1).strftime("%b")
        bar = "█" * int(abs(val) / 3) if abs(val) >= 3 else "·"
        sign = "+" if val >= 0 else ""
        print(f"      {month_name}: {sign}{val:.1f}  {bar}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — SEASONAL ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 7 — Seasonal PM2.5 averages by month")
print("=" * 65)

seasonal_table = {}
for city, m in monthly.items():
    monthly_avg = m["PM2.5"].groupby(m.index.month).mean()
    seasonal_table[city] = monthly_avg

seasonal_df = pd.DataFrame(seasonal_table)
seasonal_df.index = [pd.Timestamp(2023, mo, 1).strftime("%b") for mo in seasonal_df.index]
print("\n  Monthly PM2.5 averages (μg/m³):")
print(seasonal_df.round(1).to_string())

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — ANNUAL TREND
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 8 — Annual PM2.5 averages")
print("=" * 65)

annual_table = {}
for city, m in monthly.items():
    # Only include years with >= 6 monthly records
    yearly = m["PM2.5"].resample("YE").agg(["mean", "count"])
    yearly = yearly[yearly["count"] >= 6]["mean"]
    annual_table[city] = yearly.rename(city)

annual_df = pd.concat(annual_table.values(), axis=1)
annual_df.index = annual_df.index.year
print("\n  Annual PM2.5 averages (μg/m³):")
print(annual_df.round(1).to_string())

# ─────────────────────────────────────────────────────────────────────────────
# STEP 9 — GENERATE VISUALISATIONS
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 9 — Generating visualisations")
print("=" * 65)

plt.style.use("seaborn-v0_8-whitegrid")
plt.rcParams.update({"font.family": "DejaVu Sans", "figure.dpi": 120})

# ── Fig 1: Elbow + Silhouette ──────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
fig.suptitle("K-Means Model Selection", fontsize=14, fontweight="bold", y=1.02)

axes[0].plot(list(k_range), inertias, "o-", color="#1A1A18", linewidth=2, markersize=7)
axes[0].axvline(x=best_k, color="#2D6A4F", linestyle="--", alpha=0.7, label=f"k={best_k}")
axes[0].set_xlabel("Number of clusters (k)")
axes[0].set_ylabel("Inertia")
axes[0].set_title("Elbow Method")
axes[0].legend()

axes[1].plot(list(k_range), silhouettes, "o-", color="#2D6A4F", linewidth=2, markersize=7)
axes[1].axvline(x=best_k, color="#2D6A4F", linestyle="--", alpha=0.7, label=f"k={best_k} (best)")
axes[1].set_xlabel("Number of clusters (k)")
axes[1].set_ylabel("Silhouette Score")
axes[1].set_title("Silhouette Score")
axes[1].legend()

plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig1_kmeans_selection.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ── Fig 2: Cluster bar chart ───────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(9, 4))
cities_sorted = cluster_df.sort_values("PM2.5_mean", ascending=True)
colors = [CITY_COLORS[c] for c in cities_sorted["city"]]
bars = ax.barh(cities_sorted["city"], cities_sorted["PM2.5_mean"], color=colors, alpha=0.85)
ax.axvline(x=15, color="#C41E1E", linestyle="--", linewidth=1.2, label="WHO guideline (15 μg/m³)")
for bar, (_, row) in zip(bars, cities_sorted.iterrows()):
    ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
            f"{row['PM2.5_mean']:.1f} — {row['risk_tier']}", va="center", fontsize=9)
ax.set_xlabel("Mean PM2.5 (μg/m³)")
ax.set_title("K-Means Cluster Results — Mean PM2.5 by City", fontweight="bold")
ax.legend()
plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig2_cluster_results.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ── Fig 3: Correlation heatmap ─────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(7, 6))
mask = np.zeros_like(corr_matrix, dtype=bool)
mask[np.triu_indices_from(mask, k=1)] = False
sns.heatmap(
    corr_matrix, annot=True, fmt=".2f", cmap="RdYlGn",
    vmin=-1, vmax=1, center=0, square=True, linewidths=0.5,
    ax=ax, cbar_kws={"shrink": 0.8}
)
ax.set_title("Pollutant Correlation Matrix (all cities combined)", fontweight="bold")
plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig3_correlation_matrix.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ── Fig 4: Time-series decomposition ──────────────────────────────────────
for city, components in decomp_results.items():
    fig = plt.figure(figsize=(12, 9))
    fig.suptitle(f"Time-Series Decomposition — {city} (PM2.5 μg/m³)", fontsize=13, fontweight="bold")
    gs = gridspec.GridSpec(4, 1, hspace=0.45)

    labels = ["Observed", "Trend (12-mo rolling)", "Seasonal component", "Residual"]
    keys   = ["observed", "trend", "seasonal", "residual"]
    colors_comp = [CITY_COLORS[city], "#2D6A4F", "#2563A8", "#92600A"]

    for i, (lbl, key, col) in enumerate(zip(labels, keys, colors_comp)):
        ax = fig.add_subplot(gs[i])
        s = components[key].dropna()
        ax.plot(s.index, s.values, color=col, linewidth=1.6)
        if key == "residual":
            ax.axhline(0, color="#9C9A92", linewidth=0.8, linestyle="--")
        ax.set_ylabel("μg/m³", fontsize=9)
        ax.set_title(lbl, fontsize=10, fontweight="bold", loc="left")
        ax.tick_params(axis="x", labelsize=8)

    path = os.path.join(OUTPUT_DIR, f"fig4_decomposition_{city.lower()}.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path}")

# ── Fig 5: Seasonal patterns ───────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(11, 5))
month_nums = range(1, 13)
month_labels = [pd.Timestamp(2023, m, 1).strftime("%b") for m in month_nums]

for city, m in monthly.items():
    monthly_avg = m["PM2.5"].groupby(m.index.month).mean()
    vals = [monthly_avg.get(mo, np.nan) for mo in month_nums]
    ax.plot(month_labels, vals, "o-", color=CITY_COLORS[city],
            linewidth=2, markersize=5, label=city)

ax.axhline(y=15, color="#C41E1E", linestyle="--", linewidth=1, alpha=0.7, label="WHO 15 μg/m³")
ax.axvspan(5, 8, alpha=0.06, color="#2563A8", label="Monsoon (Jun–Sep)")
ax.axvspan(0, 1, alpha=0.06, color="#E05C2A")
ax.axvspan(9, 11, alpha=0.06, color="#E05C2A", label="Winter peak (Oct–Feb)")
ax.set_xlabel("Month")
ax.set_ylabel("Mean PM2.5 (μg/m³)")
ax.set_title("Monthly Seasonal PM2.5 Patterns — All Cities", fontweight="bold")
ax.legend(loc="upper right", fontsize=9)
plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig5_seasonal_patterns.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ── Fig 6: Annual trend ────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 5))
for city in annual_df.columns:
    s = annual_df[city].dropna()
    ax.plot(s.index, s.values, "o-", color=CITY_COLORS[city],
            linewidth=2, markersize=6, label=city)
    ax.annotate(f"{s.iloc[-1]:.0f}", (s.index[-1], s.iloc[-1]),
                textcoords="offset points", xytext=(5, 0), fontsize=8, color=CITY_COLORS[city])

ax.axhline(y=15, color="#C41E1E", linestyle="--", linewidth=1, alpha=0.7, label="WHO 15 μg/m³")
ax.axvspan(2019.5, 2020.5, alpha=0.08, color="gray", label="COVID lockdown 2020")
ax.set_xlabel("Year")
ax.set_ylabel("Annual mean PM2.5 (μg/m³)")
ax.set_title("Annual PM2.5 Trend — Gujarat Cities", fontweight="bold")
ax.legend(fontsize=9)
plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig6_annual_trend.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 10 — SUMMARY REPORT
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 10 — Summary report")
print("=" * 65)

print("""
┌─────────────────────────────────────────────────────────────┐
│          POLLUTION RISK CLUSTERING — FINAL RESULTS          │
│          Gujarat Cities · CPCB Data 2019–2023               │
└─────────────────────────────────────────────────────────────┘
""")

print("  DATASET SUMMARY")
print("  " + "-" * 50)
total_rows = sum(len(df) for df in raw.values())
print(f"  Cities analysed : {len(raw)}")
print(f"  Total raw rows  : {total_rows:,}")
print(f"  Stations        : Maninagar (Ahmedabad), GIDC (Ankleshwar),")
print(f"                    Phase 1 GIDC (Vapi), Sector 10 (Gandhinagar)")
print(f"  Agency          : GPCB via CPCB Kaggle dataset")
print()

print("  CLUSTER RESULTS")
print("  " + "-" * 50)
for _, row in cluster_df.sort_values("PM2.5_mean", ascending=False).iterrows():
    print(f"  {row['city']:<14} PM2.5={row['PM2.5_mean']:.1f} μg/m³   → {row['risk_tier']}")
print()

print(f"  Optimal k       : {best_k}")
print(f"  Silhouette score: {max(silhouettes):.4f}")
print()

print("  KEY FINDINGS")
print("  " + "-" * 50)

# COVID dip
ahm_annual = annual_df["Ahmedabad"].dropna()
if 2019 in ahm_annual.index and 2020 in ahm_annual.index:
    covid_drop = (ahm_annual[2019] - ahm_annual[2020]) / ahm_annual[2019] * 100
    print(f"  COVID lockdown (Ahmedabad): PM2.5 dropped {covid_drop:.1f}% in 2020")

# Vapi trend
vapi_annual = annual_df["Vapi"].dropna()
if len(vapi_annual) >= 2:
    vapi_change = (vapi_annual.iloc[-1] - vapi_annual.iloc[0]) / vapi_annual.iloc[0] * 100
    print(f"  Vapi trend {vapi_annual.index[0]}–{vapi_annual.index[-1]}: "
          f"{vapi_annual.iloc[0]:.1f} → {vapi_annual.iloc[-1]:.1f} μg/m³ ({vapi_change:+.1f}%)")

# Seasonal amplitude
for city in decomp_results:
    s = decomp_results[city]["seasonal"]
    amp = s.max() - s.min()
    print(f"  {city} seasonal amplitude: {amp:.1f} μg/m³ (peak–trough)")

# Strongest correlation
max_r, max_pair = 0, ("", "")
for i, p1 in enumerate(POLLUTANTS):
    for j, p2 in enumerate(POLLUTANTS):
        if j > i:
            r = abs(corr_matrix.loc[p1, p2])
            if r > max_r:
                max_r, max_pair = r, (p1, p2)
print(f"  Strongest correlation: {max_pair[0]} ↔ {max_pair[1]} (r={max_r:.3f})")

print()
print("  OUTPUT FILES")
print("  " + "-" * 50)
for f in sorted(os.listdir(OUTPUT_DIR)):
    print(f"  outputs/{f}")

print("""
  ─────────────────────────────────────────────────────────
  All figures saved to outputs/ folder.
  These values are used in the React dashboard (App.jsx).
  ─────────────────────────────────────────────────────────
""")
