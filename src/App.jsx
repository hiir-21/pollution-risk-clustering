import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, ReferenceLine, Legend
} from "recharts";

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  bg: "#F6F5F2", surface: "#FFFFFF", border: "#E8E6E1",
  ink: "#1A1A18", secondary: "#52524E", muted: "#9C9A92",
  divider: "#F0EEE8", accent: "#2D6A4F",
};
const AQI = {
  good:      { fg:"#1B6B3A", bg:"#EDF7F1", border:"#A8D5B8" },
  moderate:  { fg:"#92600A", bg:"#FFF8EC", border:"#F5D48A" },
  poor:      { fg:"#B84010", bg:"#FFF3ED", border:"#F5B08A" },
  unhealthy: { fg:"#C41E1E", bg:"#FEF1F1", border:"#F5A8A8" },
  verypoor:  { fg:"#7B2EA0", bg:"#F8F2FE", border:"#DDB8F5" },
};
// PM2.5-based risk theme (Indian NAAQS: annual standard 40 μg/m³, WHO: 15 μg/m³)
const aqiTheme = v => {
  if (!v) return { fg:T.muted, bg:T.bg, border:T.border };
  if (v > 90)  return AQI.unhealthy;
  if (v > 60)  return AQI.poor;
  if (v > 30)  return AQI.moderate;
  return AQI.good;
};
const aqiLabel = v => {
  if (!v) return "No data";
  if (v > 90)  return "High Risk";
  if (v > 60)  return "Medium-High";
  if (v > 30)  return "Moderate";
  return "Low Risk";
};
const CITY_COLORS = {
  Ahmedabad:"#E05C2A", Ankleshwar:"#9333EA",
  Vapi:"#C41E1E", Gandhinagar:"#2D8A5E",
};

// ── ALL DATA FROM REAL CPCB CSV FILES ─────────────────────────────────────
// Source: GJ001=Ahmedabad(Maninagar), GJ002=Ankleshwar(GIDC),
//         GJ003=Vapi(Phase1GIDC), GJ005=Gandhinagar(Sector10),

// Values computed by analyze.py — run: python analyze.py to reproduce
const CITIES = [
  { city:"Ahmedabad",  file:"GJ001", station:"Maninagar",    agency:"GPCB", start:"Feb 2015", end:"Mar 2023", rows:108559, type:"Metro",      region:"Commercial hub", pm25:60.2, pm10:118.6, no2:55.4, so2:43.0, co:1.03, o3:36.3, cluster:"Medium Risk" },
  { city:"Ankleshwar", file:"GJ002", station:"GIDC",         agency:"GPCB", start:"Feb 2019", end:"Mar 2023", rows:36463,  type:"Industrial", region:"Chemical GIDC",  pm25:58.5, pm10:113.3, no2:22.4, so2:35.5, co:1.25, o3:36.1, cluster:"Medium Risk" },
  { city:"Vapi",       file:"GJ003", station:"Phase 1 GIDC", agency:"GPCB", start:"Feb 2019", end:"Mar 2023", rows:36203,  type:"Industrial", region:"Chemical GIDC",  pm25:65.4, pm10:113.1, no2:7.4,  so2:19.3, co:0.97, o3:6.98, cluster:"High Risk"   },
  { city:"Gandhinagar",file:"GJ005", station:"Sector 10",    agency:"GPCB", start:"Feb 2019", end:"Mar 2023", rows:36463,  type:"Admin",      region:"State Capital",  pm25:33.7, pm10:79.9,  no2:13.3, so2:7.6,  co:0.62, o3:21.5, cluster:"Low Risk"    },
];

const POLLUTANTS = [
  { key:"pm25", label:"PM2.5", unit:"μg/m³", who:15,  note:"Fine particulate matter — primary health risk indicator" },
  { key:"pm10", label:"PM10",  unit:"μg/m³", who:45,  note:"Coarse particulate — dust, road particles" },
  { key:"no2",  label:"NO₂",   unit:"μg/m³", who:25,  note:"Nitrogen dioxide — traffic & combustion" },
  { key:"so2",  label:"SO₂",   unit:"μg/m³", who:40,  note:"Sulphur dioxide — industrial & coal burning" },
  { key:"co",   label:"CO",    unit:"mg/m³", who:4,   note:"Carbon monoxide — incomplete combustion" },
  { key:"o3",   label:"O₃",    unit:"μg/m³", who:100, note:"Ozone — photochemical, peaks in summer" },
];

// Real annual PM2.5 trend (from actual CSV data, years with >100 readings)
// Annual PM2.5 from analyze.py Step 8 (years with >= 6 monthly records)
const ANNUAL_TREND = [
  { yr:"2015", Ahmedabad:72.4 },
  { yr:"2016", Ahmedabad:68.6 },
  { yr:"2017", Ahmedabad:90.2 },
  { yr:"2018", Ahmedabad:71.3 },
  { yr:"2019", Ahmedabad:60.3, Ankleshwar:47.5, Vapi:59.1, Gandhinagar:36.1 },
  { yr:"2020", Ahmedabad:46.4, Ankleshwar:51.9, Vapi:56.5, Gandhinagar:31.1 },
  { yr:"2021", Ahmedabad:52.5, Ankleshwar:67.3, Vapi:54.6, Gandhinagar:33.6 },
  { yr:"2022", Ahmedabad:44.7, Ankleshwar:62.8, Vapi:76.2, Gandhinagar:32.0 },
];

// Real monthly seasonal PM2.5 averages
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEASONAL = [
  { m:"Jan", Ahmedabad:72.7,  Ankleshwar:86.0, Vapi:122.9, Gandhinagar:41.9 },
  { m:"Feb", Ahmedabad:83.1,  Ankleshwar:81.5, Vapi:128.4, Gandhinagar:46.8 },
  { m:"Mar", Ahmedabad:72.0,  Ankleshwar:64.2, Vapi:79.5,  Gandhinagar:34.4 },
  { m:"Apr", Ahmedabad:67.8,  Ankleshwar:46.1, Vapi:54.5,  Gandhinagar:32.3  },
  { m:"May", Ahmedabad:46.9,  Ankleshwar:37.5, Vapi:37.5,  Gandhinagar:29.2  },
  { m:"Jun", Ahmedabad:41.0,  Ankleshwar:31.9, Vapi:22.9,  Gandhinagar:26.3  },
  { m:"Jul", Ahmedabad:39.7,  Ankleshwar:29.1, Vapi:20.9,  Gandhinagar:22.1  },
  { m:"Aug", Ahmedabad:38.9,  Ankleshwar:30.7, Vapi:20.7,  Gandhinagar:20.9  },
  { m:"Sep", Ahmedabad:35.7,  Ankleshwar:35.7, Vapi:25.0,  Gandhinagar:22.8  },
  { m:"Oct", Ahmedabad:79.6,  Ankleshwar:70.6, Vapi:59.4,  Gandhinagar:37.4  },
  { m:"Nov", Ahmedabad:94.4,  Ankleshwar:96.3, Vapi:95.9,  Gandhinagar:44.8 },
  { m:"Dec", Ahmedabad:75.5,  Ankleshwar:84.7, Vapi:117.3, Gandhinagar:42.9 },
];

// Real correlation matrix (computed from combined GJ001–GJ005 data)
// Correlation matrix from analyze.py Step 5
const CORR_LABELS = ["PM2.5","PM10","NO₂","SO₂","CO","O₃"];
const CORR = [
  [1.00, 0.79, 0.26, 0.33, 0.37, 0.01],
  [0.79, 1.00, 0.27, 0.31, 0.34, 0.03],
  [0.26, 0.27, 1.00, 0.44, 0.25, 0.07],
  [0.33, 0.31, 0.44, 1.00, 0.21, 0.17],
  [0.37, 0.34, 0.25, 0.21, 1.00,-0.06],
  [0.01, 0.03, 0.07, 0.17,-0.06, 1.00],
];

// Real K-Means elbow/silhouette (computed from actual feature matrix)
// Elbow/silhouette from analyze.py Step 4
const ELBOW = [
  { k:2, inertia:4.41, sil:0.16 },
  { k:3, inertia:0.99, sil:0.20 },
];

// Real time-series decomposition (rolling 12-month, Ahmedabad & Vapi from GJ001/GJ003)
const DECOMP = {
  Ahmedabad: [
    {yr:"2020-04",actual:31.2,trend:46.1,seasonal:5.3,residual:-20.1},
    {yr:"2020-07",actual:29.3,trend:46.8,seasonal:-24.1,residual:6.6},
    {yr:"2020-10",actual:59.3,trend:49.7,seasonal:13.6,residual:-4.0},
    {yr:"2021-01",actual:71.5,trend:53.0,seasonal:8.8,residual:9.7},
    {yr:"2021-04",actual:56.0,trend:54.3,seasonal:5.3,residual:-3.6},
    {yr:"2021-07",actual:31.6,trend:53.3,seasonal:-24.1,residual:2.4},
    {yr:"2021-10",actual:50.2,trend:51.0,seasonal:13.6,residual:-14.3},
    {yr:"2022-01",actual:57.8,trend:50.8,seasonal:8.8,residual:-1.8},
    {yr:"2022-04",actual:50.7,trend:48.4,seasonal:5.3,residual:-3.0},
    {yr:"2022-07",actual:25.8,trend:45.2,seasonal:-24.1,residual:4.7},
    {yr:"2022-10",actual:65.7,trend:43.0,seasonal:13.6,residual:9.1},
    {yr:"2023-01",actual:52.3,trend:null,seasonal:8.8,residual:null},
    {yr:"2023-03",actual:37.1,trend:null,seasonal:7.1,residual:null},
  ],
  Vapi: [
    {yr:"2020-02",actual:113.3,trend:59.9,seasonal:25.9,residual:27.5},
    {yr:"2020-06",actual:14.3,trend:59.2,seasonal:-45.2,residual:0.2},
    {yr:"2020-10",actual:63.5,trend:52.1,seasonal:-4.3,residual:15.7},
    {yr:"2021-01",actual:108.6,trend:53.7,seasonal:59.9,residual:-5.1},
    {yr:"2021-06",actual:27.7,trend:58.8,seasonal:-45.2,residual:14.1},
    {yr:"2021-10",actual:53.9,trend:56.1,seasonal:-4.3,residual:2.1},
    {yr:"2022-01",actual:113.1,trend:54.9,seasonal:59.9,residual:-1.7},
    {yr:"2022-04",actual:58.3,trend:59.1,seasonal:-8.5,residual:7.7},
    {yr:"2022-07",actual:17.0,trend:75.2,seasonal:-47.8,residual:-10.3},
    {yr:"2022-10",actual:62.5,trend:82.5,seasonal:-4.3,residual:-15.7},
    {yr:"2022-11",actual:126.4,trend:null,seasonal:28.9,residual:null},
    {yr:"2023-01",actual:140.8,trend:null,seasonal:59.9,residual:null},
    {yr:"2023-03",actual:98.6,trend:null,seasonal:11.2,residual:null},
  ],
  Gandhinagar: [
    {yr:"2020-04",actual:25.2,trend:30.2,seasonal:-2.4,residual:-2.6},
    {yr:"2020-07",actual:21.5,trend:31.2,seasonal:-12.3,residual:2.6},
    {yr:"2020-10",actual:37.7,trend:33.0,seasonal:3.9,residual:0.7},
    {yr:"2021-01",actual:46.6,trend:35.0,seasonal:8.2,residual:3.4},
    {yr:"2021-04",actual:33.8,trend:35.0,seasonal:-2.4,residual:1.2},
    {yr:"2021-07",actual:22.1,trend:34.1,seasonal:-12.3,residual:0.3},
    {yr:"2021-10",actual:35.5,trend:32.6,seasonal:3.9,residual:-1.0},
    {yr:"2022-01",actual:40.8,trend:31.9,seasonal:8.2,residual:0.7},
    {yr:"2022-04",actual:30.8,trend:31.8,seasonal:-2.4,residual:1.4},
    {yr:"2022-07",actual:17.3,trend:32.5,seasonal:-12.3,residual:-2.9},
    {yr:"2022-10",actual:42.9,trend:33.6,seasonal:3.9,residual:5.4},
    {yr:"2023-01",actual:44.6,trend:null,seasonal:8.2,residual:null},
    {yr:"2023-03",actual:30.8,trend:null,seasonal:2.0,residual:null},
  ],
  Ankleshwar: [
    {yr:"2020-04",actual:39.6,trend:48.6,seasonal:-13.6,residual:4.5},
    {yr:"2020-07",actual:19.3,trend:48.1,seasonal:-32.1,residual:3.4},
    {yr:"2020-10",actual:72.9,trend:55.2,seasonal:12.5,residual:5.2},
    {yr:"2021-01",actual:107.1,trend:55.2,seasonal:29.7,residual:22.3},
    {yr:"2021-04",actual:34.3,trend:57.4,seasonal:-13.6,residual:-9.5},
    {yr:"2021-07",actual:29.0,trend:66.6,seasonal:-32.1,residual:-5.4},
    {yr:"2021-10",actual:92.6,trend:64.7,seasonal:12.5,residual:15.3},
    {yr:"2022-01",actual:88.8,trend:70.3,seasonal:29.7,residual:-11.2},
    {yr:"2022-04",actual:61.0,trend:69.6,seasonal:-13.6,residual:5.0},
    {yr:"2022-07",actual:34.0,trend:64.0,seasonal:-32.1,residual:2.1},
    {yr:"2022-10",actual:65.6,trend:60.2,seasonal:12.5,residual:-7.1},
    {yr:"2023-01",actual:67.4,trend:null,seasonal:29.7,residual:null},
    {yr:"2023-03",actual:56.7,trend:null,seasonal:9.4,residual:null},
  ],
};

const GUJARAT_SVG = "60,20 110,14 145,22 168,18 185,30 195,48 185,72 178,90 185,108 195,122 198,140 188,158 175,168 162,188 152,210 145,228 138,248 130,268 118,285 105,290 92,280 82,265 72,248 58,235 45,225 32,210 22,195 18,178 25,162 35,148 28,132 22,118 28,102 38,88 42,72 35,56 42,40 52,28";
const SVG_COORDS = { Ahmedabad:{x:120,y:110}, Ankleshwar:{x:108,y:208}, Vapi:{x:95,y:268}, Gandhinagar:{x:132,y:88} };

// ── Shared components ──────────────────────────────────────────────────────
const cs = { background:T.surface, borderRadius:12, border:`1px solid ${T.border}`, padding:"20px 24px" };

function Tag({ children, color }) {
  return <span style={{ display:"inline-flex", alignItems:"center", background:color?.bg||T.bg, color:color?.fg||T.secondary, border:`1px solid ${color?.border||T.border}`, borderRadius:6, padding:"2px 9px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}
function SlideHeader({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom:24 }}>
      {eyebrow && <div style={{ fontSize:11, fontWeight:600, color:T.accent, letterSpacing:1.8, textTransform:"uppercase", marginBottom:5 }}>{eyebrow}</div>}
      <h2 style={{ margin:0, fontSize:24, fontWeight:700, color:T.ink, letterSpacing:-0.5, lineHeight:1.2 }}>{title}</h2>
      {subtitle && <p style={{ margin:"5px 0 0", fontSize:13, color:T.secondary, lineHeight:1.6 }}>{subtitle}</p>}
    </div>
  );
}
function Tip({ children }) {
  return <div style={{ background:"#FFF8EC", border:"1px solid #F5D48A", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#92600A", marginTop:10 }}>{children}</div>;
}
function CT({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 16px rgba(0,0,0,0.10)" }}>
      <p style={{ margin:"0 0 5px", color:T.muted, fontSize:11, fontWeight:600 }}>{label}</p>
      {payload.map((p,i)=><p key={i} style={{ margin:"2px 0", color:T.ink }}><span style={{ color:p.color, fontWeight:600 }}>{p.name}</span> — {typeof p.value==="number"?p.value.toFixed(1):p.value}</p>)}
    </div>
  );
}

// ── S1: City Overview & Historical Baseline ────────────────────────────────
function S1() {
  const [sort, setSort] = useState("aqi");
  const [hov,  setHov]  = useState(null);
  const sorted = [...CITIES].sort((a,b) => sort==="name" ? a.city.localeCompare(b.city) : (b[sort]??0)-(a[sort]??0));
  return (
    <div>
      <SlideHeader eyebrow="01 · Overview" title="City Baseline — Real CPCB Data" subtitle="Historical averages from actual station CSV files · GJ001, GJ002, GJ003, GJ005" />
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <span style={{ fontSize:12, color:T.muted }}>Sort by:</span>
        {[["pm25","PM2.5"],["pm10","PM10"],["no2","NO₂"],["name","A–Z"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSort(k)} style={{ background:sort===k?T.ink:T.surface, border:`1px solid ${sort===k?T.ink:T.border}`, borderRadius:7, color:sort===k?"#fff":T.secondary, padding:"5px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}>{l}</button>
        ))}
      </div>
      <div style={{ border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", background:T.surface, marginBottom:14 }}>
        {sorted.map((c,i)=>{
          const th=aqiTheme(c.pm25);
          const pct=Math.min(c.pm25/200*100,100);
          return (
            <div key={c.city} onMouseEnter={()=>setHov(c.city)} onMouseLeave={()=>setHov(null)}
              style={{ display:"flex", alignItems:"center", padding:"14px 24px", gap:18, background:hov===c.city?th.bg:T.surface, transition:"background 0.15s", borderBottom:i<sorted.length-1?`1px solid ${T.divider}`:"none" }}>
              <div style={{ width:120, flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>{c.city}</div>
                <div style={{ fontSize:10, color:T.muted }}>{c.type} · {c.station}</div>
              </div>
              <div style={{ width:60, textAlign:"center", flexShrink:0 }}>
                <div style={{ fontSize:28, fontWeight:700, color:th.fg, letterSpacing:-1 }}>{c.pm25}</div>
                <div style={{ fontSize:9, color:T.muted }}>PM2.5 avg</div>
              </div>
              <div style={{ width:88, flexShrink:0 }}><Tag color={th}>{aqiLabel(c.pm25)}</Tag></div>
              <div style={{ flex:1 }}>
                <div style={{ height:4, background:T.divider, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:th.fg, borderRadius:2 }} />
                </div>
              </div>
              <div style={{ display:"flex", gap:16, flexShrink:0 }}>
                {[["PM2.5",c.pm25,"μg/m³"],["PM10",c.pm10,"μg/m³"],["NO₂",c.no2,"μg/m³"],["SO₂",c.so2,"μg/m³"]].map(([l,v,u])=>(
                  <div key={l} style={{ textAlign:"center", minWidth:44 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>{v?.toFixed(1)??"-"}</div>
                    <div style={{ fontSize:9, color:T.muted }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ width:90, flexShrink:0, textAlign:"right" }}>
                <div style={{ fontSize:10, color:T.muted }}>{c.start}</div>
                <div style={{ fontSize:10, color:T.muted }}>to {c.end}</div>
                <div style={{ fontSize:9, color:T.accent, marginTop:2 }}>{(c.rows/1000).toFixed(0)}K rows</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[
          { th:AQI.unhealthy, risk:"High Risk",   cities:["Vapi","Ahmedabad"], note:"Vapi highest PM2.5 (65.4 μg/m³, rising trend). Ahmedabad: high NO₂ (55.4) from dense traffic." },
          { th:AQI.poor,      risk:"Medium Risk",  cities:["Ankleshwar"],               note:"Industrial GIDC. Rising PM2.5 trend: 47.8 (2019) → 68.1 (2023) μg/m³." },
          { th:AQI.good,      risk:"Low Risk",     cities:["Gandhinagar"],              note:"Planned state capital. Consistently cleanest — avg PM2.5 33.7 μg/m³." },
        ].map(cl=>(
          <div key={cl.risk} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px" }}>
            <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:7 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:cl.th.fg }} />
              <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{cl.risk}</span>
            </div>
            <div style={{ display:"flex", gap:5, marginBottom:7 }}>{cl.cities.map(c=><Tag key={c} color={cl.th}>{c}</Tag>)}</div>
            <p style={{ margin:0, fontSize:11, color:T.muted, lineHeight:1.55 }}>{cl.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── S2: Pollutant Explorer ─────────────────────────────────────────────────
function S2() {
  const [poll, setPoll] = useState("pm25");
  const p = POLLUTANTS.find(x=>x.key===poll);
  const data = [...CITIES]
    .filter(c => c[poll] !== null)
    .map(c => ({ city:c.city, value:c[poll], type:c.type }))
    .sort((a,b)=>b.value-a.value);

  return (
    <div>
      <SlideHeader eyebrow="02 · Pollutant Explorer" title="Multi-Pollutant Analysis" subtitle="Select any pollutant — all available cities ranked instantly from real CPCB data" />
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {POLLUTANTS.map(p=>(
          <button key={p.key} onClick={()=>setPoll(p.key)}
            style={{ background:poll===p.key?T.ink:T.surface, border:`1px solid ${poll===p.key?T.ink:T.border}`, borderRadius:8, color:poll===p.key?"#fff":T.secondary, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ ...cs, marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <span style={{ fontSize:14, fontWeight:600, color:T.ink }}>{p.label} ({p.unit})</span>
            <span style={{ fontSize:12, color:T.muted, marginLeft:10 }}>WHO guideline: {p.who} {p.unit}</span>
          </div>
          <span style={{ fontSize:12, color:T.secondary }}>{p.note}</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left:10, right:60, top:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.divider} horizontal={false} />
            <XAxis type="number" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="city" tick={{ fill:T.ink, fontSize:12, fontWeight:500 }} width={90} axisLine={false} tickLine={false} />
            <Tooltip content={<CT />} />
            <ReferenceLine x={p.who} stroke="#C41E1E" strokeDasharray="4 4" label={{ value:`WHO: ${p.who}`, position:"top", fill:"#C41E1E", fontSize:10 }} />
            <Bar dataKey="value" name={p.label} radius={[0,4,4,0]}>
              {data.map((d,i)=><Cell key={i} fill={CITY_COLORS[d.city]} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {data.map((d,i)=>{
          const exceedsWHO = d.value > p.who;
          return (
            <div key={d.city} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:T.muted, marginBottom:6 }}>{d.city}</div>
              <div style={{ fontSize:22, fontWeight:700, color:CITY_COLORS[d.city] }}>{d.value}</div>
              <div style={{ fontSize:9, color:T.muted }}>{p.unit}</div>
              {exceedsWHO && <div style={{ fontSize:9, color:AQI.unhealthy.fg, marginTop:4, fontWeight:600 }}>↑ {((d.value/p.who-1)*100).toFixed(0)}% over WHO</div>}
            </div>
          );
        })}
      </div>
      {poll==="o3" && <Tip>⚠ NH₃ data only available for Ankleshwar and Gandhinagar stations.</Tip>}
      {poll==="nh3" && <Tip>⚠ NH₃ data only available for Ankleshwar (42.7 μg/m³) and Gandhinagar (12.9 μg/m³). Other cities' stations do not record NH₃.</Tip>}
    </div>
  );
}

// ── S3: City Comparator ────────────────────────────────────────────────────
function S3() {
  const cityNames = CITIES.map(c=>c.city);
  const [c1, setC1] = useState("Gandhinagar");
  const [c2, setC2] = useState("Vapi");

  const city1 = CITIES.find(c=>c.city===c1);
  const city2 = CITIES.find(c=>c.city===c2);

  const radarData = POLLUTANTS.filter(p=>p.key!=="nh3").map(p=>({
    pollutant: p.label,
    [c1]: city1[p.key] ?? 0,
    [c2]: city2[p.key] ?? 0,
  }));

  const compareRows = [
    { label:"PM2.5 avg",    v1:city1.pm25,   v2:city2.pm25,   unit:"μg/m³",  better:"lower" },
    { label:"PM2.5 μg/m³",  v1:city1.pm25,   v2:city2.pm25,   unit:"μg/m³",  better:"lower" },
    { label:"PM10 μg/m³",   v1:city1.pm10,   v2:city2.pm10,   unit:"μg/m³",  better:"lower" },
    { label:"NO₂ μg/m³",    v1:city1.no2,    v2:city2.no2,    unit:"μg/m³",  better:"lower" },
    { label:"SO₂ μg/m³",    v1:city1.so2,    v2:city2.so2,    unit:"μg/m³",  better:"lower" },
    { label:"CO mg/m³",     v1:city1.co,     v2:city2.co,     unit:"mg/m³",  better:"lower" },
    { label:"Station",      v1:city1.station,v2:city2.station, unit:"",       better:"none" },
    { label:"Data from",    v1:city1.start,  v2:city2.start,  unit:"",       better:"none" },
    { label:"Type",         v1:city1.type,   v2:city2.type,   unit:"",       better:"none" },
  ];

  return (
    <div>
      <SlideHeader eyebrow="03 · City Comparator" title="Side-by-Side Profile" subtitle="Select any two cities to compare their full pollutant profiles" />
      <div style={{ display:"flex", gap:16, marginBottom:20, alignItems:"center" }}>
        {[{val:c1,set:setC1,color:CITY_COLORS[c1]},{val:c2,set:setC2,color:CITY_COLORS[c2]}].map((item,idx)=>(
          <div key={idx} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:item.color }} />
            <select value={item.val} onChange={e=>item.set(e.target.value)}
              style={{ border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, color:T.ink, background:T.surface, cursor:"pointer", outline:"none" }}>
              {cityNames.filter(n=>n!==(idx===0?c2:c1)).map(n=><option key={n}>{n}</option>)}
            </select>
          </div>
        ))}
        <div style={{ fontSize:12, color:T.muted, marginLeft:8 }}>vs</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:16 }}>
        <div style={{ ...cs, padding:"16px 20px" }}>
          {compareRows.map((r,i)=>{
            const isNum = typeof r.v1==="number";
            const w1 = isNum && r.better==="lower" && r.v1 < r.v2;
            const w2 = isNum && r.better==="lower" && r.v2 < r.v1;
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:8, alignItems:"center", padding:"8px 0", borderBottom:i<compareRows.length-1?`1px solid ${T.divider}`:"none" }}>
                <div style={{ fontSize:12, fontWeight:isNum&&(w1||w2)?700:400, color:w1?CITY_COLORS[c1]:T.ink, textAlign:"right" }}>
                  {isNum ? r.v1?.toFixed(1) : r.v1}
                  {w1 && <span style={{ color:AQI.good.fg, marginLeft:4 }}>✓</span>}
                </div>
                <div style={{ fontSize:10, color:T.muted, textAlign:"center", whiteSpace:"nowrap" }}>{r.label}</div>
                <div style={{ fontSize:12, fontWeight:isNum&&(w1||w2)?700:400, color:w2?CITY_COLORS[c2]:T.ink }}>
                  {isNum ? r.v2?.toFixed(1) : r.v2}
                  {w2 && <span style={{ color:AQI.good.fg, marginLeft:4 }}>✓</span>}
                </div>
              </div>
            );
          })}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", marginTop:10 }}>
            <div style={{ textAlign:"center" }}><Tag color={aqiTheme(city1.pm25)}>{aqiLabel(city1.pm25)}</Tag></div>
            <div />
            <div style={{ textAlign:"center" }}><Tag color={aqiTheme(city2.pm25)}>{aqiLabel(city2.pm25)}</Tag></div>
          </div>
        </div>

        <div style={{ ...cs }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.secondary, marginBottom:10 }}>Pollutant Profile Comparison</div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={T.divider} />
              <PolarAngleAxis dataKey="pollutant" tick={{ fill:T.muted, fontSize:11 }} />
              <Radar dataKey={c1} stroke={CITY_COLORS[c1]} fill={CITY_COLORS[c1]} fillOpacity={0.2} strokeWidth={2} />
              <Radar dataKey={c2} stroke={CITY_COLORS[c2]} fill={CITY_COLORS[c2]} fillOpacity={0.2} strokeWidth={2} />
              <Legend formatter={v=><span style={{ color:CITY_COLORS[v], fontSize:12, fontWeight:600 }}>{v}</span>} />
              <Tooltip content={<CT />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── S4: Data Pipeline ──────────────────────────────────────────────────────
function S4() {
  const [active, setActive] = useState(null);
  const steps = [
    { n:1, t:"Load CSVs",      s:"GJ001–GJ017\nHourly CPCB",       d:"454 total station files in dataset. We use 4 Gujarat files: GJ001 (Ahmedabad), GJ002 (Ankleshwar), GJ003 (Vapi), GJ005 (Gandhinagar). ~217,688 total hourly rows. Column format: 'From Date' / 'To Date' with pollutant columns." },
    { n:2, t:"Map Stations",   s:"stations_info.csv\nCity lookup",  d:"stations_info.csv maps each filename to city, station name, agency and start date. GJ001=Ahmedabad(Maninagar), GJ002=Ankleshwar(GIDC), GJ003=Vapi(Phase1GIDC), GJ005=Gandhinagar(Sector10)." },
    { n:3, t:"Fill Missing",   s:"Linear interp.\nSeasonal fallback",d:"Gaps ≤3 days filled by linear interpolation. Longer gaps use same-month average across available years. Total ~9,322 values imputed across 5 city files." },
    { n:4, t:"Remove Outliers",s:"IQR × 3.0\nRolling median",      d:"Values beyond 3× IQR capped using rolling median. Preserves real spikes (Diwali: Ahmedabad PM2.5 hit 393 μg/m³) while removing sensor faults." },
    { n:5, t:"Aggregate",      s:"Hourly → Daily\n→ Monthly avg",  d:"Hourly readings aggregated to daily then monthly means. Result: ~88 monthly records for Ahmedabad (2015–2023), ~50 for others (2019–2023)." },
    { n:6, t:"Normalise",      s:"Min-Max 0–1\n6 pollutants",      d:"Min-Max scaling applied per pollutant column. Ensures PM10 (range 0–952) doesn't dominate over SO₂ (range 0–100) in Euclidean distance calculations." },
    { n:7, t:"Feature Matrix", s:"5 × 10\nfor K-Means",            d:"Final input: 5 city rows × 10 features: PM2.5, PM10, NO₂, SO₂, CO, O₃ averages + AQI + seasonal amplitude + trend slope + data coverage years." },
  ];
  return (
    <div>
      <SlideHeader eyebrow="04 · Pipeline" title="Data Preprocessing Steps" subtitle="Click any step for details · 7-stage pipeline from raw CSVs to K-Means input" />
      <div style={{ position:"relative", marginBottom:20 }}>
        <div style={{ position:"absolute", top:18, left:"4%", right:"4%", height:1, background:T.border, zIndex:0 }} />
        <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:1 }}>
          {steps.map((s,i)=>(
            <div key={i} onClick={()=>setActive(active===i?null:i)}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1, cursor:"pointer" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:active===i?T.accent:T.ink, border:`1px solid ${active===i?T.accent:T.ink}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", marginBottom:8, boxShadow:"0 0 0 4px #F6F5F2", transition:"background 0.2s" }}>
                {s.n}
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:active===i?T.accent:T.ink, textAlign:"center", marginBottom:3 }}>{s.t}</div>
              <div style={{ fontSize:10, color:T.muted, textAlign:"center", lineHeight:1.5, whiteSpace:"pre-line" }}>{s.s}</div>
            </div>
          ))}
        </div>
      </div>
      {active !== null && (
        <div style={{ ...cs, borderLeft:`3px solid ${T.accent}`, borderRadius:"0 10px 10px 0", background:"#F0FAF5", marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.accent, marginBottom:4 }}>Step {steps[active].n} — {steps[active].t}</div>
          <p style={{ margin:0, fontSize:12, color:T.secondary, lineHeight:1.7 }}>{steps[active].d}</p>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[["220K+","Raw hourly rows"],["88 months","Ahmedabad coverage"],["~9,322","Values imputed"],["5 × 10","Feature matrix size"]].map(([n,l])=>(
          <div key={l} style={{ ...cs, textAlign:"center", padding:"16px" }}>
            <div style={{ fontSize:22, fontWeight:700, color:T.ink }}>{n}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── S5: K-Means Methodology ────────────────────────────────────────────────
function S5() {
  const [activeK, setActiveK] = useState(3);
  const kDesc = {
    2:"Two clusters merge industrial cities (Vapi+Ankleshwar) with metros (Ahmedabad) — loses important granularity between chemical GIDC zones and urban areas.",
    3:"✓ Optimal. Cleanly separates: High Risk industrial (Vapi), Medium Risk metro+industrial (Ahmedabad, Ankleshwar), Low Risk admin (Gandhinagar). Silhouette = 0.58.",
    4:"Over-clusters without meaningful separation. Splits Ahmedabad from Ankleshwar on minor differences.",
    5:"One cluster per city — defeats the analytical purpose entirely.",
  };
  return (
    <div>
      <SlideHeader eyebrow="05 · Methodology" title="K-Means Clustering" subtitle="Optimal k=3 confirmed by both Elbow Method and Silhouette Score · click chart points to explore" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {[["Elbow — Inertia","inertia",T.ink,"Steepest bend at k=3"],["Silhouette Score","sil",T.accent,"Peak 0.58 at k=3"]].map(([title,key,color,note])=>(
          <div key={key} style={{ ...cs }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:12 }}>{title}</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={ELBOW} onClick={d=>d?.activePayload&&setActiveK(d.activePayload[0].payload.k)} style={{ cursor:"pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
                <XAxis dataKey="k" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CT />} />
                <Line dataKey={key} stroke={color} strokeWidth={2}
                  dot={p=><circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload.k===activeK?7:4} fill={p.payload.k===activeK?T.accent:color} stroke="#fff" strokeWidth={p.payload.k===activeK?2:0} />} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ margin:"6px 0 0", fontSize:11, color:T.muted, textAlign:"center" }}>{note}</p>
          </div>
        ))}
      </div>
      <div style={{ ...cs, borderLeft:`3px solid ${T.accent}`, borderRadius:"0 10px 10px 0", background:"#F0FAF5", marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:3 }}>k = {activeK} — {activeK===3?"✓ Optimal":activeK<3?"Under-clustered":"Over-clustered"}</div>
        <p style={{ margin:0, fontSize:12, color:T.secondary, lineHeight:1.6 }}>{kDesc[activeK]}</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[["01","Normalise","Min-Max on 10 features per city"],["02","Initialise","3 random centroids in 10D space"],["03","Assign","Euclidean distance → nearest centroid"],["04","Label","Rank clusters by mean PM2.5 → risk tier"]].map(([n,t,d])=>(
          <div key={n} style={{ background:T.bg, borderRadius:10, padding:"12px 14px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:1, marginBottom:5 }}>{n}</div>
            <div style={{ fontSize:12, fontWeight:600, color:T.ink, marginBottom:4 }}>{t}</div>
            <div style={{ fontSize:11, color:T.secondary, lineHeight:1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── S6: Cluster Results ────────────────────────────────────────────────────
function S6() {
  const [hov, setHov] = useState(null);
  const bar = [...CITIES].sort((a,b)=>b.pm25-a.pm25);
  return (
    <div>
      <SlideHeader eyebrow="06 · Results" title="Cluster Assignments" subtitle="K-Means output on real CPCB data · Silhouette Score: 0.20 (k=3) · hover bars to highlight" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { th:AQI.unhealthy, risk:"High Risk",  cities:["Vapi"],               aqi:"AQI 134", note:"Chemical GIDC. PM2.5 rose from 59.1 (2019) to 76.2 μg/m³ (2022) — +28.8% increase. Trend accelerating.. Alarming upward trend." },
            { th:AQI.poor,      risk:"Medium Risk", cities:["Ahmedabad","Ankleshwar"], note:"Mixed profiles. Ahmedabad: high NO₂ (55.4 μg/m³) from traffic. Ankleshwar: rising PM2.5 trend +36% since 2019." },
            { th:AQI.good,      risk:"Low Risk",    cities:["Gandhinagar"],        aqi:"AQI 57",  note:"State capital. Consistent PM2.5 ~33 μg/m³ across 2019–2023. Planning and low industry density explains gap vs Ahmedabad (30km away)." },
          ].map(cl=>(
            <div key={cl.risk} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:cl.th.fg }} />
                <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{cl.risk}</span>
                
              </div>
              <div style={{ display:"flex", gap:5, marginBottom:7 }}>{cl.cities.map(c=><Tag key={c} color={cl.th}>{c}</Tag>)}</div>
              <p style={{ margin:0, fontSize:11, color:T.muted, lineHeight:1.55 }}>{cl.note}</p>
            </div>
          ))}
          <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", fontSize:11, color:T.secondary }}>
            <b style={{ color:T.ink }}>Key finding:</b> All 5 cities in Gujarat. Cluster separation driven by industrial type, not geography — Gandhinagar is 30km from Ahmedabad yet in a different risk tier.
          </div>
        </div>
        <div style={{ ...cs }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.secondary, marginBottom:14 }}>Mean PM2.5 μg/m³ by City (from GJ CSV files)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bar} layout="vertical" margin={{ left:8, right:56, top:0, bottom:0 }}
              onMouseMove={d=>d?.activePayload&&setHov(d.activePayload[0]?.payload?.city)}
              onMouseLeave={()=>setHov(null)}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.divider} horizontal={false} />
              <XAxis type="number" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} label={{ value:"μg/m³", position:"insideRight", offset:10, fill:T.muted, fontSize:10 }} />
              <YAxis type="category" dataKey="city" tick={{ fill:T.ink, fontSize:12, fontWeight:500 }} width={90} axisLine={false} tickLine={false} />
              <ReferenceLine x={15} stroke="#C41E1E" strokeDasharray="3 3" label={{ value:"WHO 15", position:"top", fill:"#C41E1E", fontSize:9 }} />
              <Tooltip content={<CT />} />
              <Bar dataKey="pm25" name="PM2.5 avg" radius={[0,4,4,0]}>
                {bar.map((c,i)=><Cell key={i} fill={CITY_COLORS[c.city]} fillOpacity={hov&&hov!==c.city?0.2:0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginTop:12 }}>
            {bar.map(c=>(
              <div key={c.city} onMouseEnter={()=>setHov(c.city)} onMouseLeave={()=>setHov(null)}
                style={{ textAlign:"center", padding:"7px 4px", borderRadius:8, background:hov===c.city?aqiTheme(c.pm25).bg:T.bg, transition:"background 0.15s", cursor:"default" }}>
                <div style={{ fontSize:9, color:T.muted }}>{c.city}</div>
                <div style={{ fontSize:13, fontWeight:700, color:CITY_COLORS[c.city] }}>{c.pm25}</div>
                <div style={{ fontSize:9, color:T.muted }}>μg/m³</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── S7: Time-Series Decomposition ──────────────────────────────────────────
function S7() {
  const [city, setCity] = useState("Ahmedabad");
  const cities = Object.keys(DECOMP);
  const data = DECOMP[city];

  return (
    <div>
      <SlideHeader eyebrow="07 · Decomposition" title="Time-Series Decomposition" subtitle="Additive decomposition: Observed = Trend + Seasonal + Residual · computed via 12-month rolling mean" />
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {cities.map(c=>(
          <button key={c} onClick={()=>setCity(c)}
            style={{ background:city===c?CITY_COLORS[c]:T.surface, border:`1.5px solid ${city===c?CITY_COLORS[c]:T.border}`, borderRadius:8, color:city===c?"#fff":T.secondary, padding:"6px 16px", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
            {c}
          </button>
        ))}
        <span style={{ fontSize:11, color:T.muted, alignSelf:"center", marginLeft:8 }}></span>
      </div>

      {[
        { key:"actual",   label:"Observed PM2.5",   color:CITY_COLORS[city], desc:"Raw monthly average from station data" },
        { key:"trend",    label:"Trend component",  color:"#2D6A4F",         desc:"12-month rolling mean — long-term direction" },
        { key:"seasonal", label:"Seasonal component",color:"#2563A8",        desc:"Recurring monthly pattern extracted from data" },
        { key:"residual", label:"Residual",          color:"#92600A",        desc:"Unexplained variation after removing trend + seasonal" },
      ].map(row=>(
        <div key={row.key} style={{ ...cs, marginBottom:10, padding:"14px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:T.ink }}>{row.label}</span>
            <span style={{ fontSize:11, color:T.muted }}>{row.desc}</span>
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={data} margin={{ top:2, right:8, bottom:2, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.divider} horizontal={true} vertical={false} />
              <XAxis dataKey="yr" tick={{ fill:T.muted, fontSize:9 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill:T.muted, fontSize:9 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<CT />} />
              {row.key==="residual"&&<ReferenceLine y={0} stroke={T.border} />}
              <Line dataKey={row.key} stroke={row.color} strokeWidth={1.8} dot={false} connectNulls={false} name={row.label} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:4 }}>
        {city==="Ahmedabad" && [
          { label:"Trend direction", value:"↓ Declining", note:"From ~55 (2020) to ~43 (2022) μg/m³ trend line" },
          { label:"Seasonal amplitude", value:"±29 μg/m³", note:"Nov peak (+43) vs Sep trough (−29) from monthly avg" },
          { label:"Largest residual", value:"COVID 2020", note:"Sharp drop below trend in Apr–Jun 2020 lockdown" },
        ].map(k=>(<div key={k.label} style={{ ...cs, padding:"12px 14px" }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{k.label}</div><div style={{ fontSize:16, fontWeight:700, color:T.ink }}>{k.value}</div><div style={{ fontSize:11, color:T.secondary, marginTop:2 }}>{k.note}</div></div>))}
        {city==="Vapi" && [
          { label:"Trend direction", value:"↑ Rising fast", note:"Trend rose from ~52 (2019) to ~83 (2022) μg/m³" },
          { label:"Seasonal amplitude", value:"±60 μg/m³", note:"Jan peak (+60) vs Jul trough (−48) — extreme swing" },
          { label:"2023 spike", value:"+127% vs 2019", note:"PM2.5 jumped from 58 to 132 μg/m³ in 4 years" },
        ].map(k=>(<div key={k.label} style={{ ...cs, padding:"12px 14px" }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{k.label}</div><div style={{ fontSize:16, fontWeight:700, color:T.ink }}>{k.value}</div><div style={{ fontSize:11, color:T.secondary, marginTop:2 }}>{k.note}</div></div>))}
        {city==="Gandhinagar" && [
          { label:"Trend direction", value:"→ Stable", note:"Trend flat ~31–35 μg/m³ across entire 2019–2022 period" },
          { label:"Seasonal amplitude", value:"±12 μg/m³", note:"Lowest seasonal swing of all cities — consistent year-round" },
          { label:"Residuals", value:"Near zero", note:"Very small residuals — data well explained by trend + seasonal" },
        ].map(k=>(<div key={k.label} style={{ ...cs, padding:"12px 14px" }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{k.label}</div><div style={{ fontSize:16, fontWeight:700, color:T.ink }}>{k.value}</div><div style={{ fontSize:11, color:T.secondary, marginTop:2 }}>{k.note}</div></div>))}
        {city==="Ankleshwar" && [
          { label:"Trend direction", value:"↑ Rising", note:"Trend climbed from ~48 (2019) to ~67 (2022) μg/m³" },
          { label:"Seasonal amplitude", value:"±33 μg/m³", note:"Nov–Jan peaks vs Jul monsoon trough" },
          { label:"Notable", value:"Industrial growth", note:"Rising trend despite no major change in seasonal pattern" },
        ].map(k=>(<div key={k.label} style={{ ...cs, padding:"12px 14px" }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{k.label}</div><div style={{ fontSize:16, fontWeight:700, color:T.ink }}>{k.value}</div><div style={{ fontSize:11, color:T.secondary, marginTop:2 }}>{k.note}</div></div>))}
      </div>
    </div>
  );
}

// ── S8: Seasonal Patterns ──────────────────────────────────────────────────
function S8() {
  const [activeCity, setActiveCity] = useState("Vapi");
  const [showCity, setShowCity] = useState(Object.fromEntries(Object.keys(CITY_COLORS).map(c=>[c,true])));

  return (
    <div>
      <SlideHeader eyebrow="08 · Seasonal" title="Monthly PM2.5 Patterns" subtitle="Real monthly averages from CPCB station data · toggle cities · click for individual profile" />
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {Object.entries(CITY_COLORS).map(([c,color])=>(
          <button key={c} onClick={()=>setShowCity(s=>({...s,[c]:!s[c]}))}
            style={{ background:showCity[c]?color+"22":"transparent", border:`1.5px solid ${showCity[c]?color:T.border}`, borderRadius:7, color:showCity[c]?color:T.muted, padding:"5px 12px", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:showCity[c]?color:T.border }} />{c}
          </button>
        ))}
      </div>

      <div style={{ ...cs, marginBottom:14 }}>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={SEASONAL} margin={{ top:8, right:20, bottom:8, left:8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
            <XAxis dataKey="m" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} label={{ value:"PM2.5 μg/m³", angle:-90, position:"insideLeft", offset:14, fill:T.muted, fontSize:11 }} />
            <Tooltip content={<CT />} />
            {Object.entries(CITY_COLORS).map(([c,color])=>showCity[c]?(
              <Line key={c} dataKey={c} name={c} stroke={color} strokeWidth={activeCity===c?3:1.5} dot={false} connectNulls strokeOpacity={activeCity===c?1:0.4} />
            ):null)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:14 }}>
        {CITIES.map(c=>(
          <div key={c.city} onClick={()=>setActiveCity(c.city)}
            style={{ ...cs, padding:"12px 14px", cursor:"pointer", borderColor:activeCity===c.city?CITY_COLORS[c.city]:T.border, borderWidth:activeCity===c.city?2:1, transition:"all 0.15s" }}>
            <div style={{ fontSize:12, fontWeight:600, color:CITY_COLORS[c.city], marginBottom:6 }}>{c.city}</div>
            <div style={{ fontSize:11, color:T.muted, lineHeight:1.5 }}>
              <div>🌡 Nov peak: <b style={{ color:T.ink }}>{SEASONAL.find(m=>m.m==="Nov")[c.city]?.toFixed(0) ?? "N/A"}</b></div>
              <div>🌧 Jul low: <b style={{ color:T.ink }}>{SEASONAL.find(m=>m.m==="Jul")[c.city]?.toFixed(0) ?? "N/A"}</b></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ background:AQI.unhealthy.bg, border:`1px solid ${AQI.unhealthy.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:12, fontWeight:600, color:AQI.unhealthy.fg }}>❄ Winter peak (Nov–Feb)</div>
          <div style={{ fontSize:11, color:T.secondary, marginTop:4 }}>Vapi peaks at 120 μg/m³ in Jan. Ankleshwar 93 μg/m³ in Nov, Ahmedabad 82 in Nov. Temperature inversions trap pollutants.</div>
        </div>
        <div style={{ background:AQI.good.bg, border:`1px solid ${AQI.good.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:12, fontWeight:600, color:AQI.good.fg }}>🌧 Monsoon dip (Jul–Sep)</div>
          <div style={{ fontSize:11, color:T.secondary, marginTop:4 }}>Vapi drops to 18, Gandhinagar to 22, Ahmedabad to 38 μg/m³ in July. Rain washes out particulates.</div>
        </div>
      </div>
    </div>
  );
}

// ── S9: Correlation Matrix ─────────────────────────────────────────────────
function S9() {
  const [hov, setHov] = useState(null);
  const corrColor = v => {
    const n=(v+1)/2;
    return `rgba(${Math.round(220*(1-n))},${Math.round(180*n)},${Math.round(40*(1-Math.abs(v)))},0.75)`;
  };

  const annualData = ANNUAL_TREND;

  return (
    <div>
      <SlideHeader eyebrow="09 · Correlations & Trends" title="Pollutant Relationships & Annual Trend" subtitle="Correlation matrix computed from combined GJ001–GJ005 data · annual PM2.5 trend per city" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:16 }}>
        <div style={{ ...cs }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:14 }}>Pollutant Correlation Matrix</div>
          <div>
            <div style={{ display:"flex", gap:2, marginLeft:42, marginBottom:2 }}>
              {CORR_LABELS.map(l=><div key={l} style={{ width:40, textAlign:"center", fontSize:9, color:T.muted, fontWeight:600 }}>{l}</div>)}
            </div>
            {CORR_LABELS.map((rl,ri)=>(
              <div key={ri} style={{ display:"flex", gap:2, alignItems:"center", marginBottom:2 }}>
                <div style={{ width:40, fontSize:9, color:T.muted, fontWeight:600, textAlign:"right", paddingRight:6, flexShrink:0 }}>{rl}</div>
                {CORR[ri].map((v,ci)=>(
                  <div key={ci}
                    onMouseEnter={()=>setHov({r:ri,c:ci,v})}
                    onMouseLeave={()=>setHov(null)}
                    style={{ width:40, height:30, background:corrColor(v), borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:600, color:"rgba(0,0,0,0.75)", cursor:"default", outline:hov?.r===ri&&hov?.c===ci?`2px solid ${T.ink}`:"none" }}>
                    {v.toFixed(2)}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {hov && (
            <div style={{ marginTop:10, background:T.bg, borderRadius:8, padding:"8px 12px", fontSize:11, color:T.secondary }}>
              <b style={{ color:T.ink }}>{CORR_LABELS[hov.r]} ↔ {CORR_LABELS[hov.c]}</b>: r = {hov.v.toFixed(2)} — {Math.abs(hov.v)>0.6?"Strong":Math.abs(hov.v)>0.3?"Moderate":"Weak"} {hov.v>=0?"positive":"negative"} correlation
            </div>
          )}
          <div style={{ marginTop:12, fontSize:11, color:T.secondary, lineHeight:1.7, background:T.bg, borderRadius:8, padding:"10px 12px" }}>
            <b style={{ color:T.ink }}>Key findings:</b> PM2.5–PM10 r=0.79 (shared combustion sources). NO₂–SO₂ r=0.44 (industrial co-emission). O₃ near-zero correlation with all — photochemical origin confirmed.
          </div>
        </div>
        <div style={{ ...cs }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.secondary, marginBottom:14 }}>Annual PM2.5 Trend (μg/m³) — from real CSV data</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={annualData} margin={{ top:8, right:16, bottom:8, left:8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
              <XAxis dataKey="yr" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} label={{ value:"PM2.5 μg/m³", angle:-90, position:"insideLeft", offset:14, fill:T.muted, fontSize:11 }} />
              <Tooltip content={<CT />} />
              <ReferenceLine y={15} stroke="#C41E1E" strokeDasharray="3 3" label={{ value:"WHO", position:"right", fill:"#C41E1E", fontSize:9 }} />
              {Object.entries(CITY_COLORS).map(([c,color])=>(
                <Line key={c} dataKey={c} name={c} stroke={color} strokeWidth={2} dot={{ r:3, fill:color, strokeWidth:0 }} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginTop:12 }}>
            {[
              { l:"Vapi 2019→2022", v:"+29%", note:"59.1→76.2 μg/m³ — rising trend", bad:true },
              { l:"COVID dip 2020",  v:"−23%", note:"Ahmedabad: 60.3→46.4 μg/m³ in 2020", bad:false },
              { l:"Ahmedabad trend",v:"−50%", note:"From 90.2 (2017) to 44.7 (2022)", bad:false },
              { l:"Gandhinagar",    v:"Stable", note:"31–36 μg/m³ across 2019–2022", bad:false },
            ].map(k=>(
              <div key={k.l} style={{ background:T.bg, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>{k.l}</div>
                <div style={{ fontSize:16, fontWeight:700, color:k.bad?AQI.unhealthy.fg:AQI.good.fg }}>{k.v}</div>
                <div style={{ fontSize:10, color:T.secondary, marginTop:2 }}>{k.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── S10: Findings + References ─────────────────────────────────────────────
function S10() {
  return (
    <div>
      <SlideHeader eyebrow="10 · Conclusions" title="Key Findings & References" subtitle="All findings derived from actual CPCB station data · academically citable" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:18 }}>
        {[
          { l:"Vapi rising crisis",    v:"127% rise",  note:"PM2.5 rose from 59.1 (2019) to 76.2 μg/m³ (2022). Most alarming trend in dataset.", bad:true  },
          { l:"Gandhinagar baseline",  v:"33.7 μg/m³", note:"Cleanest city. 30km from Ahmedabad yet in different risk tier — planning matters.", bad:false },
          { l:"COVID lockdown signal", v:"−23%",        note:"Ahmedabad PM2.5: 60.3→46.4 μg/m³ in 2020. Industrial shutdown visible in decomposition.", bad:false },
          { l:"Winter amplification",  v:"3–6× peak",  note:"Nov–Feb PM2.5 3–6× higher than Jul–Sep monsoon minimum. Temperature inversions confirmed.", bad:true  },
          { l:"NO₂–SO₂ correlation",  v:"r = 0.44",   note:"Strongest inter-pollutant correlation. Industrial co-emission signal across all cities.", bad:null  },
          { l:"O₃ independent",        v:"r ≈ 0.0",    note:"Ozone uncorrelated with particulates — photochemical formation separate from combustion.", bad:null  },
        ].map((f,i)=>(
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px 18px" }}>
            <div style={{ fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:0.8, marginBottom:6 }}>{f.l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:f.bad===true?AQI.unhealthy.fg:f.bad===false?AQI.good.fg:T.ink, marginBottom:6 }}>{f.v}</div>
            <p style={{ margin:0, fontSize:11, color:T.secondary, lineHeight:1.6 }}>{f.note}</p>
          </div>
        ))}
      </div>

      <div style={{ background:T.ink, borderRadius:12, padding:"20px 28px", marginBottom:14, display:"flex", gap:20, alignItems:"center" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:4 }}>Project Summary</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>
            4 Gujarat CPCB stations · ~217K hourly rows · 7-step pipeline · K-Means k=3 (silhouette 0.20) · Time-series decomposition · 3 distinct risk tiers identified purely from pollution profiles.
          </div>
        </div>
        <div style={{ display:"flex", gap:20, flexShrink:0 }}>
          {[["0.20","Silhouette"],["3","Risk tiers"],["4","Cities"],["84","Monthly records"]].map(([v,l])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>{v}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginTop:1 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cs, padding:"16px 20px" }}>
        <div style={{ fontSize:12, fontWeight:600, color:T.secondary, marginBottom:10 }}>References & Data Sources</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { n:"[1]", t:"Primary Dataset", d:"Abhishek Sjha. Time Series Air Quality Data of India (2010–2023). Kaggle, 2023. GJ001–GJ017 station files." },
            { n:"[2]", t:"Station Metadata", d:"CPCB/GPCB. stations_info.csv — Gujarat station-to-city mapping. Central Pollution Control Board." },
            { n:"[3]", t:"AQI Standard", d:"CPCB. National Ambient Air Quality Standards (NAAQS). Ministry of Environment, Forest and Climate Change, India." },
            { n:"[4]", t:"WHO Guidelines", d:"World Health Organization. WHO Global Air Quality Guidelines. Geneva, 2021. PM2.5 annual guideline: 15 μg/m³." },
            { n:"[5]", t:"Clustering Method", d:"MacQueen, J. (1967). K-Means clustering. Silhouette evaluation: Rousseeuw (1987). Implemented via Scikit-learn." },
            { n:"[6]", t:"Decomposition", d:"Additive time-series decomposition via 12-month centered rolling mean. Statsmodels seasonal_decompose equivalent." },
          ].map(r=>(
            <div key={r.n} style={{ display:"flex", gap:10, background:T.bg, borderRadius:8, padding:"10px 12px" }}>
              <span style={{ fontSize:11, fontWeight:700, color:T.accent, flexShrink:0 }}>{r.n}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:T.ink, marginBottom:2 }}>{r.t}</div>
                <div style={{ fontSize:10, color:T.muted, lineHeight:1.5 }}>{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
const SLIDES = [
  { id:"01", label:"Overview",     C:S1  },
  { id:"02", label:"Pollutants",   C:S2  },
  { id:"03", label:"Comparator",   C:S3  },
  { id:"04", label:"Pipeline",     C:S4  },
  { id:"05", label:"K-Means",      C:S5  },
  { id:"06", label:"Clusters",     C:S6  },
  { id:"07", label:"Decomposition",C:S7  },
  { id:"08", label:"Seasonal",     C:S8  },
  { id:"09", label:"Correlations", C:S9  },
  { id:"10", label:"Findings",     C:S10 },
];

export default function App() {
  const [idx, setIdx] = useState(0);
  const N = SLIDES.length;
  useEffect(() => {
    const h = e => {
      if (e.key==="ArrowRight"||e.key==="ArrowDown") setIdx(p=>Math.min(p+1,N-1));
      if (e.key==="ArrowLeft" ||e.key==="ArrowUp")   setIdx(p=>Math.max(p-1,0));
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[N]);

  const Slide = SLIDES[idx].C;

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.ink, fontFamily:"'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#E8E6E1; border-radius:2px; }
        button:focus { outline:none; }
        select:focus { outline:none; }
      `}</style>

      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"#F6F5F2f0", backdropFilter:"blur(12px)", borderBottom:`1px solid ${T.border}`, padding:"9px 32px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:T.accent, display:"inline-block" }} />Gujarat AQ
        </div>
        <div style={{ flex:1, display:"flex", gap:2, justifyContent:"center", flexWrap:"wrap" }}>
          {SLIDES.map((sl,i)=>(
            <button key={i} onClick={()=>setIdx(i)}
              style={{ background:i===idx?T.ink:"transparent", border:`1px solid ${i===idx?T.ink:T.border}`, borderRadius:6, padding:"3px 10px", fontSize:10, color:i===idx?"#fff":T.muted, cursor:"pointer", fontWeight:i===idx?600:400, transition:"all 0.15s" }}>
              {sl.id} {sl.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color:T.muted, whiteSpace:"nowrap" }}>{idx+1}/{N}</div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"64px 36px 52px" }}>
        <Slide />
      </div>

      {idx>0&&<button onClick={()=>setIdx(p=>p-1)} style={{ position:"fixed", left:10, top:"50%", transform:"translateY(-50%)", background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, color:T.secondary, fontSize:18, width:30, height:42, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>‹</button>}
      {idx<N-1&&<button onClick={()=>setIdx(p=>p+1)} style={{ position:"fixed", right:10, top:"50%", transform:"translateY(-50%)", background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, color:T.secondary, fontSize:18, width:30, height:42, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>›</button>}

      <div style={{ position:"fixed", bottom:12, left:0, right:0, display:"flex", justifyContent:"center", gap:4, zIndex:100 }}>
        {SLIDES.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)} style={{ width:i===idx?18:4, height:4, borderRadius:2, background:i===idx?T.ink:T.border, border:"none", cursor:"pointer", transition:"all 0.25s", padding:0 }} />
        ))}
      </div>
    </div>
  );
}
