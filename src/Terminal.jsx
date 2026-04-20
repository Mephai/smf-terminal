import React, { useState, useEffect, useMemo } from 'react';

// ============================================================
// SMF TERMINAL — Smart Money Flow Intelligence
// Mobile-first financial terminal. FRED via proxy, mock fallback.
// ============================================================

// ---- Live data config --------------------------------------
// Set to your deployed proxy URL. Leave empty to force mock mode.
// Example: 'https://smf-proxy.vercel.app/api/fred'
const FRED_PROXY = 'https://financial-proxy-mu.vercel.app/api/fred';

// FRED series to fetch. Order must match STRESS.components below.
// VIX and MOVE are not on FRED; keep them mock or wire to other feeds.
const FRED_SERIES = [
  null,                // VIX      → CBOE (mock for now)
  null,                // MOVE     → ICE (mock for now)
  'BAMLH0A0HYM2',      // HY OAS
  'T10Y2Y',            // 10Y-2Y curve
  'DTWEXBGS',          // Broad dollar index
  'NFCI',              // Chicago Fed NFCI
];

// Hook: fetch latest + prior observation per series, compute delta.
// Returns { components, status } where status is 'live'|'mock'|'partial'|'loading'.
const useLiveStress = () => {
  const [live, setLive] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!FRED_PROXY) { setStatus('mock'); return; }
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          FRED_SERIES.map(async (id) => {
            if (!id) return null;
            const r = await fetch(`${FRED_PROXY}?series=${id}`);
            if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
            return await r.json();
          })
        );
        if (cancelled) return;
        const hits = results.filter(Boolean).length;
        setLive(results);
        setStatus(hits === FRED_SERIES.filter(Boolean).length ? 'live' : 'partial');
      } catch (e) {
        if (!cancelled) { setError(e.message); setStatus('mock'); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { live, status, error };
};

// Merge live FRED observations into the static STRESS template.
// Expected proxy response: { value: number, prev: number, date: 'YYYY-MM-DD' }
const mergeLive = (components, live) => {
  if (!live) return components;
  return components.map((c, i) => {
    const obs = live[i];
    if (!obs || obs.value == null) return c;
    return {
      ...c,
      v: obs.value,
      d: obs.value - (obs.prev ?? obs.value),
      asOf: obs.date,
    };
  });
};

// ---- Design tokens (strict, functional) --------------------
const C = {
  bg:       '#0a0c0f',   // deep charcoal
  bg1:      '#12151a',   // panel
  bg2:      '#191d24',   // elevated row
  line:     '#242932',   // 1px borders
  line2:    '#2f3540',   // hover / focus
  text:     '#d8dde4',   // primary
  dim:      '#7a8390',   // secondary
  dim2:     '#4a5260',   // tertiary / gridlines
  green:    '#4ade80',   // positive / risk-on
  amber:    '#fbbf24',   // caution
  red:      '#f87171',   // risk / stress
  cyan:     '#67e8f9',   // metadata / links
  magenta:  '#e879a6',   // smart money / institutional
};

const mono = "'IBM Plex Mono', 'JetBrains Mono', 'SF Mono', Menlo, monospace";
const sans = "'Inter Tight', 'Inter', system-ui, sans-serif";

// ---- Mock data (shaped like real API responses) ------------
const STRESS = {
  level: 42,            // 0-100 composite
  delta: +6,            // vs yesterday
  regime: 'ELEVATED',   // CALM / NORMAL / ELEVATED / STRESS / CRISIS
  components: [
    { k: 'VIX',        v: 18.4,  d: +1.2, w: 0.20, src: 'CBOE' },
    { k: 'MOVE',       v: 118.7, d: +4.1, w: 0.15, src: 'ICE' },
    { k: 'HY OAS',     v: 3.42,  d: +0.08, w: 0.20, src: 'FRED:BAMLH0A0HYM2' },
    { k: 'T10Y2Y',     v: -0.34, d: -0.05, w: 0.20, src: 'FRED:T10Y2Y' },
    { k: 'DXY',        v: 104.2, d: +0.3, w: 0.10, src: 'FRED:DTWEXBGS' },
    { k: 'FCI',        v: 99.1,  d: -0.2, w: 0.15, src: 'FRED:NFCI' },
  ],
};

const SECTORS = [
  { s: 'Tech',        chg: +0.82, flow: +1420, crowd: 78, risk: 'amber' },
  { s: 'Financials',  chg: -1.14, flow: -890,  crowd: 42, risk: 'red'   },
  { s: 'Energy',      chg: +2.31, flow: +620,  crowd: 55, risk: 'green' },
  { s: 'Health',      chg: -0.22, flow: -120,  crowd: 38, risk: 'green' },
  { s: 'Cons Disc',   chg: -0.67, flow: -410,  crowd: 61, risk: 'amber' },
  { s: 'Cons Stap',   chg: +0.14, flow: +80,   crowd: 22, risk: 'green' },
  { s: 'Industrials', chg: +0.41, flow: +210,  crowd: 47, risk: 'green' },
  { s: 'Utilities',   chg: +0.93, flow: +330,  crowd: 34, risk: 'green' },
  { s: 'Materials',   chg: -0.88, flow: -180,  crowd: 51, risk: 'amber' },
  { s: 'Real Estate', chg: -1.42, flow: -520,  crowd: 66, risk: 'red'   },
  { s: 'Comm Svcs',   chg: +0.08, flow: +40,   crowd: 44, risk: 'green' },
];

const SIGNALS = [
  { id:'SIG-0421', sym:'XLF',  name:'Financials ETF', type:'CREDIT_STRESS',
    score:87, dir:'short', conf:'HIGH', age:'14m',
    why:'HY OAS +8bps w/w, regional bank put/call 2.4x 30d avg, XLF -1.1% on +42% volume',
    drivers:['HY OAS breakout','Regional put skew','Volume surge'] },
  { id:'SIG-0420', sym:'NVDA', name:'NVIDIA',          type:'CROWDING',
    score:82, dir:'caution', conf:'HIGH', age:'1h',
    why:'Hedge fund ownership at 98th %ile, call OI concentration 7 strikes, RSI 78',
    drivers:['HF ownership peak','Options concentration','Momentum exhaustion'] },
  { id:'SIG-0419', sym:'T10Y2Y', name:'2s10s Curve',   type:'MACRO',
    score:74, dir:'risk', conf:'MED', age:'3h',
    why:'Curve un-inverting from -58bps to -34bps, historically precedes recession 6-18m',
    drivers:['Curve steepening','Bear flattener reversal'] },
  { id:'SIG-0418', sym:'XLE',  name:'Energy ETF',      type:'INSTITUTIONAL',
    score:68, dir:'long', conf:'MED', age:'5h',
    why:'13F filings show +$2.1B net buying from top 20 HFs last quarter, crude +4% w/w',
    drivers:['13F accumulation','Commodity tailwind'] },
  { id:'SIG-0417', sym:'KRE',  name:'Regional Banks',  type:'OPTIONS_FLOW',
    score:79, dir:'short', conf:'HIGH', age:'6h',
    why:'Unusual put volume 3.8x avg, deep OTM March puts, CDS +12bps',
    drivers:['Put volume spike','CDS widening','Skew extreme'] },
  { id:'SIG-0416', sym:'GLD',  name:'Gold',            type:'FLIGHT_QUALITY',
    score:61, dir:'long', conf:'MED', age:'9h',
    why:'Central bank buying +28% YoY, real yields rolling over, DXY topping',
    drivers:['CB accumulation','Real yield peak'] },
];

const BIG_PLAYERS = [
  { fund:'Bridgewater',    aum:'150B', move:'+TLT +1.2B',  dir:'long',  sector:'Rates' },
  { fund:'Citadel',        aum:'63B',  move:'-XLF -840M',  dir:'short', sector:'Financials' },
  { fund:'Renaissance',    aum:'130B', move:'+XLE +620M',  dir:'long',  sector:'Energy' },
  { fund:'Millennium',     aum:'69B',  move:'-NVDA -410M', dir:'short', sector:'Tech' },
  { fund:'Two Sigma',      aum:'60B',  move:'+GLD +290M',  dir:'long',  sector:'Commodities' },
  { fund:'Point72',        aum:'35B',  move:'-KRE -180M',  dir:'short', sector:'Financials' },
];

// ---- Valuation gauges (philosophy-agnostic market thermometers) ---
// Values as of April 2026, roughly calibrated against public sources.
// Wire to real feeds later: Buffett = Wilshire5000 / FRED GDP,
// Shiller P/E = multpl.com, S&P P/S = bloomberg/stockanalysis scrape.
const GAUGES = [
  {
    k: 'BUFFETT', n: 'Buffett Indicator',
    formula: 'Total Market Cap / GDP',
    unit: '%', v: 230, median: 85, stdev: 35,
    // Zones: [threshold, label, color]
    zones: [
      { max: 85,  label: 'UNDERVALUED',      color: '#4ade80' },
      { max: 115, label: 'FAIR',             color: '#a3e635' },
      { max: 140, label: 'ELEVATED',         color: '#fbbf24' },
      { max: 165, label: 'OVERVALUED',       color: '#fb923c' },
      { max: 300, label: 'STRONGLY OVERVAL', color: '#f87171' },
    ],
    history: [ // ~1995-present annotated peaks/troughs
      { y: 1995, v: 75 },  { y: 2000, v: 190 }, { y: 2002, v: 85 },
      { y: 2007, v: 130 }, { y: 2009, v: 65 },  { y: 2015, v: 135 },
      { y: 2021, v: 215 }, { y: 2022, v: 155 }, { y: 2024, v: 205 },
      { y: 2026, v: 230 },
    ],
    peaks: [
      { label: 'Dot-com', y: 2000, v: 190 },
      { label: '2021',    y: 2021, v: 215 },
      { label: 'Now',     y: 2026, v: 230 },
    ],
    caveats: [
      'Global revenue of US-listed firms ignored in denominator',
      'Intangible asset-heavy economy distorts ratio vs 1970s',
      'Less useful as short-term timing signal',
    ],
  },
  {
    k: 'SHILLER', n: 'Shiller P/E (CAPE)',
    formula: 'Price / 10y avg real earnings',
    unit: 'x', v: 37, median: 17, stdev: 7,
    zones: [
      { max: 10, label: 'UNDERVALUED', color: '#4ade80' },
      { max: 17, label: 'FAIR',        color: '#a3e635' },
      { max: 24, label: 'ELEVATED',    color: '#fbbf24' },
      { max: 32, label: 'OVERVALUED',  color: '#fb923c' },
      { max: 60, label: 'BUBBLE ZONE', color: '#f87171' },
    ],
    history: [
      { y: 1995, v: 22 }, { y: 2000, v: 44 }, { y: 2002, v: 23 },
      { y: 2007, v: 27 }, { y: 2009, v: 15 }, { y: 2015, v: 26 },
      { y: 2021, v: 38 }, { y: 2022, v: 28 }, { y: 2024, v: 34 },
      { y: 2026, v: 37 },
    ],
    peaks: [
      { label: '1929',    y: 1929, v: 32 },
      { label: 'Dot-com', y: 2000, v: 44 },
      { label: 'Now',     y: 2026, v: 37 },
    ],
    caveats: [
      'Accounting rules have changed (FAS 142, intangibles)',
      'May over-penalize tech-heavy cycles',
      'Slow to reflect regime shifts',
    ],
  },
  {
    k: 'PS', n: 'S&P 500 P/S',
    formula: 'Market cap / trailing sales',
    unit: 'x', v: 2.9, median: 1.5, stdev: 0.5,
    zones: [
      { max: 1.2, label: 'UNDERVALUED', color: '#4ade80' },
      { max: 1.6, label: 'FAIR',        color: '#a3e635' },
      { max: 2.1, label: 'ELEVATED',    color: '#fbbf24' },
      { max: 2.6, label: 'OVERVALUED',  color: '#fb923c' },
      { max: 5.0, label: 'EXTREME',     color: '#f87171' },
    ],
    history: [
      { y: 2000, v: 2.2 }, { y: 2002, v: 1.0 }, { y: 2009, v: 0.85 },
      { y: 2015, v: 1.7 }, { y: 2021, v: 3.1 }, { y: 2024, v: 2.7 },
      { y: 2026, v: 2.9 },
    ],
    peaks: [
      { label: 'Dot-com', y: 2000, v: 2.2 },
      { label: '2021',    y: 2021, v: 3.1 },
      { label: 'Now',     y: 2026, v: 2.9 },
    ],
    caveats: [
      'Margin expansion justifies some multiple increase',
      'Revenue quality varies (software vs commodity)',
    ],
  },
  {
    k: 'INNOV', n: 'Innovation Score',
    formula: 'ARKK concentration + Wright-law proxies + rate duration',
    unit: '/100', v: 72, median: 50, stdev: 15,
    zones: [
      { max: 30,  label: 'EXHAUSTED', color: '#f87171' },
      { max: 50,  label: 'NEUTRAL',   color: '#a3a3a3' },
      { max: 70,  label: 'HEATING',   color: '#a3e635' },
      { max: 85,  label: 'EUPHORIC',  color: '#fbbf24' },
      { max: 100, label: 'MANIA',     color: '#f87171' },
    ],
    history: [
      { y: 2018, v: 45 }, { y: 2020, v: 78 }, { y: 2021, v: 92 },
      { y: 2022, v: 35 }, { y: 2023, v: 55 }, { y: 2024, v: 64 },
      { y: 2026, v: 72 },
    ],
    peaks: [
      { label: 'ARKK peak', y: 2021, v: 92 },
      { label: 'Now',       y: 2026, v: 72 },
    ],
    caveats: [
      'Forward-looking; depends on disruption timeline assumptions',
      'Does not predict timing, only thematic temperature',
    ],
  },
];

// ---- Philosophy lenses ----------------------------------------
// Each lens re-scores the same market through a different worldview.
// Produces a 0-100 'agreement' score: "would this investor buy now?"
const LENSES = [
  {
    id: 'BUFFETT', n: 'Buffett', icon: 'WB',
    tagline: 'Fear greed. Buy quality at fair prices.',
    weight: { BUFFETT: 0.5, SHILLER: 0.3, PS: 0.2, INNOV: 0 },
    // How each gauge contributes to "would buy" (higher gauge = lower score)
    direction: { BUFFETT: -1, SHILLER: -1, PS: -1, INNOV: 0 },
    verdict: (s) => s < 25 ? 'Playing with fire' : s < 50 ? 'Hold cash' : s < 75 ? 'Selectively buy' : 'Back up the truck',
  },
  {
    id: 'WOOD', n: 'Wood', icon: 'CW',
    tagline: 'Disruption compounds. Price volatility ≠ risk.',
    weight: { BUFFETT: 0, SHILLER: 0, PS: 0.1, INNOV: 0.9 },
    direction: { BUFFETT: 0, SHILLER: 0, PS: 0, INNOV: +1 },
    verdict: (s) => s < 25 ? 'Innovation dormant' : s < 50 ? 'Accumulate' : s < 75 ? 'Conviction zone' : 'Deep value despite prices',
  },
  {
    id: 'BURRY', n: 'Burry', icon: 'MB',
    tagline: 'Hunt mispricing. Short the euphoria.',
    weight: { BUFFETT: 0.35, SHILLER: 0.25, PS: 0.25, INNOV: 0.15 },
    // Burry wants EVERYTHING overvalued to short → higher gauge = higher "opportunity"
    direction: { BUFFETT: +1, SHILLER: +1, PS: +1, INNOV: +1 },
    verdict: (s) => s < 25 ? 'Nothing to short' : s < 50 ? 'Watching' : s < 75 ? 'Building shorts' : 'Asymmetric setup',
  },
  {
    id: 'SON', n: 'Son', icon: 'MS',
    tagline: 'Big bets on platform winners. 300-year vision.',
    weight: { BUFFETT: 0.1, SHILLER: 0.1, PS: 0.2, INNOV: 0.6 },
    direction: { BUFFETT: 0, SHILLER: 0, PS: 0, INNOV: +1 },
    verdict: (s) => s < 25 ? 'Winter' : s < 50 ? 'Position carefully' : s < 75 ? 'Deploy capital' : 'Era-defining moment',
  },
];

const zScoreForGauge = (g) => (g.v - g.median) / g.stdev;
const percentileForGauge = (g) => {
  // crude: clamp z to ±3, map to 0-100
  const z = Math.max(-3, Math.min(3, zScoreForGauge(g)));
  return Math.round(((z + 3) / 6) * 100);
};

const zoneFor = (g) => {
  for (const z of g.zones) if (g.v <= z.max) return z;
  return g.zones[g.zones.length - 1];
};

// Normalize a gauge value to 0-100 scale (where 100 = expensive)
const normalizeGauge = (g) => {
  const max = g.zones[g.zones.length - 1].max;
  const min = 0;
  return Math.max(0, Math.min(100, ((g.v - min) / (max - min)) * 100));
};

// Score a lens against current gauges: 0 = sell/short signal, 100 = strong buy
const scoreLens = (lens, gauges) => {
  let score = 50; // neutral
  gauges.forEach(g => {
    const w = lens.weight[g.k] || 0;
    const d = lens.direction[g.k] || 0;
    if (w === 0 || d === 0) return;
    const norm = normalizeGauge(g); // 0-100, higher = more expensive
    // If direction is -1, high gauge → low score (avoid). If +1, high gauge → high score (opportunity).
    const contribution = d > 0 ? norm : (100 - norm);
    score = score + (contribution - 50) * w;
  });
  return Math.max(0, Math.min(100, Math.round(score)));
};

// ---- What-If engine ----------------------------------------
// Sensitivities: how much each symbol moves (%) per 1 std-dev shock
// in each stress component. Hand-calibrated, replace with rolling
// regression vs FRED/AV history later.
const SENSITIVITY = {
  //          VIX    MOVE   HYOAS  T10Y2Y  DXY    NFCI
  XLF:      [-0.45, -0.30, -1.20, -0.40, -0.15, -0.80],
  NVDA:     [-0.85, -0.25, -0.60, -0.20, -0.35, -0.70],
  T10Y2Y:   [ 0.10,  0.20,  0.15,  1.00, -0.05,  0.25],
  XLE:      [-0.20, -0.10, -0.40, -0.05,  0.30, -0.30],
  KRE:      [-0.60, -0.40, -1.60, -0.50, -0.10, -1.10],
  GLD:      [ 0.40,  0.25,  0.30, -0.10, -0.70,  0.45],
  _default: [-0.40, -0.20, -0.50, -0.25, -0.10, -0.45],
};

// Scale factors (std dev of each component, roughly) so slider values
// in the component's natural unit map to Z-scores.
const STDDEV = [6.0, 20.0, 0.80, 0.35, 3.0, 0.50]; // VIX, MOVE, HYOAS, T10Y2Y, DXY, NFCI

// Preset crisis scenarios — deltas from current values
const SCENARIOS = [
  { id: 'BASE',    n: 'Current',       d: [ 0.0,   0.0,   0.00,  0.00,  0.0,  0.00 ] },
  { id: 'LEHMAN',  n: '2008 / Lehman', d: [+62.0, +180.0, +16.0, -0.20, +8.0, +4.50] },
  { id: 'COVID',   n: 'Mar 2020',      d: [+64.0, +120.0, +7.0,  -0.80, +2.0, +3.80] },
  { id: 'RATES22', n: '2022 Hikes',    d: [+14.0, +60.0,  +2.5,  -1.20, +12.0,+1.20] },
  { id: 'SOFT',    n: 'Soft landing',  d: [ -4.0,  -20.0, -0.80, +0.40, -3.0, -0.50] },
];

const stressScore = (values) => {
  // Z-score per component, clipped to [-3, +3], mapped to 0-100
  const baseline = STRESS.components.map(c => c.v);
  const weights = STRESS.components.map(c => c.w);
  let composite = 0;
  values.forEach((v, i) => {
    const z = Math.max(-3, Math.min(3, (v - baseline[i]) / STDDEV[i]));
    composite += z * weights[i];
  });
  // Current stress (42) corresponds to z≈0; scale z-delta by 15 per stddev
  return Math.max(0, Math.min(100, STRESS.level + composite * 18));
};

const regimeFor = (s) =>
  s < 25 ? 'CALM' : s < 45 ? 'NORMAL' : s < 65 ? 'ELEVATED' : s < 85 ? 'STRESS' : 'CRISIS';

const symbolMove = (sym, deltas) => {
  // Expected % move = sum(sensitivity_i * z_i)
  const sens = SENSITIVITY[sym] || SENSITIVITY._default;
  let move = 0;
  deltas.forEach((d, i) => {
    const z = d / STDDEV[i];
    move += sens[i] * z;
  });
  return move;
};

const scoreShift = (sym, deltas, baseScore, dir) => {
  // If bearish signal, stress-up raises score; if bullish, lowers it
  const move = symbolMove(sym, deltas);
  const bearish = dir === 'short' || dir === 'risk';
  const delta = bearish ? -move * 2.5 : move * 2.5;
  return Math.max(0, Math.min(100, baseScore + delta));
};

// Synthetic intraday series for detail view (mimics AV TIME_SERIES_INTRADAY)
const makeSeries = (seed = 1, n = 78, base = 100, vol = 0.012) => {
  const pts = []; let v = base; let rng = seed;
  for (let i = 0; i < n; i++) {
    rng = (rng * 9301 + 49297) % 233280;
    const r = (rng / 233280 - 0.5) * 2;
    v = v * (1 + r * vol);
    pts.push(v);
  }
  return pts;
};

// ---- Primitives --------------------------------------------
const Mono = ({ children, style, ...p }) => (
  <span style={{ fontFamily: mono, letterSpacing: '-0.01em', ...style }} {...p}>{children}</span>
);

const Label = ({ children, style }) => (
  <span style={{
    fontFamily: mono, fontSize: 10, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: C.dim, ...style
  }}>{children}</span>
);

const Dot = ({ color, size = 6 }) => (
  <span style={{
    display: 'inline-block', width: size, height: size, borderRadius: 1,
    background: color, marginRight: 6, verticalAlign: 'middle'
  }} />
);

const Delta = ({ v, unit = '%', digits = 2 }) => {
  const pos = v >= 0;
  return (
    <Mono style={{ color: pos ? C.green : C.red, fontSize: 12 }}>
      {pos ? '▲' : '▼'} {Math.abs(v).toFixed(digits)}{unit}
    </Mono>
  );
};

const Panel = ({ title, meta, children, style }) => (
  <div style={{
    background: C.bg1, border: `1px solid ${C.line}`,
    marginBottom: 10, ...style
  }}>
    {title && (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', borderBottom: `1px solid ${C.line}`,
      }}>
        <Label style={{ color: C.text }}>{title}</Label>
        {meta && <Label>{meta}</Label>}
      </div>
    )}
    {children}
  </div>
);

// Tiny sparkline (pure SVG, no deps)
const Spark = ({ data, color = C.cyan, w = 72, h = 22, fill = true }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity="0.08" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1" />
    </svg>
  );
};

// ---- Global header -----------------------------------------
const Header = ({ clock }) => (
  <div style={{
    position: 'sticky', top: 0, zIndex: 10, background: C.bg,
    borderBottom: `1px solid ${C.line}`,
  }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, background: C.green,
          boxShadow: `0 0 0 2px ${C.bg}, 0 0 0 3px ${C.green}33`,
        }} />
        <Mono style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          SMF<span style={{ color: C.dim }}>·</span>TERMINAL
        </Mono>
        <Label style={{ fontSize: 9 }}>v0.1</Label>
      </div>
      <Mono style={{ fontSize: 11, color: C.dim }}>{clock}</Mono>
    </div>
    <div style={{
      display: 'flex', gap: 16, padding: '0 14px 6px', fontSize: 10,
      fontFamily: mono, color: C.dim, overflowX: 'auto', whiteSpace: 'nowrap',
    }}>
      <span>SPX <Mono style={{ color: C.red }}>5,284.7 -0.42%</Mono></span>
      <span>NDX <Mono style={{ color: C.red }}>18,342 -0.61%</Mono></span>
      <span>VIX <Mono style={{ color: C.amber }}>18.4 +7.0%</Mono></span>
      <span>US10Y <Mono style={{ color: C.green }}>4.31 +3bp</Mono></span>
      <span>DXY <Mono style={{ color: C.green }}>104.2 +0.28%</Mono></span>
      <span>HY OAS <Mono style={{ color: C.amber }}>3.42 +8bp</Mono></span>
    </div>
  </div>
);

// ---- Tab bar (bottom, thumb-friendly) ----------------------
const TabBar = ({ tab, setTab }) => {
  const tabs = [
    { k: 'overview', n: 'HOME',    code: '01' },
    { k: 'gauges',   n: 'GAUGES',  code: '02' },
    { k: 'signals',  n: 'SIGNALS', code: '03' },
    { k: 'players',  n: 'PLAYERS', code: '04' },
    { k: 'detail',   n: 'DETAIL',  code: '05' },
  ];
  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 10, background: C.bg,
      borderTop: `1px solid ${C.line}`, display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
    }}>
      {tabs.map(t => {
        const active = tab === t.k;
        return (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            background: 'transparent', border: 'none',
            borderTop: active ? `2px solid ${C.green}` : '2px solid transparent',
            padding: '10px 2px 12px', cursor: 'pointer',
            color: active ? C.text : C.dim, fontFamily: mono,
          }}>
            <div style={{ fontSize: 9, color: C.dim2, letterSpacing: '0.1em' }}>{t.code}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', marginTop: 2 }}>{t.n}</div>
          </button>
        );
      })}
    </div>
  );
};

// ============================================================
// VIEW 1 — OVERVIEW (system health + market stress)
// ============================================================
const StressGauge = ({ level, regime, delta }) => {
  const color = level < 25 ? C.green : level < 50 ? C.amber : level < 75 ? '#fb923c' : C.red;
  const segments = 40;
  const filled = Math.round((level / 100) * segments);
  return (
    <div style={{ padding: '14px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <Label>Composite Stress Index</Label>
        <Mono style={{ fontSize: 10, color: C.dim }}>6 components · Z-score weighted</Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <Mono style={{ fontSize: 38, color, fontWeight: 500, letterSpacing: '-0.04em' }}>
          {level.toString().padStart(2, '0')}
        </Mono>
        <Mono style={{ fontSize: 11, color: C.dim }}>/100</Mono>
        <div style={{ flex: 1 }} />
        <Delta v={delta} unit="" digits={0} />
      </div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 14,
            background: i < filled ? color : C.line,
            opacity: i < filled ? (0.4 + (i / segments) * 0.6) : 1,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Mono style={{ fontSize: 10, color: C.dim2 }}>CALM</Mono>
        <Mono style={{ fontSize: 10, color: C.dim2 }}>NORMAL</Mono>
        <Mono style={{ fontSize: 10, color }}>{regime}</Mono>
        <Mono style={{ fontSize: 10, color: C.dim2 }}>CRISIS</Mono>
      </div>
    </div>
  );
};

const ComponentList = ({ components }) => (
  <div>
    {components.map((c, i) => {
      const z = c.d / Math.abs(c.v + 0.001); // cheap normalization for visual
      const barW = Math.min(Math.abs(z) * 200, 100);
      const col = c.d > 0.02 ? C.red : c.d < -0.02 ? C.green : C.amber;
      return (
        <div key={c.k} style={{
          display: 'grid', gridTemplateColumns: '62px 1fr 52px 48px',
          alignItems: 'center', padding: '9px 12px',
          borderTop: i ? `1px solid ${C.line}` : 'none', gap: 8,
        }}>
          <Mono style={{ fontSize: 12, color: C.text }}>{c.k}</Mono>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 3, background: C.line, position: 'relative' }}>
              <div style={{
                position: 'absolute', left: c.d >= 0 ? '50%' : `${50 - barW/2}%`,
                width: `${barW/2}%`, height: '100%', background: col,
              }} />
              <div style={{
                position: 'absolute', left: '50%', top: -2, bottom: -2,
                width: 1, background: C.dim2,
              }} />
            </div>
          </div>
          <Mono style={{ fontSize: 11, color: C.dim, textAlign: 'right' }}>{c.v.toFixed(2)}</Mono>
          <Mono style={{ fontSize: 11, color: col, textAlign: 'right' }}>
            {c.d >= 0 ? '+' : ''}{c.d.toFixed(2)}
          </Mono>
        </div>
      );
    })}
  </div>
);

const SectorHeatmap = () => {
  const max = Math.max(...SECTORS.map(s => Math.abs(s.chg)));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.line }}>
      {SECTORS.map(s => {
        const intensity = Math.abs(s.chg) / max;
        const col = s.chg >= 0 ? C.green : C.red;
        return (
          <div key={s.s} style={{
            background: C.bg1, padding: '10px 8px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0, background: col, opacity: intensity * 0.15,
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: sans, marginBottom: 2 }}>
                {s.s}
              </div>
              <Mono style={{ fontSize: 13, color: col, fontWeight: 500 }}>
                {s.chg >= 0 ? '+' : ''}{s.chg.toFixed(2)}%
              </Mono>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <div style={{ flex: 1, height: 2, background: C.line }}>
                  <div style={{
                    width: `${s.crowd}%`, height: '100%',
                    background: s.crowd > 70 ? C.red : s.crowd > 50 ? C.amber : C.dim,
                  }} />
                </div>
                <Mono style={{ fontSize: 9, color: C.dim2 }}>{s.crowd}</Mono>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AlertStream = () => {
  const alerts = SIGNALS.slice(0, 4);
  return (
    <div>
      {alerts.map((a, i) => {
        const col = a.dir === 'short' || a.dir === 'risk' ? C.red
                  : a.dir === 'long' ? C.green : C.amber;
        return (
          <div key={a.id} style={{
            padding: '10px 12px',
            borderTop: i ? `1px solid ${C.line}` : 'none',
            display: 'grid', gridTemplateColumns: '4px 1fr auto', gap: 10,
          }}>
            <div style={{ background: col, alignSelf: 'stretch' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <Mono style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{a.sym}</Mono>
                <Label style={{ fontSize: 9, color: col }}>{a.type.replace('_', ' ')}</Label>
                <Mono style={{ fontSize: 10, color: C.dim2, marginLeft: 'auto' }}>{a.age}</Mono>
              </div>
              <div style={{
                fontSize: 11, color: C.dim, lineHeight: 1.4, fontFamily: sans,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {a.why}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Mono style={{ fontSize: 16, color: col, fontWeight: 600 }}>{a.score}</Mono>
              <Label style={{ fontSize: 8, display: 'block' }}>SCORE</Label>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// VIEW 5 — GAUGES (valuation indicators + philosophy lenses)
// ============================================================
const GaugeBar = ({ gauge, onTap }) => {
  const zone = zoneFor(gauge);
  const norm = normalizeGauge(gauge);
  const pctile = percentileForGauge(gauge);
  return (
    <button onClick={onTap} style={{
      width: '100%', background: 'transparent', border: 'none',
      borderBottom: `1px solid ${C.line}`, padding: '12px',
      textAlign: 'left', cursor: 'pointer', display: 'block',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <Mono style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{gauge.n}</Mono>
        <div style={{ flex: 1 }} />
        <Mono style={{ fontSize: 18, color: zone.color, fontWeight: 500, letterSpacing: '-0.02em' }}>
          {gauge.v}{gauge.unit}
        </Mono>
      </div>
      <div style={{
        fontFamily: sans, fontSize: 10, color: C.dim, marginBottom: 8,
      }}>
        {gauge.formula}
      </div>
      {/* Zone bar */}
      <div style={{ position: 'relative', height: 8, display: 'flex', gap: 1, marginBottom: 4 }}>
        {gauge.zones.map((z, i) => {
          const prev = i === 0 ? 0 : gauge.zones[i - 1].max;
          const width = (z.max - prev) / gauge.zones[gauge.zones.length - 1].max * 100;
          return (
            <div key={i} style={{
              width: `${width}%`, background: z.color, opacity: 0.35,
            }} />
          );
        })}
        {/* Current marker */}
        <div style={{
          position: 'absolute', left: `${norm}%`, top: -3, bottom: -3,
          width: 2, background: C.text,
        }} />
        {/* Median marker */}
        <div style={{
          position: 'absolute',
          left: `${(gauge.median / gauge.zones[gauge.zones.length - 1].max) * 100}%`,
          top: 0, bottom: 0, width: 1, background: C.dim2, opacity: 0.7,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono style={{ fontSize: 9, color: zone.color, letterSpacing: '0.1em' }}>
          ● {zone.label}
        </Mono>
        <Mono style={{ fontSize: 9, color: C.dim }}>
          {pctile}TH PERCENTILE · MED {gauge.median}{gauge.unit}
        </Mono>
      </div>
    </button>
  );
};

const LensCard = ({ lens, gauges, active, onTap }) => {
  const score = scoreLens(lens, gauges);
  const col = score < 25 ? C.red : score < 50 ? C.amber : score < 75 ? C.green : C.magenta;
  return (
    <button onClick={onTap} style={{
      background: active ? C.bg2 : C.bg1,
      border: `1px solid ${active ? col : C.line}`,
      padding: '10px', cursor: 'pointer', textAlign: 'left', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 24, height: 24, background: col, color: C.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '-0.02em',
        }}>{lens.icon}</div>
        <Mono style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{lens.n}</Mono>
        <div style={{ flex: 1 }} />
        <Mono style={{ fontSize: 18, color: col, fontWeight: 500 }}>{score}</Mono>
      </div>
      <div style={{
        fontFamily: sans, fontSize: 10, color: C.dim, lineHeight: 1.3,
      }}>
        {lens.tagline}
      </div>
    </button>
  );
};

const GaugeHistoryChart = ({ gauge }) => {
  const w = 100, h = 60;
  const vs = gauge.history.map(p => p.v);
  const years = gauge.history.map(p => p.y);
  const vMin = Math.min(...vs) * 0.9;
  const vMax = Math.max(...vs) * 1.05;
  const yMin = Math.min(...years);
  const yMax = Math.max(...years);
  const x = (y) => ((y - yMin) / (yMax - yMin)) * w;
  const y = (v) => h - ((v - vMin) / (vMax - vMin)) * h;
  const pts = gauge.history.map(p => [x(p.y), y(p.v)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const zone = zoneFor(gauge);
  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={h * 2.2} viewBox={`0 0 ${w} ${h}`}
           preserveAspectRatio="none" style={{ display: 'block' }}>
        <path d={`${d} L${w},${h} L0,${h} Z`} fill={zone.color} opacity="0.08" />
        <path d={d} fill="none" stroke={zone.color} strokeWidth="0.6" />
        {/* Median line */}
        <line x1="0" y1={y(gauge.median)} x2={w} y2={y(gauge.median)}
              stroke={C.dim2} strokeWidth="0.2" strokeDasharray="1 1" />
        {/* Peaks */}
        {gauge.peaks.map(p => (
          <circle key={p.label} cx={x(p.y)} cy={y(p.v)} r="0.8"
                  fill={C.amber} stroke={C.bg} strokeWidth="0.3" />
        ))}
      </svg>
      {/* Peak labels overlay */}
      {gauge.peaks.map(p => (
        <div key={p.label} style={{
          position: 'absolute',
          left: `${x(p.y)}%`, top: `${(y(p.v) / h) * 100 * 2.2 - 15}%`,
          transform: 'translateX(-50%)',
          fontFamily: mono, fontSize: 8, color: C.amber, whiteSpace: 'nowrap',
        }}>
          {p.label}: {p.v}{gauge.unit}
        </div>
      ))}
    </div>
  );
};

const GaugeDetail = ({ gauge, onClose }) => {
  const zone = zoneFor(gauge);
  return (
    <Panel title={gauge.n} meta={
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none', color: C.cyan,
        fontFamily: mono, fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
      }}>✕ CLOSE</button>
    }>
      <div style={{ padding: '14px 12px', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <Mono style={{ fontSize: 34, color: zone.color, fontWeight: 500, letterSpacing: '-0.03em' }}>
            {gauge.v}{gauge.unit}
          </Mono>
          <Mono style={{ fontSize: 10, color: zone.color, letterSpacing: '0.12em' }}>
            ● {zone.label}
          </Mono>
        </div>
        <div style={{ fontFamily: sans, fontSize: 11, color: C.dim }}>
          {gauge.formula}
        </div>
      </div>

      {/* History chart */}
      <div style={{ padding: '12px' }}>
        <Label style={{ display: 'block', marginBottom: 8 }}>Historical Context</Label>
        <GaugeHistoryChart gauge={gauge} />
      </div>

      {/* Zone legend */}
      <div style={{ padding: '0 12px 12px', borderBottom: `1px solid ${C.line}` }}>
        {gauge.zones.map((z, i) => {
          const prev = i === 0 ? 0 : gauge.zones[i - 1].max;
          const active = gauge.v > prev && gauge.v <= z.max;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '8px 80px 1fr auto',
              gap: 10, alignItems: 'center', padding: '4px 0',
              opacity: active ? 1 : 0.45,
            }}>
              <div style={{ width: 8, height: 8, background: z.color }} />
              <Mono style={{ fontSize: 10, color: z.color, letterSpacing: '0.08em' }}>
                {z.label}
              </Mono>
              <Mono style={{ fontSize: 10, color: C.dim }}>
                {prev}–{z.max}{gauge.unit}
              </Mono>
              {active && (
                <Mono style={{ fontSize: 10, color: C.text, letterSpacing: '0.1em' }}>
                  CURRENT
                </Mono>
              )}
            </div>
          );
        })}
      </div>

      {/* Caveats */}
      <div style={{ padding: '12px' }}>
        <Label style={{ display: 'block', marginBottom: 6 }}>Known Limitations</Label>
        {gauge.caveats.map((c, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, padding: '4px 0',
            fontFamily: sans, fontSize: 11, color: C.dim, lineHeight: 1.4,
          }}>
            <Mono style={{ color: C.dim2, fontSize: 10 }}>!</Mono>
            <span>{c}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
};

const LensDetail = ({ lens, gauges, onClose }) => {
  const score = scoreLens(lens, gauges);
  const col = score < 25 ? C.red : score < 50 ? C.amber : score < 75 ? C.green : C.magenta;
  const verdict = lens.verdict(score);
  return (
    <Panel title={`Lens: ${lens.n}`} meta={
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none', color: C.cyan,
        fontFamily: mono, fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
      }}>✕ CLOSE</button>
    }>
      <div style={{ padding: '14px 12px', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <Mono style={{ fontSize: 38, color: col, fontWeight: 500, letterSpacing: '-0.03em' }}>
            {score}
          </Mono>
          <Mono style={{ fontSize: 11, color: C.dim }}>/100</Mono>
          <div style={{ flex: 1 }} />
          <Mono style={{ fontSize: 10, color: col, letterSpacing: '0.1em' }}>
            {verdict.toUpperCase()}
          </Mono>
        </div>
        <div style={{ fontFamily: sans, fontSize: 12, color: C.text, lineHeight: 1.4 }}>
          "{lens.tagline}"
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        <Label style={{ display: 'block', marginBottom: 8 }}>How each gauge contributes</Label>
        {GAUGES.map(g => {
          const w = lens.weight[g.k] || 0;
          const d = lens.direction[g.k] || 0;
          if (w === 0 || d === 0) return (
            <div key={g.k} style={{
              display: 'grid', gridTemplateColumns: '70px 1fr 50px',
              gap: 8, alignItems: 'center', padding: '5px 0', opacity: 0.3,
            }}>
              <Mono style={{ fontSize: 11, color: C.dim }}>{g.k}</Mono>
              <Mono style={{ fontSize: 9, color: C.dim2 }}>ignored</Mono>
              <Mono style={{ fontSize: 10, color: C.dim, textAlign: 'right' }}>—</Mono>
            </div>
          );
          const norm = normalizeGauge(g);
          const barCol = d > 0 ? (norm > 60 ? C.green : C.dim) : (norm > 60 ? C.red : C.dim);
          return (
            <div key={g.k} style={{
              display: 'grid', gridTemplateColumns: '70px 1fr 50px',
              gap: 8, alignItems: 'center', padding: '5px 0',
            }}>
              <Mono style={{ fontSize: 11, color: C.text }}>{g.k}</Mono>
              <div style={{ height: 4, background: C.line, position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0, width: `${norm}%`, background: barCol,
                }} />
              </div>
              <Mono style={{ fontSize: 10, color: C.dim, textAlign: 'right' }}>
                w={w.toFixed(2)} {d > 0 ? '↑' : '↓'}
              </Mono>
            </div>
          );
        })}
        <div style={{
          marginTop: 12, padding: 10, background: C.bg2,
          borderLeft: `2px solid ${col}`, fontFamily: sans,
          fontSize: 11, color: C.dim, lineHeight: 1.5,
        }}>
          <Mono style={{ fontSize: 9, color: col, letterSpacing: '0.12em' }}>
            ARROW LEGEND
          </Mono>
          <div style={{ marginTop: 4 }}>
            ↑ = high reading is <b style={{ color: C.text }}>bullish</b> for this investor ·
            ↓ = high reading is <b style={{ color: C.text }}>bearish</b>
          </div>
        </div>
      </div>
    </Panel>
  );
};

const GaugesView = () => {
  const [selGauge, setSelGauge] = useState(null);
  const [selLens, setSelLens] = useState(null);

  if (selGauge) {
    const g = GAUGES.find(x => x.k === selGauge);
    return <GaugeDetail gauge={g} onClose={() => setSelGauge(null)} />;
  }
  if (selLens) {
    const l = LENSES.find(x => x.id === selLens);
    return <LensDetail lens={l} gauges={GAUGES} onClose={() => setSelLens(null)} />;
  }

  // Aggregate thermometer: average z-scores across all gauges
  const avgZ = GAUGES.reduce((a, g) => a + zScoreForGauge(g), 0) / GAUGES.length;
  const aggCol = avgZ > 1.5 ? C.red : avgZ > 0.5 ? C.amber : avgZ > -0.5 ? C.dim : C.green;
  const aggLabel = avgZ > 2 ? 'EXTREME OVERVALUATION' : avgZ > 1 ? 'OVERVALUED'
                 : avgZ > -1 ? 'NORMAL' : avgZ > -2 ? 'UNDERVALUED' : 'EXTREME UNDERVALUATION';

  return (
    <div>
      <Panel title="Market Thermometer" meta="4 gauges · Z-averaged">
        <div style={{ padding: '14px 12px', textAlign: 'center' }}>
          <Mono style={{
            fontSize: 42, color: aggCol, fontWeight: 500, letterSpacing: '-0.04em',
            display: 'block',
          }}>
            {avgZ >= 0 ? '+' : ''}{avgZ.toFixed(2)}σ
          </Mono>
          <Mono style={{ fontSize: 10, color: aggCol, letterSpacing: '0.15em' }}>
            {aggLabel}
          </Mono>
          <div style={{
            fontFamily: sans, fontSize: 11, color: C.dim, marginTop: 8, lineHeight: 1.5,
          }}>
            Average standard deviation across Buffett, Shiller, P/S, Innovation.
            <br/>
            <Mono style={{ fontSize: 10, color: C.dim2 }}>
              Higher = more expensive · Historical peaks: 2000 (+2.5σ), 2021 (+2.2σ)
            </Mono>
          </div>
        </div>
      </Panel>

      <Panel title="Valuation Gauges" meta="tap to inspect">
        {GAUGES.map(g => (
          <GaugeBar key={g.k} gauge={g} onTap={() => setSelGauge(g.k)} />
        ))}
      </Panel>

      <Panel title="Philosophy Lenses" meta="same data · different eyes">
        <div style={{
          padding: '10px', display: 'grid', gap: 8,
          gridTemplateColumns: 'repeat(2, 1fr)',
        }}>
          {LENSES.map(l => (
            <LensCard key={l.id} lens={l} gauges={GAUGES}
              active={false} onTap={() => setSelLens(l.id)} />
          ))}
        </div>
      </Panel>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const cfg = {
    live:    { c: C.green,  t: '● LIVE' },
    partial: { c: C.amber,  t: '◐ PARTIAL' },
    mock:    { c: C.dim,    t: '○ MOCK' },
    loading: { c: C.cyan,   t: '◌ LOADING' },
  }[status] || { c: C.dim, t: '○ MOCK' };
  return (
    <Mono style={{
      fontSize: 9, color: cfg.c, letterSpacing: '0.12em',
      border: `1px solid ${cfg.c}33`, padding: '1px 5px',
    }}>{cfg.t}</Mono>
  );
};

const OverviewView = ({ setTab, setSel }) => {
  const { live, status } = useLiveStress();
  const components = useMemo(
    () => mergeLive(STRESS.components, live),
    [live]
  );
  // Recompute composite stress from live values when available
  const level = useMemo(() => {
    if (!live) return STRESS.level;
    const values = components.map(c => c.v);
    return Math.round(stressScore(values));
  }, [components, live]);
  const regime = regimeFor(level);
  const delta = level - STRESS.level;
  const asOf = components.find(c => c.asOf)?.asOf;

  return (
    <div>
      <Panel
        title="System Health"
        meta={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {asOf && <Mono style={{ fontSize: 9, color: C.dim2 }}>{asOf}</Mono>}
          <StatusPill status={status} />
        </span>}
      >
        <StressGauge level={level} regime={regime} delta={delta} />
        <div style={{ borderTop: `1px solid ${C.line}` }}>
          <ComponentList components={components} />
        </div>
      </Panel>

      <Panel title="Sector Heatmap" meta="11 GICS · intraday">
        <SectorHeatmap />
        <div style={{
          padding: '8px 12px', borderTop: `1px solid ${C.line}`,
          display: 'flex', gap: 12, fontSize: 10, color: C.dim,
        }}>
          <span><Dot color={C.green}/>Perf</span>
          <span><Dot color={C.amber}/>Crowd &gt;50</span>
          <span><Dot color={C.red}/>Crowd &gt;70</span>
        </div>
      </Panel>

      <Panel title="Active Signals" meta={`${SIGNALS.length} · top 4`}>
        <AlertStream />
        <button onClick={() => setTab('signals')} style={{
          width: '100%', background: 'transparent', border: 'none',
          borderTop: `1px solid ${C.line}`, padding: '10px',
          color: C.cyan, fontFamily: mono, fontSize: 11,
          letterSpacing: '0.1em', cursor: 'pointer',
        }}>
          VIEW ALL SIGNALS →
        </button>
      </Panel>

      {/* Valuation thermometer preview */}
      {(() => {
        const avgZ = GAUGES.reduce((a, g) => a + zScoreForGauge(g), 0) / GAUGES.length;
        const col = avgZ > 1.5 ? C.red : avgZ > 0.5 ? C.amber : avgZ > -0.5 ? C.dim : C.green;
        return (
          <Panel title="Valuation Lens" meta="4 gauges · 4 philosophies">
            <button onClick={() => setTab('gauges')} style={{
              width: '100%', background: 'transparent', border: 'none',
              padding: '12px', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                gap: 12, alignItems: 'center',
              }}>
                <Mono style={{ fontSize: 26, color: col, fontWeight: 500, letterSpacing: '-0.03em' }}>
                  {avgZ >= 0 ? '+' : ''}{avgZ.toFixed(1)}σ
                </Mono>
                <div>
                  <Mono style={{ fontSize: 10, color: col, letterSpacing: '0.1em', display: 'block' }}>
                    {avgZ > 1.5 ? 'OVERVALUED' : avgZ > -0.5 ? 'NORMAL' : 'UNDERVALUED'}
                  </Mono>
                  <div style={{ fontFamily: sans, fontSize: 10, color: C.dim, marginTop: 2 }}>
                    Buffett {GAUGES[0].v}% · Shiller {GAUGES[1].v}x · P/S {GAUGES[2].v}x
                  </div>
                </div>
                <Mono style={{ fontSize: 11, color: C.cyan, letterSpacing: '0.1em' }}>
                  OPEN →
                </Mono>
              </div>
            </button>
          </Panel>
        );
      })()}
    </div>
  );
};

// ============================================================
// VIEW 2 — SIGNALS (filter + stream)
// ============================================================
const SignalsView = ({ setTab, setSel }) => {
  const [filter, setFilter] = useState('ALL');
  const types = ['ALL', 'CREDIT_STRESS', 'CROWDING', 'MACRO', 'INSTITUTIONAL', 'OPTIONS_FLOW', 'FLIGHT_QUALITY'];
  const filtered = filter === 'ALL' ? SIGNALS : SIGNALS.filter(s => s.type === filter);

  return (
    <div>
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        overflowX: 'auto', borderBottom: `1px solid ${C.line}`,
        background: C.bg1,
      }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            background: filter === t ? C.text : 'transparent',
            color: filter === t ? C.bg : C.dim,
            border: `1px solid ${filter === t ? C.text : C.line2}`,
            padding: '4px 10px', fontFamily: mono, fontSize: 10,
            letterSpacing: '0.08em', whiteSpace: 'nowrap', cursor: 'pointer',
          }}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{
        padding: '8px 12px', display: 'grid',
        gridTemplateColumns: '52px 1fr 60px 50px 36px',
        gap: 8, borderBottom: `1px solid ${C.line}`,
      }}>
        <Label style={{ fontSize: 9 }}>ID</Label>
        <Label style={{ fontSize: 9 }}>INSTRUMENT</Label>
        <Label style={{ fontSize: 9, textAlign: 'right' }}>TYPE</Label>
        <Label style={{ fontSize: 9, textAlign: 'right' }}>SCORE</Label>
        <Label style={{ fontSize: 9, textAlign: 'right' }}>AGE</Label>
      </div>

      {filtered.map((s, i) => {
        const col = s.dir === 'short' || s.dir === 'risk' ? C.red
                  : s.dir === 'long' ? C.green : C.amber;
        return (
          <button key={s.id} onClick={() => { setSel(s); setTab('detail'); }}
            style={{
              width: '100%', background: C.bg1, border: 'none',
              borderBottom: `1px solid ${C.line}`, padding: 0,
              textAlign: 'left', cursor: 'pointer',
            }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '52px 1fr 60px 50px 36px',
              gap: 8, padding: '10px 12px', alignItems: 'center',
            }}>
              <Mono style={{ fontSize: 10, color: C.dim2 }}>{s.id.split('-')[1]}</Mono>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <Mono style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{s.sym}</Mono>
                  <Mono style={{ fontSize: 10, color: col }}>▸ {s.dir.toUpperCase()}</Mono>
                </div>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: sans, marginTop: 1 }}>{s.name}</div>
              </div>
              <Mono style={{ fontSize: 9, color: col, textAlign: 'right', letterSpacing: '0.08em' }}>
                {s.type.replace('_', ' ')}
              </Mono>
              <Mono style={{ fontSize: 16, color: col, fontWeight: 600, textAlign: 'right' }}>
                {s.score}
              </Mono>
              <Mono style={{ fontSize: 10, color: C.dim2, textAlign: 'right' }}>{s.age}</Mono>
            </div>
            <div style={{
              padding: '0 12px 10px', fontSize: 11, color: C.dim,
              fontFamily: sans, lineHeight: 1.45,
              borderLeft: `2px solid ${col}`, marginLeft: 0,
            }}>
              {s.why}
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ============================================================
// VIEW 3 — BIG PLAYERS (institutional flows)
// ============================================================
const PlayersView = () => {
  const net = BIG_PLAYERS.reduce((a, p) => a + (p.dir === 'long' ? 1 : -1), 0);
  return (
    <div>
      <Panel title="Institutional Flow Radar" meta="SEC 13F · last 30d">
        <div style={{ padding: '14px 12px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <Label>Net Direction</Label>
              <div style={{
                marginTop: 6, fontFamily: mono, fontSize: 22,
                color: net > 0 ? C.green : C.red,
              }}>
                {net > 0 ? 'NET LONG' : 'NET SHORT'}
              </div>
              <Mono style={{ fontSize: 11, color: C.dim }}>
                {BIG_PLAYERS.filter(p=>p.dir==='long').length}L · {BIG_PLAYERS.filter(p=>p.dir==='short').length}S
              </Mono>
            </div>
            <div style={{ flex: 1, borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>
              <Label>Crowding Score</Label>
              <div style={{ marginTop: 6, fontFamily: mono, fontSize: 22, color: C.magenta }}>
                0.61
              </div>
              <Mono style={{ fontSize: 11, color: C.dim }}>↑ 0.08 w/w</Mono>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Top Fund Movements" meta="AUM-weighted">
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 48px 1fr 68px',
          padding: '8px 12px', gap: 8, borderBottom: `1px solid ${C.line}`,
        }}>
          <Label style={{ fontSize: 9 }}>FUND</Label>
          <Label style={{ fontSize: 9, textAlign: 'right' }}>AUM</Label>
          <Label style={{ fontSize: 9 }}>POSITION</Label>
          <Label style={{ fontSize: 9, textAlign: 'right' }}>SECTOR</Label>
        </div>
        {BIG_PLAYERS.map((p, i) => {
          const col = p.dir === 'long' ? C.green : C.red;
          return (
            <div key={p.fund} style={{
              display: 'grid', gridTemplateColumns: '1fr 48px 1fr 68px',
              padding: '10px 12px', gap: 8, alignItems: 'center',
              borderBottom: i < BIG_PLAYERS.length - 1 ? `1px solid ${C.line}` : 'none',
            }}>
              <Mono style={{ fontSize: 12, color: C.text }}>{p.fund}</Mono>
              <Mono style={{ fontSize: 11, color: C.dim, textAlign: 'right' }}>${p.aum}</Mono>
              <Mono style={{ fontSize: 11, color: col }}>{p.move}</Mono>
              <Mono style={{ fontSize: 10, color: C.cyan, textAlign: 'right' }}>{p.sector}</Mono>
            </div>
          );
        })}
      </Panel>

      <Panel title="Sector Flow Concentration" meta="$ net, last 30d">
        <div style={{ padding: '12px' }}>
          {[
            { s: 'Rates',       v: +1200 },
            { s: 'Energy',      v: +620 },
            { s: 'Commodities', v: +290 },
            { s: 'Tech',        v: -410 },
            { s: 'Financials',  v: -1020 },
          ].map(r => {
            const max = 1200;
            const w = Math.abs(r.v) / max * 100;
            const col = r.v >= 0 ? C.green : C.red;
            return (
              <div key={r.s} style={{
                display: 'grid', gridTemplateColumns: '70px 1fr 60px',
                gap: 8, alignItems: 'center', marginBottom: 6,
              }}>
                <Mono style={{ fontSize: 11, color: C.text }}>{r.s}</Mono>
                <div style={{ position: 'relative', height: 10, background: C.line }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: C.dim2 }} />
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    [r.v >= 0 ? 'left' : 'right']: '50%',
                    width: `${w/2}%`, background: col,
                  }} />
                </div>
                <Mono style={{ fontSize: 11, color: col, textAlign: 'right' }}>
                  {r.v >= 0 ? '+' : ''}{r.v}M
                </Mono>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

// ============================================================
// VIEW 4 — DETAIL (explain signal)
// ============================================================
const DetailView = ({ sel }) => {
  const s = sel || SIGNALS[0];
  const { status: fredStatus } = useLiveStress();
  const series = useMemo(() => makeSeries(s.id.charCodeAt(4) || 1, 78, 100, 0.015), [s.id]);
  const col = s.dir === 'short' || s.dir === 'risk' ? C.red
            : s.dir === 'long' ? C.green : C.amber;
  const last = series[series.length - 1];
  const first = series[0];
  const chg = ((last - first) / first) * 100;

  const priceMin = Math.min(...series), priceMax = Math.max(...series);
  const chartH = 140, chartW = 100;

  return (
    <div>
      <Panel>
        <div style={{ padding: '14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <Mono style={{ fontSize: 22, fontWeight: 600, color: C.text, letterSpacing: '-0.02em' }}>
              {s.sym}
            </Mono>
            <div style={{ fontFamily: sans, fontSize: 12, color: C.dim }}>{s.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Mono style={{ fontSize: 28, color: C.text, fontWeight: 500 }}>
              {last.toFixed(2)}
            </Mono>
            <Delta v={chg} />
            <div style={{ flex: 1 }} />
            <Label style={{ color: col }}>●  {s.dir.toUpperCase()} · {s.conf}</Label>
          </div>
        </div>

        {/* Chart */}
        <div style={{ padding: '0 12px 12px', position: 'relative' }}>
          <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}
               preserveAspectRatio="none" style={{ display: 'block' }}>
            {[0.25, 0.5, 0.75].map(y => (
              <line key={y} x1="0" y1={y * chartH} x2={chartW} y2={y * chartH}
                    stroke={C.line} strokeWidth="0.2" strokeDasharray="0.5 0.5" />
            ))}
            {(() => {
              const step = chartW / (series.length - 1);
              const range = priceMax - priceMin || 1;
              const pts = series.map((v, i) => [i * step, chartH - ((v - priceMin) / range) * chartH]);
              const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
              const area = `${d} L${chartW},${chartH} L0,${chartH} Z`;
              return (
                <>
                  <path d={area} fill={col} opacity="0.1" />
                  <path d={d} fill="none" stroke={col} strokeWidth="0.5" />
                </>
              );
            })()}
          </svg>
          <div style={{
            position: 'absolute', right: 12, top: 0,
            fontFamily: mono, fontSize: 9, color: C.dim2,
          }}>{priceMax.toFixed(2)}</div>
          <div style={{
            position: 'absolute', right: 12, bottom: 12,
            fontFamily: mono, fontSize: 9, color: C.dim2,
          }}>{priceMin.toFixed(2)}</div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: `1px solid ${C.line}`,
        }}>
          {[
            { k: 'SCORE',   v: s.score,         col },
            { k: 'CONF',    v: s.conf,          col: C.text },
            { k: 'AGE',     v: s.age,           col: C.dim },
            { k: 'TYPE',    v: s.type.split('_')[0], col: C.cyan },
          ].map((x, i) => (
            <div key={x.k} style={{
              padding: '10px 8px', textAlign: 'center',
              borderRight: i < 3 ? `1px solid ${C.line}` : 'none',
            }}>
              <Label style={{ fontSize: 9 }}>{x.k}</Label>
              <div style={{
                marginTop: 2, fontFamily: mono, fontSize: 13,
                color: x.col, fontWeight: 500,
              }}>{x.v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Why signal fired */}
      <Panel title="Why This Signal" meta={s.id}>
        <div style={{
          padding: '12px', borderLeft: `2px solid ${col}`,
          fontFamily: sans, fontSize: 13, color: C.text, lineHeight: 1.5,
        }}>
          {s.why}
        </div>
        <div style={{ borderTop: `1px solid ${C.line}` }}>
          {s.drivers.map((d, i) => (
            <div key={d} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              borderTop: i ? `1px solid ${C.line}` : 'none',
            }}>
              <Mono style={{ fontSize: 10, color: C.dim2, width: 22 }}>
                {String(i+1).padStart(2,'0')}
              </Mono>
              <div style={{ flex: 1, fontSize: 12, color: C.text, fontFamily: sans }}>{d}</div>
              <div style={{ width: 60, height: 3, background: C.line, position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0, right: `${i * 15}%`, background: col,
                }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="What-If Simulator" meta="shock · preset · manual">
        <WhatIfPanel signal={s} />
      </Panel>

      {/* Decision panel */}
      <Panel title="Decision Log" meta="local · unpersisted">
        <DecisionPanel signal={s} />
      </Panel>

      <Panel title="Data Sources">
        <div style={{ padding: '10px 12px' }}>
          {[
            { n: 'FRED',          e: FRED_SERIES.filter(Boolean).join(', '),
              s: fredStatus === 'live' ? 'ok' : fredStatus === 'partial' ? 'partial' : 'mock' },
            { n: 'Alpha Vantage', e: 'TIME_SERIES_INTRADAY', s: 'mock' },
            { n: 'SEC EDGAR',     e: '13F-HR filings',       s: 'mock' },
            { n: 'CBOE',          e: 'options flow',         s: 'mock' },
          ].map((d, i) => {
            const col = d.s === 'ok' ? C.green : d.s === 'partial' ? C.amber : C.dim;
            return (
              <div key={d.n} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0',
                borderTop: i ? `1px solid ${C.line}` : 'none',
              }}>
                <Dot color={col} />
                <Mono style={{ fontSize: 11, color: C.text }}>{d.n}</Mono>
                <Mono style={{ fontSize: 10, color: C.dim, marginLeft: 'auto',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: 180 }}>{d.e}</Mono>
                <Mono style={{ fontSize: 9, color: col, letterSpacing: '0.08em' }}>
                  {d.s.toUpperCase()}
                </Mono>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

const WhatIfPanel = ({ signal }) => {
  const baseline = STRESS.components.map(c => c.v);
  const [deltas, setDeltas] = useState([0, 0, 0, 0, 0, 0]);
  const [preset, setPreset] = useState('BASE');
  const [open, setOpen] = useState(true);

  const values = baseline.map((b, i) => b + deltas[i]);
  const newStress = stressScore(values);
  const stressDelta = newStress - STRESS.level;
  const newRegime = regimeFor(newStress);
  const expectedMove = symbolMove(signal.sym, deltas);
  const newScore = scoreShift(signal.sym, deltas, signal.score, signal.dir);
  const scoreDelta = newScore - signal.score;

  const applyPreset = (id) => {
    const p = SCENARIOS.find(s => s.id === id);
    if (!p) return;
    setPreset(id);
    setDeltas(p.d);
  };

  const reset = () => { setPreset('BASE'); setDeltas([0, 0, 0, 0, 0, 0]); };

  const stressCol = newStress < 25 ? C.green : newStress < 50 ? C.amber
                  : newStress < 75 ? '#fb923c' : C.red;
  const moveCol = expectedMove >= 0 ? C.green : C.red;

  return (
    <div>
      {/* Output row — always visible */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: `1px solid ${C.line}`,
      }}>
        <div style={{ padding: '12px 10px', borderRight: `1px solid ${C.line}` }}>
          <Label style={{ fontSize: 9 }}>STRESS</Label>
          <div style={{
            fontFamily: mono, fontSize: 22, color: stressCol,
            fontWeight: 500, marginTop: 2, letterSpacing: '-0.02em',
          }}>
            {newStress.toFixed(0)}
          </div>
          <Mono style={{ fontSize: 10, color: stressDelta >= 0 ? C.red : C.green }}>
            {stressDelta >= 0 ? '+' : ''}{stressDelta.toFixed(0)} · {newRegime}
          </Mono>
        </div>
        <div style={{ padding: '12px 10px', borderRight: `1px solid ${C.line}` }}>
          <Label style={{ fontSize: 9 }}>EXP. MOVE</Label>
          <div style={{
            fontFamily: mono, fontSize: 22, color: moveCol,
            fontWeight: 500, marginTop: 2, letterSpacing: '-0.02em',
          }}>
            {expectedMove >= 0 ? '+' : ''}{expectedMove.toFixed(2)}%
          </div>
          <Mono style={{ fontSize: 10, color: C.dim }}>
            {signal.sym} · β-weighted
          </Mono>
        </div>
        <div style={{ padding: '12px 10px' }}>
          <Label style={{ fontSize: 9 }}>SCORE</Label>
          <div style={{
            fontFamily: mono, fontSize: 22, color: C.text,
            fontWeight: 500, marginTop: 2, letterSpacing: '-0.02em',
          }}>
            {newScore.toFixed(0)}
          </div>
          <Mono style={{ fontSize: 10, color: scoreDelta >= 0 ? C.red : C.green }}>
            {scoreDelta >= 0 ? '+' : ''}{scoreDelta.toFixed(0)} vs base
          </Mono>
        </div>
      </div>

      {/* Preset scenarios */}
      <div style={{
        padding: '10px', display: 'flex', gap: 4,
        overflowX: 'auto', borderBottom: `1px solid ${C.line}`,
      }}>
        {SCENARIOS.map(s => {
          const active = preset === s.id;
          return (
            <button key={s.id} onClick={() => applyPreset(s.id)} style={{
              background: active ? C.magenta : 'transparent',
              color: active ? C.bg : C.dim,
              border: `1px solid ${active ? C.magenta : C.line2}`,
              padding: '5px 9px', fontFamily: mono, fontSize: 10,
              letterSpacing: '0.06em', whiteSpace: 'nowrap', cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
              {s.n}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'transparent', border: 'none',
        borderBottom: open ? `1px solid ${C.line}` : 'none',
        padding: '8px 12px', color: C.cyan, fontFamily: mono, fontSize: 10,
        letterSpacing: '0.14em', cursor: 'pointer', textAlign: 'left',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{open ? '▾' : '▸'}  MANUAL SHOCKS</span>
        <span style={{ color: C.dim }} onClick={(e) => { e.stopPropagation(); reset(); }}>
          RESET
        </span>
      </button>

      {open && (
        <div style={{ padding: '10px 12px 12px' }}>
          {STRESS.components.map((c, i) => {
            const d = deltas[i];
            const v = baseline[i] + d;
            const pct = Math.max(-100, Math.min(100, (d / (STDDEV[i] * 3)) * 100));
            const col = Math.abs(d) < 0.01 ? C.dim
                      : (d > 0) === (i === 3) ? C.green : C.red; // T10Y2Y up = good
            return (
              <div key={c.k} style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', marginBottom: 3,
                }}>
                  <Mono style={{ fontSize: 11, color: C.text }}>{c.k}</Mono>
                  <div>
                    <Mono style={{ fontSize: 11, color: C.text }}>{v.toFixed(2)}</Mono>
                    <Mono style={{ fontSize: 10, color: col, marginLeft: 6 }}>
                      {d >= 0 ? '+' : ''}{d.toFixed(2)}
                    </Mono>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 16 }}>
                  <input
                    type="range"
                    min={-STDDEV[i] * 3}
                    max={STDDEV[i] * 3}
                    step={STDDEV[i] / 20}
                    value={d}
                    onChange={(e) => {
                      const nd = [...deltas];
                      nd[i] = parseFloat(e.target.value);
                      setDeltas(nd);
                      setPreset('CUSTOM');
                    }}
                    style={{
                      width: '100%', appearance: 'none', background: 'transparent',
                      margin: 0, padding: 0, position: 'absolute', inset: 0,
                      zIndex: 2, cursor: 'pointer',
                    }}
                  />
                  <div style={{
                    position: 'absolute', left: 0, right: 0, top: 7, height: 2,
                    background: C.line,
                  }} />
                  <div style={{
                    position: 'absolute', left: '50%', top: 4, bottom: 4,
                    width: 1, background: C.dim2,
                  }} />
                  <div style={{
                    position: 'absolute', top: 7, height: 2, background: col,
                    [pct >= 0 ? 'left' : 'right']: '50%',
                    width: `${Math.abs(pct) / 2}%`,
                  }} />
                </div>
              </div>
            );
          })}
          <style>{`
            input[type="range"]::-webkit-slider-thumb {
              appearance: none; width: 14px; height: 14px;
              background: ${C.text}; border: 1px solid ${C.bg};
              cursor: pointer; border-radius: 0;
            }
            input[type="range"]::-moz-range-thumb {
              width: 14px; height: 14px; background: ${C.text};
              border: 1px solid ${C.bg}; cursor: pointer; border-radius: 0;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

const DecisionPanel = ({ signal }) => {
  const [thesis, setThesis] = useState('');
  const [pos, setPos] = useState('none');
  const [logged, setLogged] = useState(false);
  const submit = () => { setLogged(true); setTimeout(() => setLogged(false), 2000); };
  return (
    <div style={{ padding: '12px' }}>
      <Label>Thesis</Label>
      <textarea
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder="Why do you agree or disagree with this signal?"
        style={{
          width: '100%', marginTop: 4, background: C.bg2, color: C.text,
          border: `1px solid ${C.line2}`, fontFamily: mono, fontSize: 12,
          padding: 8, minHeight: 60, resize: 'vertical', boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      <Label style={{ marginTop: 10, display: 'block' }}>Position</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 4 }}>
        {['short', 'none', 'long'].map(p => {
          const active = pos === p;
          const c = p === 'short' ? C.red : p === 'long' ? C.green : C.dim;
          return (
            <button key={p} onClick={() => setPos(p)} style={{
              background: active ? c : 'transparent',
              color: active ? C.bg : c,
              border: `1px solid ${active ? c : C.line2}`,
              fontFamily: mono, fontSize: 11, padding: '8px', letterSpacing: '0.1em',
              cursor: 'pointer', textTransform: 'uppercase',
            }}>
              {p}
            </button>
          );
        })}
      </div>
      <button onClick={submit} style={{
        width: '100%', marginTop: 10, background: logged ? C.green : C.text,
        color: C.bg, border: 'none', padding: '10px', fontFamily: mono,
        fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer', fontWeight: 600,
      }}>
        {logged ? '✓ LOGGED' : 'LOG DECISION'}
      </button>
    </div>
  );
};

// ============================================================
// ROOT
// ============================================================
export default function Terminal() {
  const [tab, setTab] = useState('overview');
  const [sel, setSel] = useState(null);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${d.toISOString().slice(11, 19)}Z · NYSE OPEN`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: sans, fontSize: 14,
      backgroundImage: `radial-gradient(${C.line2} 0.5px, transparent 0.5px)`,
      backgroundSize: '24px 24px',
      backgroundPosition: '0 0',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter+Tight:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.line2}; }
        button:active { opacity: 0.7; }
      `}</style>

      <Header clock={clock} />

      <div style={{
        maxWidth: 480, margin: '0 auto', padding: '10px 10px 70px',
        background: C.bg,
      }}>
        {tab === 'overview' && <OverviewView setTab={setTab} setSel={setSel} />}
        {tab === 'gauges'   && <GaugesView />}
        {tab === 'signals'  && <SignalsView setTab={setTab} setSel={setSel} />}
        {tab === 'players'  && <PlayersView />}
        {tab === 'detail'   && <DetailView sel={sel} />}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto' }}>
        <TabBar tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
