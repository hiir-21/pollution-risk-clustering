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
from sklearn.preprocessing import MinMaxScaler   # scales feature matrix to [0,1] range
from sklearn.cluster import KMeans               # unsupervised clustering algorithm
from sklearn.metrics import silhouette_score     # validates cluster quality
from scipy.stats import pearsonr                 # Pearson correlation (imported for completeness)

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# All project-level constants are defined here. To change cities or pollutants,
# update these dictionaries and the rest of the script adapts automatically.
# ─────────────────────────────────────────────────────────────────────────────

# Maps city name → CSV filename.
# City-to-file mapping was determined from stations_info.csv:
#   GJ001 = Ahmedabad, Maninagar station, GPCB, data from Nov 2010
#   GJ002 = Ankleshwar, GIDC station, GPCB, data from Feb 2019
#   GJ003 = Vapi, Phase 1 GIDC station, GPCB, data from Feb 2019
#   GJ005 = Gandhinagar, Sector 10 station, GPCB, data from Feb 2019
CITY_FILES = {
    "Ahmedabad":   "GJ001.csv",
    "Ankleshwar":  "GJ002.csv",
    "Vapi":        "GJ003.csv",
    "Gandhinagar": "GJ005.csv",
}

# Maps raw CPCB column names → short keys used throughout the script.
# CPCB files use verbose headers like "PM2.5 (ug/m3)"; we shorten them for clarity.
POLLUTANT_MAP = {
    "PM2.5 (ug/m3)": "PM2.5",   # Fine particulate matter <2.5μm — primary health indicator
    "PM10 (ug/m3)":  "PM10",    # Coarse particulates <10μm — dust, road particles
    "NO2 (ug/m3)":   "NO2",     # Nitrogen dioxide — traffic and industrial combustion
    "SO2 (ug/m3)":   "SO2",     # Sulphur dioxide — coal burning and chemical industry
    "CO (mg/m3)":    "CO",      # Carbon monoxide — incomplete combustion indicator
    "Ozone (ug/m3)": "O3",      # Ozone — photochemical; forms from NO2 + sunlight
}

# Ordered list of short pollutant keys — used as column names, loop targets, etc.
POLLUTANTS = list(POLLUTANT_MAP.values())   # ['PM2.5','PM10','NO2','SO2','CO','O3']

# Consistent colour per city — same colours used in App.jsx dashboard
CITY_COLORS = {
    "Ahmedabad":   "#E05C2A",
    "Ankleshwar":  "#9333EA",
    "Vapi":        "#C41E1E",
    "Gandhinagar": "#2D8A5E",
}

# All output PNG charts are saved to this folder
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)   # creates the folder if it doesn't already exist


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — LOAD & CLEAN RAW DATA
#
# Each CSV file is hourly sensor readings from one CPCB monitoring station.
# Three cleaning operations are applied per pollutant column:
#   1. Parse to numeric (non-numeric strings → NaN instead of crashing)
#   2. IQR × 3.0 outlier removal (replace extreme sensor errors with NaN)
#   3. Linear interpolation for short gaps ≤ 72 hours (3 days)
# ─────────────────────────────────────────────────────────────────────────────

def load_city(fname: str, city: str) -> pd.DataFrame:
    """
    Load one city CSV, parse datetime index, clean each pollutant column,
    and return a DataFrame with columns = POLLUTANTS indexed by datetime.
    """
    print(f"  Loading {fname}  ({city})")
    df = pd.read_csv(fname, low_memory=False)

    # Parse 'From Date' as datetime. errors='coerce' silently drops unparseable rows
    # (turns them into NaT). sort_index() ensures rows are in chronological order.
    df["datetime"] = pd.to_datetime(df["From Date"], errors="coerce")
    df = df.dropna(subset=["datetime"]).set_index("datetime").sort_index()

    # Create a clean output DataFrame — only city label and pollutant columns
    out = pd.DataFrame(index=df.index)
    out["city"] = city

    for raw_col, short in POLLUTANT_MAP.items():
        if raw_col in df.columns:
            # Convert to numeric — strings like "-" or blanks become NaN
            s = pd.to_numeric(df[raw_col], errors="coerce")

            # ── IQR × 3.0 Outlier Removal ──────────────────────────────────
            # Standard rule uses 1.5×IQR. We use 3× to keep real extreme events
            # (Diwali PM2.5 spike to 393 μg/m³) while only removing sensor faults
            # (negative readings, impossibly high values from instrument malfunction).
            Q1, Q3 = s.quantile(0.25), s.quantile(0.75)
            IQR = Q3 - Q1
            lower, upper = Q1 - 3 * IQR, Q3 + 3 * IQR
            outliers_removed = ((s < lower) | (s > upper)).sum()
            s = s.where((s >= lower) & (s <= upper))   # out-of-bounds values become NaN

            # ── Linear Interpolation for Short Gaps ────────────────────────
            # Fills NaN runs up to 72 consecutive hours with a straight line between
            # the last valid value before the gap and first valid value after.
            # Gaps > 72 hours are left as NaN — too long to interpolate reliably.
            # These longer gaps are simply excluded during monthly aggregation.
            filled = s.isna().sum()
            s = s.interpolate(method="linear", limit=72)
            filled -= s.isna().sum()   # count of NaNs actually filled

            out[short] = s
            print(f"    {short}: avg={s.mean():.1f}, coverage={s.notna().mean()*100:.0f}%, "
                  f"outliers_removed={outliers_removed}, gaps_filled={filled}")
        else:
            # Pollutant not measured at this station — leave column as NaN
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
#
# K-Means operates on city-level feature profiles, not hourly fluctuations.
# Aggregating to monthly means reduces 217K rows → ~227 monthly records.
#
# Quality filter: months with fewer than 360 valid PM2.5 hourly readings
# (= 50% of 720 hours in a 30-day month) are dropped entirely.
# This prevents monthly averages computed from mostly-missing data.
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 2 — Aggregating hourly → monthly averages")
print("=" * 65)

monthly = {}
for city, df in raw.items():
    # resample('ME') = 'Month End' — groups all rows by calendar month
    m = df[POLLUTANTS].resample("ME").mean()

    # Count valid (non-NaN) readings per pollutant per month for quality check
    counts = df[POLLUTANTS].resample("ME").count()

    # Use PM2.5 count as the quality gate — if PM2.5 data is sparse,
    # the whole month is unreliable regardless of other pollutants
    min_readings = 360
    m = m[counts["PM2.5"] >= min_readings]
    monthly[city] = m
    print(f"  {city}: {len(m)} valid monthly records ({m.index[0].strftime('%Y-%m')} → {m.index[-1].strftime('%Y-%m')})")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — CITY-LEVEL FEATURE MATRIX
#
# K-Means needs a 2D numeric matrix: one row per city, one column per feature.
# We engineer 14 features per city:
#   - mean and std of each of 6 pollutants (12 features total)
#   - seasonal_amplitude: winter avg PM2.5 minus monsoon avg PM2.5
#   - trend_slope: linear regression coefficient of monthly PM2.5 over time
#
# Then we apply Min-Max normalisation so all features contribute equally
# to Euclidean distance calculations in K-Means. Without normalisation,
# PM10 (range ~0–952) would dominate over CO (range ~0–5).
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 3 — Building city-level feature matrix")
print("=" * 65)

features = {}
for city, m in monthly.items():
    row = {}

    # Features 1–12: mean and standard deviation of each pollutant.
    # Mean captures average pollution level; std captures temporal variability.
    for p in POLLUTANTS:
        row[p + "_mean"] = m[p].mean()
        row[p + "_std"]  = m[p].std()

    # Feature 13: Seasonal amplitude (winter PM2.5 minus monsoon PM2.5).
    # Captures how much a city's pollution swings between seasons.
    # High amplitude = heavily weather-driven (temperature inversions).
    # Vapi has the largest amplitude (~103 μg/m³); Gandhinagar the smallest (~25).
    winter = m[m.index.month.isin([11, 12, 1, 2])]["PM2.5"].mean()   # Nov–Feb
    summer = m[m.index.month.isin([6, 7, 8, 9])]["PM2.5"].mean()    # Jun–Sep (monsoon)
    row["seasonal_amplitude"] = winter - summer

    # Feature 14: Trend slope of PM2.5 over time.
    # np.polyfit fits y = m*x + c; we extract m (slope in μg/m³ per month).
    # Positive slope = pollution worsening. Negative = improving.
    # Vapi: +0.85 (worsening fast). Ahmedabad: -0.47 (improving).
    pm25_valid = m["PM2.5"].dropna()
    if len(pm25_valid) > 5:
        x = np.arange(len(pm25_valid))        # time steps: 0, 1, 2, ..., n-1
        slope = np.polyfit(x, pm25_valid.values, 1)[0]   # index [0] = slope
        row["trend_slope"] = slope
    else:
        row["trend_slope"] = 0.0   # insufficient data for meaningful slope

    features[city] = row

# Construct 4×14 DataFrame (4 cities = rows, 14 engineered features = columns)
feature_df = pd.DataFrame(features).T
print("\n  Feature matrix (before normalisation):")
print(feature_df.round(2).to_string())

# ── Min-Max Normalisation ───────────────────────────────────────────────────
# Formula per column: scaled = (x - min) / (max - min)
# Maps every feature into [0, 1] so no single feature dominates distance.
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
#
# We try k=2 and k=3 (max sensible k = n_cities − 1 = 3) and evaluate using:
#
#   Elbow Method (Inertia):
#     Inertia = total within-cluster sum of squared distances to centroid.
#     Lower inertia = tighter, more compact clusters. We look for the "elbow"
#     where adding one more cluster gives diminishing returns.
#     k=2 inertia=4.41, k=3 inertia=0.99 → large drop confirms k=3 is the elbow.
#
#   Silhouette Score:
#     For each data point: a = mean distance to other points in same cluster,
#     b = mean distance to points in the nearest OTHER cluster.
#     Score = (b − a) / max(a, b). Range: −1 (wrong cluster) to +1 (perfect).
#     k=3 gives silhouette=0.20, which is the highest achievable with 4 cities.
#     (Note: with only 4 data points, silhouette is inherently limited.)
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 4 — K-Means clustering (Elbow + Silhouette)")
print("=" * 65)

X = feature_scaled.values   # numpy array shape (4, 14): 4 cities × 14 features

inertias    = []
silhouettes = []
# k must be at least 2 and at most n_samples − 1 (can't have more clusters than cities)
k_range = range(2, len(X))

for k in k_range:
    # n_init=10: run 10 times with different random centroid seeds, keep best result.
    #   Prevents getting stuck in a bad local minimum.
    # random_state=42: fixed seed for reproducibility — same result every run.
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X)       # assigns each city to a cluster (0, 1, ..., k-1)
    inertias.append(km.inertia_)     # total within-cluster sum of squares

    if k < len(X):
        try:
            sil = silhouette_score(X, labels)
            silhouettes.append(sil)
        except Exception:
            silhouettes.append(np.nan)
    else:
        silhouettes.append(np.nan)
    print(f"  k={k}: inertia={km.inertia_:.4f}, silhouette={silhouettes[-1]:.4f}")

# Select k with highest silhouette score
best_k = k_range[np.argmax(silhouettes)]
print(f"\n  → Optimal k = {best_k} (highest silhouette: {max(silhouettes):.4f})")

# ── Final Clustering with best_k ────────────────────────────────────────────
km_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
cluster_labels = km_final.fit_predict(X)   # array of cluster IDs, e.g. [1, 1, 2, 0]

cluster_df = pd.DataFrame({
    "city":       feature_df.index,
    "cluster":    cluster_labels,
    "PM2.5_mean": feature_df["PM2.5_mean"].values,
})

# ── Risk Tier Labelling ──────────────────────────────────────────────────────
# K-Means cluster IDs are arbitrary integers (0, 1, 2). We rank clusters by
# their average PM2.5 so the lowest-pollution cluster → "Low Risk" and the
# highest → "High Risk". This makes labels meaningful and reproducible.
cluster_pm25_rank = cluster_df.groupby("cluster")["PM2.5_mean"].mean().sort_values()
risk_map    = {c: i for i, c in enumerate(cluster_pm25_rank.index)}   # old_id → rank
risk_labels = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}
cluster_df["risk_tier"] = cluster_df["cluster"].map(risk_map).map(risk_labels)

print("\n  Cluster assignments:")
print(cluster_df[["city", "cluster", "PM2.5_mean", "risk_tier"]].to_string(index=False))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — CORRELATION ANALYSIS
#
# Pearson correlation coefficient r measures the linear relationship between
# two variables. r = +1 means perfect positive, 0 = no linear relationship,
# -1 = perfect negative correlation.
#
# We concatenate all 4 city hourly DataFrames and compute a 6×6 matrix.
# Using all cities combined shows correlations across the full dataset,
# not just within one city.
#
# Key findings:
#   PM2.5–PM10: r=0.79  → both from combustion, tend to rise/fall together
#   NO2–SO2:    r=0.44  → industrial co-emission (high in Ahmedabad)
#   O3 ↔ all:  r≈0     → O3 is photochemical, forms independently of combustion
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 5 — Pollutant correlation analysis")
print("=" * 65)

# Combine all 4 city hourly DataFrames into one (total ~217K rows)
combined = pd.concat([df[POLLUTANTS] for df in raw.values()])

# pandas .corr() computes Pearson r for every pair of columns
corr_matrix = combined.corr(method="pearson")
print("\n  Pearson correlation matrix (combined, all cities):")
print(corr_matrix.round(3).to_string())

# Print only strong/moderate correlations (|r| > 0.3) for easy reading
print("\n  Notable correlations (|r| > 0.3):")
for i, p1 in enumerate(POLLUTANTS):
    for j, p2 in enumerate(POLLUTANTS):
        if j > i:   # upper triangle only — avoids printing each pair twice
            r = corr_matrix.loc[p1, p2]
            if abs(r) > 0.3:
                print(f"    {p1} ↔ {p2}: r = {r:.3f}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — TIME-SERIES DECOMPOSITION
#
# Additive model: Observed = Trend + Seasonal + Residual
#
# TREND: 12-month centered rolling mean.
#   - window=12 exactly covers one year, cancelling the seasonal cycle.
#   - center=True makes the trend lag-free (uses future and past months equally).
#   - min_periods=6 allows computing trend even near series edges.
#   - First and last 6 months have NaN trend (insufficient window data).
#
# SEASONAL: Calendar-month average deviation from trend.
#   - Step 1: subtract trend → leftover = seasonal + noise
#   - Step 2: group by month number (1–12), take mean → noise cancels out
#   - Result: 12 values representing the "typical" monthly deviation from trend
#   - E.g. Vapi January is typically +56 μg/m³ above trend (winter inversion peak)
#
# RESIDUAL: Observed − Trend − Seasonal.
#   - Ideally centred at zero (random noise).
#   - Systematic patterns in residual = events the model didn't capture.
#   - COVID lockdown (Apr–Jun 2020): large NEGATIVE residual in Ahmedabad.
#     PM2.5 dropped far below what trend+seasonal predicted → industrial shutdown.
#
# Why additive not multiplicative?
#   The seasonal amplitude (winter peak minus monsoon trough) stays roughly
#   constant across years regardless of the trend level — this is the defining
#   characteristic of additive seasonality.
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 6 — Time-series decomposition (additive, 12-month rolling)")
print("=" * 65)

decomp_results = {}
for city, m in monthly.items():
    pm25 = m["PM2.5"].dropna()

    # Need at least 14 monthly records for a meaningful 12-month rolling window
    if len(pm25) < 14:
        print(f"  {city}: insufficient data for decomposition (n={len(pm25)}), skipping")
        continue

    # TREND: 12-month centered rolling mean
    trend = pm25.rolling(window=12, center=True, min_periods=6).mean()

    # SEASONAL: average monthly deviation from trend across all available years
    residual_raw = pm25 - trend                                    # seasonal + noise
    seasonal_avg = residual_raw.groupby(residual_raw.index.month).mean()  # 12 monthly values

    # Expand the 12 monthly averages back into the full time series index
    seasonal = pd.Series(
        [seasonal_avg.get(d.month, 0) for d in pm25.index],
        index=pm25.index
    )

    # RESIDUAL: what remains after removing both trend and seasonal components
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
#
# Compute the average PM2.5 for each calendar month across all available years.
# For Ahmedabad (84 monthly records, 2015–2022), each monthly average is the
# mean of ~7 observations of that calendar month. This gives a robust, stable
# seasonal fingerprint for each city — the data used in the Seasonal slide.
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 7 — Seasonal PM2.5 averages by month")
print("=" * 65)

seasonal_table = {}
for city, m in monthly.items():
    # Group all monthly rows by calendar month number (1=Jan, 12=Dec) and average
    monthly_avg = m["PM2.5"].groupby(m.index.month).mean()
    seasonal_table[city] = monthly_avg

seasonal_df = pd.DataFrame(seasonal_table)
seasonal_df.index = [pd.Timestamp(2023, mo, 1).strftime("%b") for mo in seasonal_df.index]
print("\n  Monthly PM2.5 averages (μg/m³):")
print(seasonal_df.round(1).to_string())


# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — ANNUAL TREND
#
# Aggregate monthly → annual PM2.5 mean per city.
# Quality filter: only include years with ≥ 6 valid monthly records (half year).
# This prevents distorted annual averages from incomplete years
# (e.g. Ahmedabad data only starts in Feb 2015, so 2015 has 10 valid months).
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 8 — Annual PM2.5 averages")
print("=" * 65)

annual_table = {}
for city, m in monthly.items():
    # resample('YE') = Year End — groups monthly records by calendar year
    # .agg(['mean','count']) computes both the average and the number of months
    yearly = m["PM2.5"].resample("YE").agg(["mean", "count"])

    # Drop years where fewer than 6 months of data are available
    yearly = yearly[yearly["count"] >= 6]["mean"]
    annual_table[city] = yearly.rename(city)

annual_df = pd.concat(annual_table.values(), axis=1)
annual_df.index = annual_df.index.year   # convert Timestamp index to integer year
print("\n  Annual PM2.5 averages (μg/m³):")
print(annual_df.round(1).to_string())


# ─────────────────────────────────────────────────────────────────────────────
# STEP 9 — GENERATE VISUALISATIONS
#
# Produces 6 PNG charts saved to outputs/ folder:
#   fig1: K-Means model selection (Elbow + Silhouette)
#   fig2: Cluster results bar chart with WHO guideline
#   fig3: Pollutant correlation heatmap
#   fig4: Time-series decomposition (one chart per city)
#   fig5: Monthly seasonal PM2.5 patterns
#   fig6: Annual PM2.5 trend with COVID annotation
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("STEP 9 — Generating visualisations")
print("=" * 65)

plt.style.use("seaborn-v0_8-whitegrid")
plt.rcParams.update({"font.family": "DejaVu Sans", "figure.dpi": 120})

# ── Fig 1: Elbow + Silhouette ──────────────────────────────────────────────
# Two-panel chart showing how k=3 was selected objectively
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

# ── Fig 2: Cluster results bar chart ──────────────────────────────────────
# Horizontal bars ranked by mean PM2.5; WHO guideline shown as red dashed line
fig, ax = plt.subplots(figsize=(9, 4))
cities_sorted = cluster_df.sort_values("PM2.5_mean", ascending=True)   # lowest at bottom
colors = [CITY_COLORS[c] for c in cities_sorted["city"]]
bars = ax.barh(cities_sorted["city"], cities_sorted["PM2.5_mean"], color=colors, alpha=0.85)

# WHO annual PM2.5 guideline = 15 μg/m³ — all cities exceed this significantly
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
# Green = strong positive correlation, Red = negative, White = no correlation
fig, ax = plt.subplots(figsize=(7, 6))
mask = np.zeros_like(corr_matrix, dtype=bool)
mask[np.triu_indices_from(mask, k=1)] = False   # show full matrix (both triangles)
sns.heatmap(
    corr_matrix, annot=True, fmt=".2f", cmap="RdYlGn",
    vmin=-1, vmax=1, center=0,     # colour scale from red (−1) to green (+1)
    square=True, linewidths=0.5,
    ax=ax, cbar_kws={"shrink": 0.8}
)
ax.set_title("Pollutant Correlation Matrix (all cities combined)", fontweight="bold")
plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig3_correlation_matrix.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ── Fig 4: Time-series decomposition — one 4-panel chart per city ─────────
for city, components in decomp_results.items():
    fig = plt.figure(figsize=(12, 9))
    fig.suptitle(f"Time-Series Decomposition — {city} (PM2.5 μg/m³)", fontsize=13, fontweight="bold")

    # GridSpec: 4 equal-height subplots stacked vertically, hspace = vertical spacing
    gs = gridspec.GridSpec(4, 1, hspace=0.45)

    labels      = ["Observed", "Trend (12-mo rolling)", "Seasonal component", "Residual"]
    keys        = ["observed", "trend", "seasonal", "residual"]
    colors_comp = [CITY_COLORS[city], "#2D6A4F", "#2563A8", "#92600A"]

    for i, (lbl, key, col) in enumerate(zip(labels, keys, colors_comp)):
        ax = fig.add_subplot(gs[i])
        s = components[key].dropna()   # drop NaN edges from rolling trend
        ax.plot(s.index, s.values, color=col, linewidth=1.6)

        # Residual panel: add zero reference line — well-behaved residuals hug zero
        if key == "residual":
            ax.axhline(0, color="#9C9A92", linewidth=0.8, linestyle="--")

        ax.set_ylabel("μg/m³", fontsize=9)
        ax.set_title(lbl, fontsize=10, fontweight="bold", loc="left")
        ax.tick_params(axis="x", labelsize=8)

    path = os.path.join(OUTPUT_DIR, f"fig4_decomposition_{city.lower()}.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path}")

# ── Fig 5: Monthly seasonal PM2.5 — all cities on one chart ───────────────
# Shows the annual cycle clearly: monsoon dip (Jun–Sep) and winter peak (Nov–Feb)
fig, ax = plt.subplots(figsize=(11, 5))
month_nums   = range(1, 13)
month_labels = [pd.Timestamp(2023, m, 1).strftime("%b") for m in month_nums]

for city, m in monthly.items():
    monthly_avg = m["PM2.5"].groupby(m.index.month).mean()
    vals = [monthly_avg.get(mo, np.nan) for mo in month_nums]
    ax.plot(month_labels, vals, "o-", color=CITY_COLORS[city],
            linewidth=2, markersize=5, label=city)

ax.axhline(y=15, color="#C41E1E", linestyle="--", linewidth=1, alpha=0.7, label="WHO 15 μg/m³")
ax.axvspan(5, 8, alpha=0.06, color="#2563A8", label="Monsoon (Jun–Sep)")   # pollution drops: rain washes particulates
ax.axvspan(0, 1, alpha=0.06, color="#E05C2A")
ax.axvspan(9, 11, alpha=0.06, color="#E05C2A", label="Winter peak (Oct–Feb)")  # pollution rises: temperature inversions
ax.set_xlabel("Month")
ax.set_ylabel("Mean PM2.5 (μg/m³)")
ax.set_title("Monthly Seasonal PM2.5 Patterns — All Cities", fontweight="bold")
ax.legend(loc="upper right", fontsize=9)
plt.tight_layout()
path = os.path.join(OUTPUT_DIR, "fig5_seasonal_patterns.png")
plt.savefig(path, bbox_inches="tight")
plt.close()
print(f"  Saved: {path}")

# ── Fig 6: Annual PM2.5 trend — long-term direction per city ──────────────
# COVID lockdown (2020) visible as a dip across all cities
fig, ax = plt.subplots(figsize=(10, 5))
for city in annual_df.columns:
    s = annual_df[city].dropna()
    ax.plot(s.index, s.values, "o-", color=CITY_COLORS[city],
            linewidth=2, markersize=6, label=city)
    # Annotate final year value next to the last data point
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
#
# Prints a human-readable summary of all computed results.
# The numeric values printed here are the ones hardcoded into App.jsx so
# every number in the React dashboard is directly traceable to this script.
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

# COVID lockdown impact: compare 2019 vs 2020 annual PM2.5 for Ahmedabad
ahm_annual = annual_df["Ahmedabad"].dropna()
if 2019 in ahm_annual.index and 2020 in ahm_annual.index:
    covid_drop = (ahm_annual[2019] - ahm_annual[2020]) / ahm_annual[2019] * 100
    print(f"  COVID lockdown (Ahmedabad): PM2.5 dropped {covid_drop:.1f}% in 2020")

# Vapi pollution trend: first vs last annual value
vapi_annual = annual_df["Vapi"].dropna()
if len(vapi_annual) >= 2:
    vapi_change = (vapi_annual.iloc[-1] - vapi_annual.iloc[0]) / vapi_annual.iloc[0] * 100
    print(f"  Vapi trend {vapi_annual.index[0]}–{vapi_annual.index[-1]}: "
          f"{vapi_annual.iloc[0]:.1f} → {vapi_annual.iloc[-1]:.1f} μg/m³ ({vapi_change:+.1f}%)")

# Seasonal amplitude per city: max − min of the seasonal component
for city in decomp_results:
    s = decomp_results[city]["seasonal"]
    amp = s.max() - s.min()
    print(f"  {city} seasonal amplitude: {amp:.1f} μg/m³ (peak–trough)")

# Find and print the strongest pairwise pollutant correlation (excluding diagonal)
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
