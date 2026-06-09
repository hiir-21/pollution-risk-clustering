# Pollution Risk Clustering - Gujarat Air Quality
###  Data Analytics & Visualization 

---

## What this project does

Air quality across Gujarat cities varies significantly depending on whether a city
is industrial, administrative, or commercial. This project analyses hourly CPCB
station data from 4 Gujarat cities, runs K-Means clustering to classify them into
risk tiers, and presents the findings as an interactive slide-based dashboard.

Cities covered: **Ahmedabad · Ankleshwar · Vapi · Gandhinagar**

The dashboard has 10 slides covering city overview, pollutant profiles, clustering
results, time-series decomposition, seasonal patterns, and correlation analysis.

---

## Dataset

Source: [Time Series Air Quality Data of India (2010–2023) — Kaggle](https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india)  
Stations used: GJ001 (Ahmedabad/Maninagar), GJ002 (Ankleshwar/GIDC),
GJ003 (Vapi/Phase1 GIDC), GJ005 (Gandhinagar/Sector10)  
Agency: GPCB · ~217,000 hourly rows across all 4 stations

> The raw CSV files are not included in this repo. All data shown in the
> dashboard was pre-computed using `analyze.py` and is embedded directly
> in the frontend.

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Recharts |
| Build | Vite |
| Deployment | Vercel |
| Data pipeline | Python (pandas, scikit-learn) |

---

## Running locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Opens at `http://localhost:5173`

---

## Deployment

This project is deployed on Vercel. Any push to `main` triggers an automatic
redeploy. No manual build step needed.

To deploy your own fork:
1. Import the repo into Vercel
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`

---

## Project structure

```
├── src/
│   ├── App.jsx         # all 10 dashboard slides + data
│   └── main.jsx        # React entry point
├── index.html
├── analyze.py          # data pipeline (run locally to recompute values)
├── package.json
└── vite.config.js
```

---

## Reproducing the data

The values embedded in `App.jsx` were computed from the raw CPCB CSVs.
To recompute them:

```bash
pip install pandas numpy scikit-learn statsmodels
python analyze.py
```

Copy the printed output back into the relevant constants in `App.jsx`.

---

## Key findings

- **Vapi** — highest and rising PM2.5 (59.1 → 76.2 μg/m³, 2019–2022)
- **Gandhinagar** — cleanest city at 33.7 μg/m³ despite proximity to Ahmedabad
- **COVID signal** — Ahmedabad PM2.5 dropped 23% in 2020 lockdown
- **Winter peaks** — Nov–Feb pollution 3–6× higher than monsoon months
- **Clustering** — K-Means (k=3) yielded silhouette score of 0.20, 3 distinct risk tiers
