import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:       "#F6F5F2",
  surface:  "#FFFFFF",
  border:   "#E8E6E1",
  ink:      "#1A1A18",
  secondary:"#52524E",
  muted:    "#9C9A92",
  divider:  "#F0EEE8",
  accent:   "#2D6A4F",
};

const AQI = {
  good:      { fg:"#1B6B3A", bg:"#EDF7F1", border:"#A8D5B8" },
  moderate:  { fg:"#92600A", bg:"#FFF8EC", border:"#F5D48A" },
  poor:      { fg:"#B84010", bg:"#FFF3ED", border:"#F5B08A" },
  unhealthy: { fg:"#C41E1E", bg:"#FEF1F1", border:"#F5A8A8" },
  verypoor:  { fg:"#7B2EA0", bg:"#F8F2FE", border:"#DDB8F5" },
  hazardous: { fg:"#5C1F8A", bg:"#F5F0FE", border:"#C9A8F0" },
};

const aqiTheme = (v) => {
  if (!v) return { fg: T.muted, bg: T.bg, border: T.border };
  if (v > 300) return AQI.hazardous;
  if (v > 200) return AQI.verypoor;
  if (v > 150) return AQI.unhealthy;
  if (v > 100) return AQI.poor;
  if (v > 50)  return AQI.moderate;
  return AQI.good;
};

const aqiLabel = (v) => {
  if (!v) return "No data";
  if (v > 300) return "Hazardous";
  if (v > 200) return "Very Poor";
  if (v > 150) return "Unhealthy";
  if (v > 100) return "Poor";
  if (v > 50)  return "Moderate";
  return "Good";
};

const CITY_COLORS = {
  Ahmedabad:  "#E05C2A",
  Gandhinagar:"#2D8A5E",
  Surat:      "#2563A8",
  Ankleshwar: "#9333EA",
  Vapi:       "#C41E1E",
};

// WAQI API — station-level slugs from aqicn.org
const WAQI_TOKEN = "4532e9d25308516f482bc1858597498c7b89ee2c";
const WAQI_CITIES = {
  Ahmedabad:   "india/gujarat/ahmedabad/bopal",
  Gandhinagar: "india/gujarat/gandhinagar/sector-10",
  Surat:       "india/gujarat/surat/udhna",
  Ankleshwar:  "india/ankleshwar/gidc",
  Vapi:        "india/vapi/phase-1-gidc",
};

// ── Historical averages (CPCB 2010–2023) ──────────────────────────────────
const HIST = [
  { city:"Ahmedabad",  aqi:142, pm25:59,  pm10:132, region:"Metro / Commercial",  type:"Metro",      svgX:120, svgY:110 },
  { city:"Gandhinagar",aqi:78,  pm25:32,  pm10:68,  region:"State Capital",       type:"Admin",      svgX:132, svgY:88  },
  { city:"Surat",      aqi:118, pm25:51,  pm10:98,  region:"Textile / Diamond",   type:"Metro",      svgX:100, svgY:230 },
  { city:"Ankleshwar", aqi:156, pm25:68,  pm10:148, region:"Chemical / GIDC",     type:"Industrial", svgX:108, svgY:208 },
  { city:"Vapi",       aqi:178, pm25:88,  pm10:172, region:"Chemical / GIDC",     type:"Industrial", svgX:95,  svgY:268 },
];

const TREND = [
  { yr:2015, Ahmedabad:72 },
  { yr:2016, Ahmedabad:68, Surat:58 },
  { yr:2017, Ahmedabad:65, Surat:55 },
  { yr:2018, Ahmedabad:64, Surat:54, Ankleshwar:78 },
  { yr:2019, Ahmedabad:59, Surat:50, Ankleshwar:72, Vapi:88 },
  { yr:2020, Ahmedabad:38, Surat:32, Ankleshwar:44, Vapi:52, Gandhinagar:28 },
  { yr:2021, Ahmedabad:52, Surat:45, Ankleshwar:65, Vapi:78, Gandhinagar:30 },
  { yr:2022, Ahmedabad:53, Surat:47, Ankleshwar:54, Vapi:82, Gandhinagar:29 },
  { yr:2023, Ahmedabad:59, Surat:51, Ankleshwar:68, Vapi:88, Gandhinagar:32 },
];

const SEASONAL = [
  { m:"Jan", Ahmedabad:82,  Gandhinagar:48, Surat:72,  Ankleshwar:95,  Vapi:118 },
  { m:"Feb", Ahmedabad:74,  Gandhinagar:42, Surat:65,  Ankleshwar:88,  Vapi:108 },
  { m:"Mar", Ahmedabad:62,  Gandhinagar:36, Surat:55,  Ankleshwar:74,  Vapi:92  },
  { m:"Apr", Ahmedabad:55,  Gandhinagar:30, Surat:48,  Ankleshwar:62,  Vapi:80  },
  { m:"May", Ahmedabad:48,  Gandhinagar:26, Surat:42,  Ankleshwar:58,  Vapi:72  },
  { m:"Jun", Ahmedabad:38,  Gandhinagar:22, Surat:32,  Ankleshwar:48,  Vapi:58  },
  { m:"Jul", Ahmedabad:24,  Gandhinagar:14, Surat:20,  Ankleshwar:30,  Vapi:36  },
  { m:"Aug", Ahmedabad:22,  Gandhinagar:13, Surat:18,  Ankleshwar:28,  Vapi:34  },
  { m:"Sep", Ahmedabad:26,  Gandhinagar:15, Surat:22,  Ankleshwar:32,  Vapi:40  },
  { m:"Oct", Ahmedabad:58,  Gandhinagar:34, Surat:50,  Ankleshwar:68,  Vapi:84  },
  { m:"Nov", Ahmedabad:92,  Gandhinagar:54, Surat:80,  Ankleshwar:108, Vapi:138 },
  { m:"Dec", Ahmedabad:88,  Gandhinagar:50, Surat:76,  Ankleshwar:102, Vapi:128 },
];

const CORR = [
  [1.00, 0.88, 0.64, 0.18, 0.58, 0.22],
  [0.88, 1.00, 0.60, 0.15, 0.54, 0.08],
  [0.64, 0.60, 1.00, 0.12, 0.48, 0.15],
  [0.18, 0.15, 0.12, 1.00, 0.72,-0.08],
  [0.58, 0.54, 0.48, 0.72, 1.00,-0.04],
  [0.22, 0.08, 0.15,-0.08,-0.04, 1.00],
];
const POLL_L = ["PM2.5","PM10","NO₂","SO₂","CO","O₃"];

const ELBOW = [
  { k:2, inertia:4.2, sil:0.38 },
  { k:3, inertia:2.1, sil:0.61 },
  { k:4, inertia:1.6, sil:0.49 },
  { k:5, inertia:1.3, sil:0.40 },
];

const RADAR_DATA = [
  { pollutant:"PM2.5", Ahmedabad:59,  Gandhinagar:32, Surat:51, Ankleshwar:68,  Vapi:88  },
  { pollutant:"PM10",  Ahmedabad:132, Gandhinagar:68, Surat:98, Ankleshwar:148, Vapi:172 },
  { pollutant:"NO₂",  Ahmedabad:104, Gandhinagar:38, Surat:55, Ankleshwar:18,  Vapi:12  },
  { pollutant:"SO₂",  Ahmedabad:22,  Gandhinagar:10, Surat:28, Ankleshwar:72,  Vapi:88  },
  { pollutant:"CO",   Ahmedabad:48,  Gandhinagar:18, Surat:42, Ankleshwar:62,  Vapi:78  },
  { pollutant:"O₃",   Ahmedabad:38,  Gandhinagar:42, Surat:35, Ankleshwar:22,  Vapi:18  },
];

const GUJARAT_SVG = "60,20 110,14 145,22 168,18 185,30 195,48 185,72 178,90 185,108 195,122 198,140 188,158 175,168 162,188 152,210 145,228 138,248 130,268 118,285 105,290 92,280 82,265 72,248 58,235 45,225 32,210 22,195 18,178 25,162 35,148 28,132 22,118 28,102 38,88 42,72 35,56 42,40 52,28";

// ── Shared primitives ──────────────────────────────────────────────────────
const cardStyle = {
  background: T.surface,
  borderRadius: 12,
  border: `1px solid ${T.border}`,
  padding: "20px 24px",
};

function Tag({ children, color }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", background:color?.bg||T.bg, color:color?.fg||T.secondary, border:`1px solid ${color?.border||T.border}`, borderRadius:6, padding:"2px 9px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function SlideHeader({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom:28 }}>
      {eyebrow && <div style={{ fontSize:11, fontWeight:600, color:T.accent, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>{eyebrow}</div>}
      <h2 style={{ margin:0, fontSize:26, fontWeight:700, color:T.ink, letterSpacing:-0.5, lineHeight:1.2 }}>{title}</h2>
      {subtitle && <p style={{ margin:"6px 0 0", fontSize:13, color:T.secondary, lineHeight:1.6 }}>{subtitle}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 16px rgba(0,0,0,0.10)" }}>
      <p style={{ margin:"0 0 6px", color:T.muted, fontSize:11, fontWeight:600 }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ margin:"2px 0", color:T.ink }}><span style={{ color:p.color, fontWeight:600 }}>{p.name}</span>{" "}— {typeof p.value==="number"?p.value.toFixed(0):p.value}</p>)}
    </div>
  );
}

function CityRow({ city, aqi, pm25, pm10, histAqi, isLive, isLast }) {
  const theme = aqiTheme(aqi);
  const diff  = aqi && histAqi ? Math.round(aqi - histAqi) : null;
  const pct   = Math.min((aqi || 0) / 500 * 100, 100);
  const h     = HIST.find(x => x.city === city) || {};
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"16px 24px", gap:20 }}>
        <div style={{ width:130, flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:600, color:T.ink }}>{city}</div>
          <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>{h.region}</div>
        </div>
        <div style={{ width:64, flexShrink:0, textAlign:"center" }}>
          {aqi
            ? <span style={{ fontSize:32, fontWeight:700, color:theme.fg, letterSpacing:-1 }}>{aqi}</span>
            : <span style={{ fontSize:18, color:T.muted }}>—</span>}
        </div>
        <div style={{ width:90, flexShrink:0 }}>
          <Tag color={theme}>{aqiLabel(aqi)}</Tag>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ height:5, background:T.divider, borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:theme.fg, borderRadius:3, transition:"width 0.5s ease" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:20, flexShrink:0 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{pm25 ?? "—"}</div>
            <div style={{ fontSize:10, color:T.muted }}>PM2.5</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{pm10 ?? "—"}</div>
            <div style={{ fontSize:10, color:T.muted }}>PM10</div>
          </div>
        </div>
        <div style={{ width:110, flexShrink:0, textAlign:"right" }}>
          {diff !== null && (
            <div style={{ fontSize:12, fontWeight:600, color:diff>15?AQI.unhealthy.fg:diff<-15?AQI.good.fg:T.secondary }}>
              {diff > 0 ? `↑ +${diff}` : `↓ ${diff}`}
            </div>
          )}
          <div style={{ fontSize:10, color:T.muted }}>
            {isLive ? `vs hist avg ${histAqi}` : "2010–2023 avg"}
          </div>
        </div>
      </div>
      {!isLast && <div style={{ height:1, background:T.divider, margin:"0 24px" }} />}
    </div>
  );
}

// ── SLIDE 1 — Live + Historical tabs ──────────────────────────────────────
function S1() {
  const [tab,      setTab]      = useState("live");
  const [liveData, setLiveData] = useState({});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [sortBy,   setSortBy]   = useState("aqi");
  const [search,   setSearch]   = useState("");

  const fetchOneCity = async (city, slug) => {
    try {
      const res  = await fetch(`https://api.waqi.info/feed/${encodeURIComponent(slug)}/?token=${WAQI_TOKEN}`);
      const json = await res.json();
      if (json.status !== "ok") return { city, aqi:null, pm25:null, pm10:null, error:true };
      const d = json.data;
      return {
        city,
        aqi:      typeof d.aqi === "number" ? d.aqi : null,
        pm25:     d.iaqi?.pm25?.v ?? null,
        pm10:     d.iaqi?.pm10?.v ?? null,
        fetchedAt: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) + " IST",
        error: false,
      };
    } catch {
      return { city, aqi:null, pm25:null, pm10:null, error:true };
    }
  };

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        Object.entries(WAQI_CITIES).map(([city, slug]) => fetchOneCity(city, slug))
      );
      const allFailed = results.every(r => r.error);
      if (allFailed) throw new Error("all failed");
      const map = {};
      results.forEach(r => { map[r.city] = r; });
      setLiveData(map);
    } catch {
      setError("Could not fetch live data — WAQI API unreachable. Try refreshing or check aqicn.org.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "live" && Object.keys(liveData).length === 0) fetchLive();
  }, [tab]);

  const today = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
  const fetchedAt = Object.values(liveData)[0]?.fetchedAt;

  const sorted = (data) => [...data]
    .filter(h => h.city.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      if (sortBy === "name") return a.city.localeCompare(b.city);
      const va = tab==="live" ? (liveData[a.city]?.aqi??0) : a.aqi;
      const vb = tab==="live" ? (liveData[b.city]?.aqi??0) : b.aqi;
      if (sortBy === "pm25") return tab==="live"
        ? (liveData[b.city]?.pm25??0)-(liveData[a.city]?.pm25??0)
        : b.pm25-a.pm25;
      return vb - va;
    });

  const cities = sorted(HIST);

  const compareData = HIST.map(h => ({
    city: h.city,
    Historical: h.aqi,
    Live: liveData[h.city]?.aqi ?? null,
  }));

  const SortButtons = () => (
    <div style={{ display:"flex", gap:4 }}>
      {[["aqi","AQI"],["pm25","PM2.5"],["name","A–Z"]].map(([k,l]) => (
        <button key={k} onClick={()=>setSortBy(k)}
          style={{ background:sortBy===k?T.ink:T.surface, border:`1px solid ${sortBy===k?T.ink:T.border}`, borderRadius:7, color:sortBy===k?"#fff":T.secondary, padding:"7px 13px", fontSize:11, fontWeight:600, cursor:"pointer" }}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* Header + tabs */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
        <SlideHeader
          eyebrow="01 · Air Quality Data"
          title="Gujarat Cities — AQI Dashboard"
          subtitle={`${today} · CPCB/GPCB station network via WAQI`}
        />
        <div style={{ display:"flex", gap:2, background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, padding:3, flexShrink:0, marginTop:4 }}>
          {[["live","🟢 Live AQI"],["hist","📊 Historical Baseline"]].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)}
              style={{ background:tab===k?T.surface:"transparent", border:`1px solid ${tab===k?T.border:"transparent"}`, borderRadius:7, padding:"7px 18px", fontSize:12, fontWeight:tab===k?700:500, color:tab===k?T.ink:T.muted, cursor:"pointer", transition:"all 0.15s", boxShadow:tab===k?"0 1px 3px rgba(0,0,0,0.06)":"none" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIVE TAB ── */}
      {tab === "live" && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.secondary }}>
              {loading
                ? <><span style={{ width:8,height:8,borderRadius:"50%",background:"#F59E0B",display:"inline-block" }} />Fetching live data...</>
                : error
                  ? <><span style={{ width:8,height:8,borderRadius:"50%",background:AQI.unhealthy.fg,display:"inline-block" }} />{error}</>
                  : fetchedAt
                    ? <><span style={{ width:8,height:8,borderRadius:"50%",background:AQI.good.fg,display:"inline-block" }} />Live · fetched at {fetchedAt}</>
                    : null}
            </div>
            <button onClick={fetchLive} disabled={loading}
              style={{ marginLeft:"auto", background:T.ink, border:"none", borderRadius:7, color:"#fff", padding:"6px 14px", fontSize:11, fontWeight:600, cursor:loading?"not-allowed":"pointer", opacity:loading?0.5:1 }}>
              ↻ Refresh
            </button>
          </div>

          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Filter city..."
              style={{ flex:1, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 12px", fontSize:12, color:T.ink, background:T.surface, outline:"none" }} />
            <SortButtons />
          </div>

          <div style={{ border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", background:T.surface, marginBottom:14 }}>
            {loading
              ? [0,1,2,3,4].map(i => (
                  <div key={i} style={{ padding:"20px 24px", display:"flex", gap:20, alignItems:"center", borderBottom:i<4?`1px solid ${T.divider}`:"none" }}>
                    {[130,64,90,200,80].map((w,j) => (
                      <div key={j} style={{ width:w, height:16, background:T.divider, borderRadius:4, flexShrink:0 }} />
                    ))}
                  </div>
                ))
              : cities.map((h,i) => {
                  const d = liveData[h.city];
                  return <CityRow key={h.city} city={h.city} aqi={d?.aqi} pm25={d?.pm25} pm10={d?.pm10} histAqi={h.aqi} isLive={true} isLast={i===cities.length-1} />;
                })
            }
          </div>

          {!loading && Object.keys(liveData).length > 0 && (
            <div style={{ ...cardStyle, padding:"18px 24px" }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.secondary, marginBottom:14 }}>Live vs Historical Average</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={compareData} margin={{ left:0, right:0, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                  <XAxis dataKey="city" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={v=><span style={{ color:T.secondary, fontSize:11 }}>{v}</span>} />
                  <Bar dataKey="Historical" fill={T.muted} fillOpacity={0.4} radius={[3,3,0,0]} />
                  <Bar dataKey="Live" radius={[3,3,0,0]}>
                    {compareData.map((d,i) => <Cell key={i} fill={aqiTheme(d.Live).fg} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ── HISTORICAL TAB ── */}
      {tab === "hist" && (
        <>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:12, color:T.secondary, background:T.surface, border:`1px solid ${T.border}`, borderRadius:7, padding:"6px 12px" }}>
              📅 CPCB dataset · 2010–2023 · Monthly averages from your 500MB analysis
            </div>
            <div style={{ marginLeft:"auto" }}><SortButtons /></div>
          </div>

          <div style={{ border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", background:T.surface, marginBottom:14 }}>
            {cities.map((h,i) => (
              <CityRow key={h.city} city={h.city} aqi={h.aqi} pm25={h.pm25} pm10={h.pm10} histAqi={h.aqi} isLive={false} isLast={i===cities.length-1} />
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {[
              { th:AQI.unhealthy, risk:"High Risk",   cities:["Vapi","Ankleshwar"], note:"GIDC chemical zones · avg AQI 156–178" },
              { th:AQI.poor,      risk:"Medium Risk",  cities:["Ahmedabad","Surat"], note:"Major metros · avg AQI 118–142" },
              { th:AQI.good,      risk:"Low Risk",     cities:["Gandhinagar"],       note:"State capital · avg AQI 78" },
            ].map(cl => (
              <div key={cl.risk} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:cl.th.fg }} />
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{cl.risk}</span>
                </div>
                <div style={{ display:"flex", gap:5, marginBottom:6 }}>
                  {cl.cities.map(c => <Tag key={c} color={cl.th}>{c}</Tag>)}
                </div>
                <div style={{ fontSize:11, color:T.muted }}>{cl.note}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

// ── SLIDE 2 — Cities ───────────────────────────────────────────────────────
function S2() {
  const [selected, setSelected] = useState(null);
  const icons = { Ahmedabad:"🏙", Gandhinagar:"🏛", Surat:"💎", Ankleshwar:"🏭", Vapi:"⚗️" };
  const notes = {
    Ahmedabad:  "Largest city in Gujarat. Home to 3,000+ industrial units including textiles, chemicals, auto. 2 coal-fired power plants. Ranked 4th most polluted city in India by CPCB (2019).",
    Gandhinagar:"State capital — primarily administrative, planned city. Far fewer industrial units than Ahmedabad despite being only 30km away. Acts as the 'clean baseline' in our clustering.",
    Surat:      "Textile and diamond hub. 350+ industrial units tracked by GPCB in real-time. Major SO₂ source from coal-based industrial boilers. Strong monsoon washout effect on coast.",
    Ankleshwar: "GIDC chemical belt. Rallis India station. One of India's most concentrated chemical manufacturing zones.",
    Vapi:       "Phase-1 GIDC — historically one of India's most polluted small cities. Heavy chemical and pharmaceutical manufacturing. Second most polluted location in CSE's western India analysis (2022-23).",
  };
  const riskOf = a => a>130?"High Risk":a>90?"Medium Risk":"Low Risk";
  const riskTh = a => a>130?AQI.unhealthy:a>90?AQI.poor:AQI.good;
  return (
    <div>
      <SlideHeader eyebrow="02 · Dataset" title="Five Gujarat Cities" subtitle="CPCB/GPCB real monitoring data — all within Gujarat · Click a city to learn more" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {HIST.map(c => {
          const th=riskTh(c.aqi), sel=selected===c.city;
          return (
            <div key={c.city} onClick={()=>setSelected(sel?null:c.city)}
              style={{ ...cardStyle, padding:"16px 18px", cursor:"pointer", borderColor:sel?th.fg:T.border, borderWidth:sel?2:1, transition:"all 0.2s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:18 }}>{icons[c.city]}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{c.city}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{c.type}</div>
                </div>
              </div>
              <Tag color={th}>{riskOf(c.aqi)}</Tag>
              <div style={{ fontSize:22, fontWeight:700, color:th.fg, marginTop:10 }}>{c.aqi}</div>
              <div style={{ fontSize:10, color:T.muted }}>Avg AQI</div>
              <div style={{ marginTop:6, fontSize:12, fontWeight:500, color:T.ink }}>{c.pm25} <span style={{ fontSize:10, color:T.muted }}>PM2.5 μg/m³</span></div>
            </div>
          );
        })}
      </div>
      {selected && (
        <div style={{ ...cardStyle, borderLeft:`3px solid ${riskTh(HIST.find(x=>x.city===selected)?.aqi).fg}`, borderRadius:"0 10px 10px 0", marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:6 }}>{selected}</div>
          <p style={{ margin:0, fontSize:12, color:T.secondary, lineHeight:1.7 }}>{notes[selected]}</p>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[["3 types","Metro · Admin · Industrial"],["5 cities","All within Gujarat"],["~200km","Max city-to-city distance"],["2010–23","Ahmedabad longest coverage"]].map(([n,l]) => (
          <div key={l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:700, color:T.ink }}>{n}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SLIDE 3 — Pipeline ─────────────────────────────────────────────────────
function S3() {
  const [activeStep, setActiveStep] = useState(null);
  const steps = [
    { n:1, title:"Load Raw Data",   sub:"CSV per city\nHourly CPCB",        detail:"500MB+ of hourly CSVs from Kaggle. Two CPCB column formats: 'From Date' (hourly) and 'Sampling Date' (daily). Cities matched by filename prefix." },
    { n:2, title:"Detect Columns", sub:"Auto-detect\nboth formats",         detail:"The pipeline auto-detects which column schema each file uses and normalises into a unified schema before any further processing." },
    { n:3, title:"Fill Missing",   sub:"Interpolate ≤3d\nSeasonal fallback",detail:"Gaps up to 3 days linearly interpolated. Longer gaps fall back to same-month average. 9,322 values filled total." },
    { n:4, title:"Remove Outliers",sub:"IQR × 3.0\nRolling cap",            detail:"Values outside 3× IQR capped using rolling median. Preserves real spikes (Diwali, accidents) while filtering sensor faults." },
    { n:5, title:"Monthly Agg.",   sub:"Daily → Monthly\n~300 records",     detail:"Daily averages aggregated to monthly means — ~300 clean records. Pollutants: PM2.5, PM10, NO₂, SO₂, CO, O₃." },
    { n:6, title:"Normalise",      sub:"Min-Max 0–1\n6 pollutants",         detail:"Min-Max normalisation per pollutant. Ensures no single pollutant dominates Euclidean distance in K-Means." },
    { n:7, title:"Feature Matrix", sub:"5 cities × 10\nfeatures",           detail:"Final matrix: 5 rows × 10 features (6 pollutant averages + AQI + seasonal amplitude + trend slope + coverage years)." },
  ];
  return (
    <div>
      <SlideHeader eyebrow="03 · Preprocessing" title="Data Pipeline" subtitle="Seven steps · click any step for details" />
      <div style={{ position:"relative", marginBottom:24 }}>
        <div style={{ position:"absolute", top:18, left:"4%", right:"4%", height:1, background:T.border, zIndex:0 }} />
        <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:1 }}>
          {steps.map((st,i) => (
            <div key={i} onClick={()=>setActiveStep(activeStep===i?null:i)}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1, cursor:"pointer" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:activeStep===i?T.accent:i<5?T.ink:T.bg, border:`1px solid ${activeStep===i?T.accent:i<5?T.ink:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:i<5||activeStep===i?"#fff":T.secondary, marginBottom:10, boxShadow:"0 0 0 4px #F6F5F2", transition:"all 0.2s" }}>
                {st.n}
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:activeStep===i?T.accent:T.ink, textAlign:"center", marginBottom:4 }}>{st.title}</div>
              <div style={{ fontSize:10, color:T.muted, textAlign:"center", lineHeight:1.5, whiteSpace:"pre-line" }}>{st.sub}</div>
            </div>
          ))}
        </div>
      </div>
      {activeStep !== null && (
        <div style={{ ...cardStyle, borderLeft:`3px solid ${T.accent}`, borderRadius:"0 10px 10px 0", marginBottom:16, background:"#F0FAF5" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.accent, marginBottom:4 }}>Step {steps[activeStep].n} — {steps[activeStep].title}</div>
          <p style={{ margin:0, fontSize:12, color:T.secondary, lineHeight:1.7 }}>{steps[activeStep].detail}</p>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[["500 MB+","Raw dataset"],["~300","Monthly records"],["9,322","Missing values filled"],["5 cities","All Gujarat"]].map(([n,l]) => (
          <div key={l} style={{ ...cardStyle, textAlign:"center" }}>
            <div style={{ fontSize:24, fontWeight:700, color:T.ink }}>{n}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SLIDE 4 — Method ───────────────────────────────────────────────────────
function S4() {
  const [activeK, setActiveK] = useState(3);
  const kDesc = {
    2:"Two clusters would merge Ankleshwar with Vapi and lump Ahmedabad with Surat — losing important granularity.",
    3:"Optimal. Separates three meaningful city types: high-risk industrial (Vapi, Ankleshwar), medium-risk metro (Ahmedabad, Surat), low-risk admin (Gandhinagar). Silhouette 0.61.",
    4:"Over-clusters. Splits Ahmedabad from Surat without meaningful basis.",
    5:"One cluster per city — defeats the purpose of clustering entirely.",
  };
  return (
    <div>
      <SlideHeader eyebrow="04 · Methodology" title="K-Means Clustering" subtitle="k=3 confirmed by Elbow + Silhouette · click chart points to explore" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
        {[["Elbow Method — Inertia","inertia",T.ink,"Steepest drop at k = 3"],["Silhouette Score","sil",T.accent,"Peak score 0.61 at k = 3"]].map(([title,key,color,note]) => (
          <div key={key} style={{ ...cardStyle }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:14 }}>{title}</div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={ELBOW} onClick={d=>d?.activePayload&&setActiveK(d.activePayload[0].payload.k)}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
                <XAxis dataKey="k" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey={key} stroke={color} strokeWidth={2} dot={p=><circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload.k===activeK?6:4} fill={p.payload.k===activeK?T.accent:color} />} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ margin:"8px 0 0", fontSize:11, color:T.muted, textAlign:"center" }}>{note}</p>
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle, borderLeft:`3px solid ${T.accent}`, borderRadius:"0 10px 10px 0", marginBottom:16, background:"#F0FAF5" }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:4 }}>k = {activeK} — {activeK===3?"✓ Optimal":activeK<3?"Under-clustered":"Over-clustered"}</div>
        <p style={{ margin:0, fontSize:12, color:T.secondary, lineHeight:1.7 }}>{kDesc[activeK]}</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[["01","Normalise","Min-Max scale 5-city × 10-feature vectors"],["02","Initialise","Place 3 centroids in 10-dimensional space"],["03","Assign","Each city → nearest centroid (Euclidean)"],["04","Label","Rank clusters by mean AQI → risk tier"]].map(([n,t,d]) => (
          <div key={n} style={{ background:T.bg, borderRadius:10, padding:"14px 16px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:1, marginBottom:6 }}>{n}</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.ink, marginBottom:6 }}>{t}</div>
            <div style={{ fontSize:11, color:T.secondary, lineHeight:1.55 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SLIDE 5 — Results ──────────────────────────────────────────────────────
function S5() {
  const [hovCity, setHovCity] = useState(null);
  const bar = [...HIST].sort((a,b)=>b.aqi-a.aqi);
  return (
    <div>
      <SlideHeader eyebrow="05 · Results" title="Cluster Assignments" subtitle="K-Means on CPCB Gujarat data · Silhouette Score: 0.61 · hover to highlight" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.7fr", gap:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { th:AQI.unhealthy, risk:"High Risk",  cities:["Vapi","Ankleshwar"], note:"GIDC chemical zones. Vapi 2nd most polluted in western India (CSE 2022-23). High SO₂ from industrial boilers." },
            { th:AQI.poor,      risk:"Medium Risk", cities:["Ahmedabad","Surat"], note:"Major metros with mixed industrial + vehicular + residential emissions. Ahmedabad: highest NO₂ (104 μg/m³)." },
            { th:AQI.good,      risk:"Low Risk",    cities:["Gandhinagar"],       note:"Planned admin capital. Low industry, high green cover. Clean baseline for clustering." },
          ].map(cl => (
            <div key={cl.risk} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:cl.th.fg }} />
                <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{cl.risk}</span>
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:8 }}>{cl.cities.map(c=><Tag key={c} color={cl.th}>{c}</Tag>)}</div>
              <p style={{ margin:0, fontSize:11, color:T.muted, lineHeight:1.55 }}>{cl.note}</p>
            </div>
          ))}
          <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", fontSize:11, color:T.secondary }}>
            <b style={{ color:T.ink }}>Key insight:</b> Same state, same monsoon — 3 different risk tiers driven by industrial type, not geography.
          </div>
        </div>
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:16 }}>Mean AQI by City</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bar} layout="vertical" margin={{ left:8, right:48, top:0, bottom:0 }}
              onMouseMove={d=>d?.activePayload&&setHovCity(d.activePayload[0]?.payload?.city)}
              onMouseLeave={()=>setHovCity(null)}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.divider} horizontal={false} />
              <XAxis type="number" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="city" tick={{ fill:T.ink, fontSize:12, fontWeight:500 }} width={90} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="aqi" name="Avg AQI" radius={[0,4,4,0]}>
                {bar.map((c,i)=><Cell key={i} fill={aqiTheme(c.aqi).fg} fillOpacity={hovCity&&hovCity!==c.city?0.25:0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginTop:14 }}>
            {HIST.map(c=>(
              <div key={c.city} onMouseEnter={()=>setHovCity(c.city)} onMouseLeave={()=>setHovCity(null)}
                style={{ textAlign:"center", padding:"8px 4px", borderRadius:8, background:hovCity===c.city?aqiTheme(c.aqi).bg:T.bg, transition:"background 0.15s", cursor:"default" }}>
                <div style={{ fontSize:10, color:T.muted }}>{c.city}</div>
                <div style={{ fontSize:14, fontWeight:700, color:aqiTheme(c.aqi).fg }}>{c.aqi}</div>
                <div style={{ fontSize:9, color:T.muted }}>{aqiLabel(c.aqi)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SLIDE 6 — Map ──────────────────────────────────────────────────────────
function S6() {
  const [hov, setHov] = useState(null);
  return (
    <div>
      <SlideHeader eyebrow="06 · Geography" title="Gujarat Risk Map" subtitle="All 5 cities within one state · hover to explore" />
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:20 }}>
        <div style={{ ...cardStyle, padding:20, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg viewBox="0 0 230 310" style={{ width:200, display:"block" }}>
            <polygon points={GUJARAT_SVG} fill="#EDF4EE" stroke="#C8D8CA" strokeWidth={1.5} strokeLinejoin="round" />
            <text x="80" y="150" fontSize={9} fill="#9CA3AF" textAnchor="middle" fontStyle="italic">Gujarat</text>
            {HIST.map(c => {
              const theme=aqiTheme(c.aqi), isHov=hov===c.city;
              return (
                <g key={c.city} onMouseEnter={()=>setHov(c.city)} onMouseLeave={()=>setHov(null)} style={{ cursor:"pointer" }}>
                  <circle cx={c.svgX} cy={c.svgY} r={isHov?20:16} fill={theme.bg} stroke={theme.fg} strokeWidth={isHov?2:1.5} style={{ transition:"all 0.2s" }} />
                  <circle cx={c.svgX} cy={c.svgY} r={isHov?6:4} fill={theme.fg} />
                  <text x={c.svgX} y={c.svgY+(c.svgY<100?-22:22)} fontSize={9} fontWeight={600} fill={isHov?theme.fg:T.secondary} textAnchor="middle">{c.city}</text>
                  {isHov && (
                    <g>
                      <rect x={c.svgX+14} y={c.svgY-40} width={88} height={36} rx={5} fill={T.surface} stroke={T.border} strokeWidth={1} />
                      <text x={c.svgX+58} y={c.svgY-27} fontSize={9} fill={theme.fg} textAnchor="middle" fontWeight={700}>{c.city}</text>
                      <text x={c.svgX+58} y={c.svgY-15} fontSize={9} fill={T.secondary} textAnchor="middle">AQI {c.aqi} · {aqiLabel(c.aqi)}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {HIST.map(c => {
            const theme=aqiTheme(c.aqi);
            return (
              <div key={c.city}
                style={{ background:T.surface, border:`1px solid ${hov===c.city?theme.fg:T.border}`, borderRadius:10, padding:"12px 18px", display:"flex", alignItems:"center", gap:14, transition:"border-color 0.15s", cursor:"default" }}
                onMouseEnter={()=>setHov(c.city)} onMouseLeave={()=>setHov(null)}>
                <div style={{ width:3, height:36, borderRadius:2, background:theme.fg, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>{c.city}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{c.region} · {c.type}</div>
                </div>
                <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22, fontWeight:700, color:theme.fg }}>{c.aqi}</div>
                    <div style={{ fontSize:9, color:T.muted }}>hist avg</div>
                  </div>
                  <Tag color={theme}>{aqiLabel(c.aqi)}</Tag>
                </div>
              </div>
            );
          })}
          <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", fontSize:11, color:T.secondary }}>
            📍 Gandhinagar is 30km from Ahmedabad. Vapi and Ankleshwar are in the southern industrial corridor near the Maharashtra border.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SLIDE 7 — Trends ───────────────────────────────────────────────────────
function S7() {
  const [showCity, setShowCity] = useState(Object.fromEntries(Object.keys(CITY_COLORS).map(c=>[c,true])));
  return (
    <div>
      <SlideHeader eyebrow="07 · Temporal" title="Annual PM2.5 Trend" subtitle="Toggle cities · COVID lockdown (2020) visible as a dip across all cities" />
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {Object.entries(CITY_COLORS).map(([city,color]) => (
          <button key={city} onClick={()=>setShowCity(s=>({...s,[city]:!s[city]}))}
            style={{ background:showCity[city]?color+"22":"transparent", border:`1.5px solid ${showCity[city]?color:T.border}`, borderRadius:7, color:showCity[city]?color:T.muted, padding:"5px 12px", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all 0.2s" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:showCity[city]?color:T.border }} />{city}
          </button>
        ))}
      </div>
      <div style={{ ...cardStyle, marginBottom:16 }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={TREND} margin={{ top:8, right:20, bottom:8, left:8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
            <XAxis dataKey="yr" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} label={{ value:"PM2.5 μg/m³", angle:-90, position:"insideLeft", offset:14, fill:T.muted, fontSize:11 }} />
            <Tooltip content={<ChartTooltip />} />
            {Object.entries(CITY_COLORS).map(([city,color]) =>
              showCity[city] ? <Line key={city} dataKey={city} name={city} stroke={color} strokeWidth={2} dot={{ r:3, fill:color, strokeWidth:0 }} connectNulls={false} /> : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[
          { label:"COVID dip 2020",       value:"−35–47%", sub:"All cities dropped. Ahmedabad: 64→38 μg/m³", positive:true },
          { label:"Vapi 2023",            value:"88 μg/m³", sub:"Consistently highest. Nearly 6× WHO guideline", positive:false },
          { label:"Gandhinagar stability", value:"28–32",   sub:"Most stable 2020–23. Least variation", positive:true },
          { label:"Post-COVID rebound",   value:"+38–68%", sub:"All cities rebounded by 2021", positive:false },
        ].map(k=>(
          <div key={k.label} style={{ ...cardStyle, padding:"14px 18px" }}>
            <div style={{ fontSize:10, color:T.muted, fontWeight:600, marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.positive?AQI.good.fg:AQI.unhealthy.fg }}>{k.value}</div>
            <div style={{ fontSize:11, color:T.secondary, marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SLIDE 8 — Seasonal + Radar ─────────────────────────────────────────────
function S8() {
  const [activeCity, setActiveCity] = useState("Ahmedabad");
  const corrVal = v => { const n=(v+1)/2; return `rgba(${Math.round(255*(1-n))},${Math.round(200*n)},${Math.round(50*(1-Math.abs(v)))},0.72)`; };
  const radarForCity = RADAR_DATA.map(row=>({ pollutant:row.pollutant, value:row[activeCity] }));
  return (
    <div>
      <SlideHeader eyebrow="08 · Patterns" title="Seasonal & Pollutant Profiles" subtitle="Monthly PM2.5 patterns + city radar · click a city" />
      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16 }}>
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:14 }}>Monthly PM2.5 — Seasonal Pattern</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={SEASONAL}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
              <XAxis dataKey="m" tick={{ fill:T.muted, fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {Object.entries(CITY_COLORS).map(([city,color])=>(
                <Line key={city} dataKey={city} name={city} stroke={color} strokeWidth={activeCity===city?2.5:1.5} dot={false} connectNulls strokeOpacity={activeCity===city?1:0.3} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
            <div style={{ background:AQI.unhealthy.bg, border:`1px solid ${AQI.unhealthy.border}`, borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:11, fontWeight:600, color:AQI.unhealthy.fg }}>❄ Winter peak (Nov–Dec)</div>
              <div style={{ fontSize:10, color:T.secondary, marginTop:3 }}>Vapi 138, Ankleshwar 108, Ahmedabad 92 μg/m³</div>
            </div>
            <div style={{ background:AQI.good.bg, border:`1px solid ${AQI.good.border}`, borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:11, fontWeight:600, color:AQI.good.fg }}>🌧 Monsoon dip (Jul–Aug)</div>
              <div style={{ fontSize:10, color:T.secondary, marginTop:3 }}>Gandhinagar 14, Ahmedabad 24, Surat 20 μg/m³</div>
            </div>
          </div>
        </div>
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:8 }}>City Pollutant Profile</div>
          <div style={{ display:"flex", gap:4, marginBottom:10, flexWrap:"wrap" }}>
            {Object.entries(CITY_COLORS).map(([city,color])=>(
              <button key={city} onClick={()=>setActiveCity(city)}
                style={{ background:activeCity===city?color+"22":"transparent", border:`1.5px solid ${activeCity===city?color:T.border}`, borderRadius:6, color:activeCity===city?color:T.muted, padding:"3px 9px", fontSize:10, fontWeight:600, cursor:"pointer" }}>
                {city}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarForCity}>
              <PolarGrid stroke={T.divider} />
              <PolarAngleAxis dataKey="pollutant" tick={{ fill:T.muted, fontSize:10 }} />
              <Radar dataKey="value" stroke={CITY_COLORS[activeCity]} fill={CITY_COLORS[activeCity]} fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ textAlign:"center", fontSize:11, color:T.muted, marginTop:4 }}>{activeCity} — {HIST.find(x=>x.city===activeCity)?.region}</div>
        </div>
      </div>
      <div style={{ ...cardStyle, marginTop:14 }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:12 }}>Pollutant Correlation Matrix</div>
        <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", gap:2, marginLeft:40, marginBottom:2 }}>
              {POLL_L.map(p=><div key={p} style={{ width:38, textAlign:"center", fontSize:9, color:T.muted, fontWeight:600 }}>{p}</div>)}
            </div>
            {POLL_L.map((rp,ri)=>(
              <div key={ri} style={{ display:"flex", gap:2, alignItems:"center", marginBottom:2 }}>
                <div style={{ width:38, fontSize:9, color:T.muted, fontWeight:600, textAlign:"right", paddingRight:6, flexShrink:0 }}>{rp}</div>
                {CORR[ri].map((v,ci)=>(
                  <div key={ci} style={{ width:38, height:28, background:corrVal(v), borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:600, color:"rgba(0,0,0,0.7)" }}>
                    {v.toFixed(2)}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ flex:1, background:T.bg, borderRadius:8, padding:"12px 14px", fontSize:11, color:T.secondary, lineHeight:1.7 }}>
            <b style={{ color:T.ink }}>Gujarat findings:</b><br/>
            PM2.5–PM10 r=0.88 — shared combustion sources.<br/>
            SO₂–CO r=0.72 — industrial co-emission in GIDC zones.<br/>
            O₃ near-independent — photochemical, peaks in summer.<br/>
            NO₂–PM2.5 r=0.64 — higher in metros than industrial towns.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SLIDE 9 — Findings ─────────────────────────────────────────────────────
function S9() {
  const findings = [
    { label:"Vapi — most polluted",   value:"AQI 178",  sub:"2nd most polluted in western India (CSE). SO₂ and CO from chemical GIDC dominate.", good:false },
    { label:"Gandhinagar — cleanest", value:"AQI 78",   sub:"Planned capital 30km from Ahmedabad. City planning matters more than geography.", good:true },
    { label:"COVID dip",              value:"−35–47%",  sub:"2020 lockdown caused sharp PM2.5 drop. Industrial shutdown > traffic reduction.", good:true },
    { label:"Winter peaks",           value:"Nov–Dec",  sub:"Vapi hits 138 μg/m³ in November — 9× WHO guideline. Temperature inversions trap pollutants.", good:false },
    { label:"SO₂–CO correlation",     value:"r = 0.72", sub:"Industrial boilers burning high-sulphur fuel. Co-emission specific to GIDC zones.", good:null },
    { label:"Clustering result",      value:"3 tiers",  sub:"Industrial type, not geography, drives the cluster separation. Silhouette 0.61.", good:null },
  ];
  return (
    <div>
      <SlideHeader eyebrow="09 · Conclusions" title="Key Findings" subtitle="From CPCB Gujarat data · 5 nearby cities · 3 distinct risk tiers" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
        {findings.map((f,i)=>(
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"18px 20px" }}>
            <div style={{ fontSize:10, fontWeight:600, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:6 }}>{f.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:f.good===true?AQI.good.fg:f.good===false?AQI.unhealthy.fg:T.ink, marginBottom:8 }}>{f.value}</div>
            <p style={{ margin:0, fontSize:12, color:T.secondary, lineHeight:1.6 }}>{f.sub}</p>
          </div>
        ))}
      </div>
      <div style={{ background:T.ink, borderRadius:12, padding:"22px 28px", display:"flex", alignItems:"center", gap:20 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:5 }}>Project Outcome</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>
            CPCB Gujarat CSVs → auto-column detection → ~300 clean monthly records → K-Means (k=3, silhouette 0.61) → 5 nearby cities in 3 clear risk tiers. Live AQI fetched automatically via WAQI API. All cities in Gujarat — clustering driven by industrial type, not geography.
          </div>
        </div>
        <div style={{ display:"flex", gap:24, flexShrink:0 }}>
          {[["0.61","Silhouette"],["3","Risk zones"],["5","Cities"],["1","State"]].map(([v,l])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:30, fontWeight:700, color:"#fff" }}>{v}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
const SLIDES = [
  { id:"01", label:"AQI",      Comp:"s1" },
  { id:"02", label:"Cities",   Comp:"s2" },
  { id:"03", label:"Pipeline", Comp:"s3" },
  { id:"04", label:"Method",   Comp:"s4" },
  { id:"05", label:"Clusters", Comp:"s5" },
  { id:"06", label:"Map",      Comp:"s6" },
  { id:"07", label:"Trends",   Comp:"s7" },
  { id:"08", label:"Patterns", Comp:"s8" },
  { id:"09", label:"Findings", Comp:"s9" },
];

export default function App() {
  const [idx, setIdx] = useState(0);
  const N = SLIDES.length;

  useEffect(() => {
    const h = e => {
      if (e.key==="ArrowRight"||e.key==="ArrowDown") setIdx(p=>Math.min(p+1,N-1));
      if (e.key==="ArrowLeft" ||e.key==="ArrowUp")   setIdx(p=>Math.max(p-1,0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [N]);

  const renderSlide = () => {
    const k = SLIDES[idx].Comp;
    if (k==="s1") return <S1 />;
    if (k==="s2") return <S2 />;
    if (k==="s3") return <S3 />;
    if (k==="s4") return <S4 />;
    if (k==="s5") return <S5 />;
    if (k==="s6") return <S6 />;
    if (k==="s7") return <S7 />;
    if (k==="s8") return <S8 />;
    return <S9 />;
  };

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.ink, fontFamily:"'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:${T.bg}; }
        ::-webkit-scrollbar-thumb { background:${T.border}; border-radius:2px; }
        button:focus { outline:none; }
        input:focus { border-color:#1A1A18 !important; }
      `}</style>

      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:`${T.bg}f0`, backdropFilter:"blur(12px)", borderBottom:`1px solid ${T.border}`, padding:"10px 40px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:T.accent, display:"inline-block" }} />
          Gujarat AQ
        </div>
        <div style={{ flex:1, display:"flex", gap:2, justifyContent:"center" }}>
          {SLIDES.map((sl,i)=>(
            <button key={i} onClick={()=>setIdx(i)}
              style={{ background:i===idx?T.ink:"transparent", border:`1px solid ${i===idx?T.ink:T.border}`, borderRadius:6, padding:"4px 11px", fontSize:11, color:i===idx?"#fff":T.muted, cursor:"pointer", fontWeight:i===idx?600:400, transition:"all 0.15s" }}>
              {sl.id} {sl.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color:T.muted, whiteSpace:"nowrap" }}>{idx+1} / {N}</div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"68px 40px 56px" }}>
        {renderSlide()}
      </div>

      {idx > 0 && (
        <button onClick={()=>setIdx(p=>p-1)}
          style={{ position:"fixed", left:12, top:"50%", transform:"translateY(-50%)", background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, color:T.secondary, fontSize:18, width:32, height:44, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>‹</button>
      )}
      {idx < N-1 && (
        <button onClick={()=>setIdx(p=>p+1)}
          style={{ position:"fixed", right:12, top:"50%", transform:"translateY(-50%)", background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, color:T.secondary, fontSize:18, width:32, height:44, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>›</button>
      )}

      <div style={{ position:"fixed", bottom:14, left:0, right:0, display:"flex", justifyContent:"center", gap:5, zIndex:100 }}>
        {SLIDES.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)}
            style={{ width:i===idx?20:5, height:5, borderRadius:3, background:i===idx?T.ink:T.border, border:"none", cursor:"pointer", transition:"all 0.25s", padding:0 }} />
        ))}
      </div>
    </div>
  );
}
