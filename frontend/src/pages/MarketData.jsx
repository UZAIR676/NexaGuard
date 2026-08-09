import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell, ComposedChart
} from "recharts";
import { T, s } from "../theme";
import { api } from "../api";

// ── Company name → ticker symbol mapping ──
// Search box abhi sirf ticker leta tha (AMZN). Ye map full names
// (amazon, apple, tesla...) ko sahi symbol mein convert karta hai.
const COMPANY_ALIASES = {
  "amazon": "AMZN",
  "apple": "AAPL",
  "google": "GOOGL",
  "alphabet": "GOOGL",
  "microsoft": "MSFT",
  "tesla": "TSLA",
  "meta": "META",
  "facebook": "META",
  "netflix": "NFLX",
  "nvidia": "NVDA",
  "jpmorgan": "JPM",
  "jp morgan": "JPM",
  "visa": "V",
  "exxon": "XOM",
  "exxon mobil": "XOM",
  "exxonmobil": "XOM",
  "bank of america": "BAC",
  "wells fargo": "WFC",
  "goldman sachs": "GS",
  "mastercard": "MA",
  "johnson & johnson": "JNJ",
  "johnson and johnson": "JNJ",
  "walmart": "WMT",
  "costco": "COST",
  "disney": "DIS",
  "coca cola": "KO",
  "coca-cola": "KO",
  "pepsi": "PEP",
  "pepsico": "PEP",
  "intel": "INTC",
  "amd": "AMD",
  "advanced micro devices": "AMD",
  "berkshire": "BRK-B",
  "berkshire hathaway": "BRK-B",
  "salesforce": "CRM",
  "adobe": "ADBE",
  "oracle": "ORCL",
  "paypal": "PYPL",
  "uber": "UBER",
  "starbucks": "SBUX",
  "boeing": "BA",
  "ford": "F",
  "general motors": "GM",
  "chevron": "CVX",
  "pfizer": "PFE",
  "cisco": "CSCO",
  "qualcomm": "QCOM",
  "ibm": "IBM",
};

// Company/ticker input ko backend-friendly symbol mein resolve karta hai.
function resolveSymbol(rawInput) {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();

  // Exact name match
  if (COMPANY_ALIASES[lower]) return COMPANY_ALIASES[lower];

  // Partial / fuzzy name match (e.g. "amazon.com", "apple inc")
  const matchKey = Object.keys(COMPANY_ALIASES).find(
    (name) => lower.includes(name) || name.includes(lower)
  );
  if (matchKey) return COMPANY_ALIASES[matchKey];

  // Fallback: treat as a raw ticker symbol
  return trimmed.toUpperCase();
}

export default function MarketData() {
  const [tab, setTab]             = useState("indices");
  const [indices, setIndices]     = useState([]);
  const [sectors, setSectors]     = useState([]);
  const [crypto, setCrypto]       = useState([]);
  const [movers, setMovers]       = useState({ top_gainers: [], top_losers: [] });
  const [history, setHistory]     = useState([]);
  const [selSym, setSelSym]       = useState("AAPL");
  const [selPeriod, setSelPeriod] = useState("3mo");
  const [showIndicators, setShowIndicators] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [search, setSearch]       = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [mlSignals, setMlSignals] = useState([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlScanned, setMlScanned] = useState(false);
  const [searchHistory, setSearchHistory]   = useState([]);
  const [searchFundamentals, setSearchFundamentals] = useState(null);
  const [searchChart, setSearchChart]       = useState([]);
  const [searchPeriod, setSearchPeriod]     = useState("3mo");
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchError, setSearchError]       = useState(null);
  const [showSearchIndicators, setShowSearchIndicators] = useState(false);

  // ── NEW: ML single-stock search ──
  const [mlSearch, setMlSearch]   = useState("");
  const [mlResult, setMlResult]   = useState(null);
  const [mlSearchLoading, setMlSearchLoading] = useState(false);
  const [mlSearchError, setMlSearchError]     = useState(null);

  // News + combined AI outlook (fetched alongside the ML prediction above)
  const [newsResult, setNewsResult] = useState(null);
  const [newsError, setNewsError]   = useState(null);

  // ── NEW: per-article on-demand AI summary ──
  // Keyed by article link. { [link]: { loading, text, error } }
  const [articleSummaries, setArticleSummaries] = useState({});
  // Keyed by article link. { [link]: bool } — whether the summary panel is open.
  const [expandedSummary, setExpandedSummary]   = useState({});

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadHistory(selSym, selPeriod); }, [selSym, selPeriod]);
  useEffect(() => {
  if (searchResult?.symbol) {
    api.history(searchResult.symbol, searchPeriod)
      .then(h => setSearchChart(h.data || []));
  }
}, [searchPeriod]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [idx, sec, cry, mv] = await Promise.all([
        api.indices(), api.sectors(), api.crypto(), api.movers()
      ]);
      setIndices(idx);
      setSectors(sec);
      setCrypto(cry);
      setMovers(mv);
    } catch { console.log("Backend offline"); }
    setLoading(false);
  };

  const loadHistory = async (sym, period) => {
    setHistLoading(true);
    try {
      const h = await api.history(sym, period);
      setHistory(h.data || []);
    } catch { }
    setHistLoading(false);
  };

  const loadMLSignals = async () => {
    setMlLoading(true);
    try {
      const r    = await fetch("http://localhost:8000/api/ml/scan");
      const data = await r.json();
      setMlSignals(Array.isArray(data) ? data : []);
      setMlScanned(true);
    } catch { }
    setMlLoading(false);
  };

  // ── NEW: ML single-stock predict ──
  const searchML = async () => {
    if (!mlSearch.trim()) return;
    setMlSearchLoading(true);
    setMlResult(null);
    setMlSearchError(null);
    setNewsResult(null);
    setNewsError(null);
    setArticleSummaries({});
    setExpandedSummary({});

    const sym   = resolveSymbol(mlSearch);
    const token = localStorage.getItem("ng_token") || "";

    try {
      const res = await fetch(`http://localhost:8000/api/ml/predict/${sym}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMlResult(data);
    } catch (e) {
      setMlSearchError(e.message || "Prediction failed");
    }

    // News + sentiment is independent of the prediction above — one failing
    // shouldn't block the other.
    try {
      const newsRes = await fetch(`http://localhost:8000/api/news/${sym}/outlook?token=${token}`);
      if (!newsRes.ok) throw new Error("Could not load news");
      const newsData = await newsRes.json();
      setNewsResult(newsData);
    } catch (e) {
      setNewsError(e.message || "Could not load news");
    }

    setMlSearchLoading(false);
  };

  // ── NEW: fetch (or toggle) the on-demand AI summary for one article ──
  // Called only when the user clicks "Summary" on a specific headline —
  // matches the backend's /api/news/article/summary design (cheap, on click).
  const toggleSummary = async (link) => {
    const isOpen = expandedSummary[link];
    setExpandedSummary(prev => ({ ...prev, [link]: !isOpen }));

    // Already open (just closing) or already fetched — don't refetch.
    if (isOpen || articleSummaries[link]) return;

    setArticleSummaries(prev => ({ ...prev, [link]: { loading: true } }));
    const token = localStorage.getItem("ng_token") || "";
    try {
      const res  = await fetch(`http://localhost:8000/api/news/article/summary?url=${encodeURIComponent(link)}&token=${token}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setArticleSummaries(prev => ({ ...prev, [link]: { loading: false, text: data.summary, resolvedUrl: data.resolved_url } }));
    } catch (e) {
      setArticleSummaries(prev => ({ ...prev, [link]: { loading: false, error: e.message || "Summary fetch failed" } }));
    }
  };

 const doSearch = async () => {
  if (!search) return;
  setSearchLoading(true);
  setSearchError(null);
  try {
    const sym = resolveSymbol(search);
    const [r, fund, hist] = await Promise.all([
      api.search(sym),
      api.fundamentals(sym),
      api.history(sym, searchPeriod),
    ]);
    setSearchResult(r);
    setSearchFundamentals(fund);
    setSearchChart(hist.data || []);
  } catch (e) {
    setSearchError("Could not find that symbol/company. Try the ticker (e.g. AMZN).");
  }
  setSearchLoading(false);
};

  const fmt = (p) => {
    if (!p && p !== 0) return "N/A";
    if (p >= 1e12) return `$${(p / 1e12).toFixed(2)}T`;
    if (p >= 1e9)  return `$${(p / 1e9).toFixed(2)}B`;
    if (p >= 1000) return `$${(p / 1000).toFixed(1)}K`;
    return `$${p.toFixed(2)}`;
  };

  const fmtPct = (v) => (v == null || isNaN(v)) ? "N/A" : `${(v * 100).toFixed(2)}%`;

  const color = (v) => v > 0 ? T.green : T.red;
  const sign  = (v) => v > 0 ? "+" : "";

  const CHART_SYMS    = ["AAPL","MSFT","NVDA","TSLA","AMZN","GOOGL","META"];
  const CHART_PERIODS = [["1wk","1W"],["1mo","1M"],["3mo","3M"],["6mo","6M"],["1y","1Y"]];

  const TABS = [
    { id: "indices",     label: "📊 Indices"    },
    { id: "sectors",     label: "🏭 Sectors"    },
    { id: "crypto",      label: "₿ Crypto"      },
    { id: "gainers",     label: "📈 Gainers"    },
    { id: "losers",      label: "📉 Losers"     },
    { id: "ml signals",  label: "🤖 ML Signals" },
  ];

  const mlBuy    = mlSignals.filter(r => r.signal === "BUY"  && r.confidence === "HIGH");
  const mlMedBuy = mlSignals.filter(r => r.signal === "BUY"  && r.confidence !== "HIGH");
  const mlHold   = mlSignals.filter(r => r.signal === "HOLD");
  const mlSell   = mlSignals.filter(r => r.signal === "SELL");

  const latest    = history.length ? history[history.length - 1] : null;
  const rsiColor  = !latest?.rsi ? T.muted : latest.rsi > 70 ? T.red : latest.rsi < 30 ? T.green : T.amber;
  const macdColor = !latest?.macd ? T.muted : latest.macd > 0 ? T.green : T.red;

  const tickInterval = (len) => {
    if (len <= 10)  return 0;
    if (len <= 30)  return 4;
    if (len <= 65)  return 9;
    return Math.floor(len / 6);
  };

  // ── Signal color helper (reused for mlResult card) ──
  const sigColor = (sig) =>
    sig === "BUY"  ? T.green :
    sig === "SELL" ? T.red   : T.amber;

  return (
    <div>
      <style>{`
        @keyframes ngPulseRed {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        .ng-live-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: ${T.red};
          display: inline-block;
          margin-right: 6px;
          animation: ngPulseRed 1.6s infinite;
        }
        .ng-glow-card:hover {
          box-shadow: 0 0 0 1px ${T.red}55, 0 8px 24px -8px ${T.red}33;
          transition: box-shadow 0.25s ease;
        }
        .ng-red-underline {
          background: linear-gradient(90deg, ${T.red}, transparent);
          height: 2px;
          width: 60px;
          margin-top: 6px;
          border-radius: 2px;
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={s.h2}>Market Data</div>
          <div style={s.muted}><span className="ng-live-dot" />Live USA market — real-time data from Yahoo Finance</div>
          <div className="ng-red-underline" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...s.input, width: 200, marginTop: 0, padding: "8px 12px" }}
            placeholder="Search: AAPL or Amazon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
          />
          <button onClick={doSearch} style={{ ...s.navItem, ...s.navItemActive, padding: "8px 14px" }}>Search</button>
          <button onClick={loadAll}  style={{ ...s.navItem, ...s.navItemActive, padding: "8px 14px" }}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Search Error ── */}
      {searchError && !searchLoading && (
        <div style={{ ...s.card, marginBottom: 20, padding: "14px 16px", border: `1px solid ${T.red}`, color: T.red, fontSize: 13 }}>
          ⚠️ {searchError}
        </div>
      )}

      {/* ── Search Result ── */}
      {searchLoading && (
  <div style={{ ...s.card, marginBottom: 20, textAlign: "center", padding: "32px 0" }}>
    <div style={{ color: T.muted, fontSize: 14 }}>🔍 Loading {search.toUpperCase()}...</div>
  </div>
)}

{searchResult && !searchResult.error && !searchLoading && (
  <div style={{ ...s.card, marginBottom: 20 }}>

    {/* Top Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* Symbol + Name */}
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.accent, fontFamily: "monospace" }}>
            {searchResult.symbol}
          </div>
          <div style={{ color: T.muted, fontSize: 14, marginTop: 2 }}>
            {searchFundamentals?.name || searchResult.name}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <span style={{ ...s.badge, ...s.badgeAmber, fontSize: 11 }}>{searchFundamentals?.sector}</span>
            <span style={{ ...s.badge, background: T.surface, color: T.muted, border: `1px solid ${T.border}`, fontSize: 11 }}>
              {searchFundamentals?.industry}
            </span>
          </div>
        </div>

        {/* Price */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {fmt(searchResult.price)}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
            Analyst Target: <strong style={{ color: T.green }}>
              {searchFundamentals?.analyst_target != null ? `$${searchFundamentals.analyst_target.toFixed(2)}` : "N/A"}
            </strong>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ ...s.badge, ...(searchFundamentals?.recommendation === "buy" || searchFundamentals?.recommendation === "strong_buy" ? s.badgeGreen : searchFundamentals?.recommendation === "hold" ? s.badgeAmber : s.badgeRed), fontSize: 12 }}>
              {searchFundamentals?.recommendation?.toUpperCase()} · {searchFundamentals?.analyst_count} analysts
            </span>
          </div>
        </div>
      </div>

      <button onClick={() => { setSearchResult(null); setSearchFundamentals(null); setSearchChart([]); }}
        style={{ ...s.navItem, fontSize: 12 }}>✕ Close</button>
    </div>

    {/* Fundamentals Grid */}
    {searchFundamentals && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          ["PE Ratio",       searchFundamentals.pe_ratio?.toFixed(2),                    T.accent],
          ["Forward PE",     searchFundamentals.forward_pe?.toFixed(2),                  T.accent],
          ["EPS",            searchFundamentals.eps != null ? `$${searchFundamentals.eps.toFixed(2)}` : null, T.green ],
          ["Dividend Yield", fmtPct(searchFundamentals.dividend_yield),                   T.green ],
          ["Market Cap",     fmt(searchFundamentals.market_cap),                         T.accent],
          ["Revenue",        fmt(searchFundamentals.revenue),                            T.accent],
          ["Profit Margin",  fmtPct(searchFundamentals.profit_margin),                    T.green ],
          ["Beta",           searchFundamentals.beta?.toFixed(3),                        searchFundamentals.beta > 1.5 ? T.red : searchFundamentals.beta > 1 ? T.amber : T.green],
        ].map(([label, val, col]) => (
          <div key={label} style={{ background: T.surface, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.05em" }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{val ?? "N/A"}</div>
          </div>
        ))}
      </div>
    )}

    {/* Chart */}
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>
          Price Chart
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[["1wk","1W"],["1mo","1M"],["3mo","3M"],["6mo","6M"],["1y","1Y"]].map(([val, label]) => (
            <button key={val} onClick={() => setSearchPeriod(val)}
              style={{ ...s.navItem, ...(searchPeriod === val ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
              {label}
            </button>
          ))}
          <div style={{ width: 1, background: T.border, height: 20, margin: "0 2px" }} />
          <button
            onClick={() => setShowSearchIndicators(p => !p)}
            style={{ ...s.navItem, ...(showSearchIndicators ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
            📊 Indicators
          </button>
        </div>
      </div>

      {searchChart.length > 0 ? (
        <>
          {/* Price + EMA */}
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={searchChart}>
              <defs>
                <linearGradient id="searchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }}
                tickFormatter={d => d?.slice(5,10)}
                interval={tickInterval(searchChart.length)} />
              <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: T.muted }}
                tickFormatter={v => `$${v}`} width={55} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name === "close" ? "Price" : name === "ema20" ? "EMA 20" : "EMA 50"]}
                labelFormatter={l => l?.slice(0,10)} />
              <Area type="monotone" dataKey="close"  stroke={T.accent}  fill="url(#searchGrad)" strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="ema20"  stroke="#a78bfa"   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="ema50"  stroke="#60a5fa"   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              {showSearchIndicators && <>
                <Line type="monotone" dataKey="bb_upper" stroke={T.red}   strokeWidth={1} dot={false} strokeDasharray="2 3" opacity={0.7} />
                <Line type="monotone" dataKey="bb_lower" stroke={T.green} strokeWidth={1} dot={false} strokeDasharray="2 3" opacity={0.7} />
                <Line type="monotone" dataKey="bb_mid"   stroke={T.muted} strokeWidth={1} dot={false} strokeDasharray="2 3" opacity={0.5} />
              </>}
            </ComposedChart>
          </ResponsiveContainer>

          {showSearchIndicators && (
            <>
          {/* RSI */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
              RSI (14) — {searchChart[searchChart.length-1]?.rsi?.toFixed(2) ?? "—"}
              {searchChart[searchChart.length-1]?.rsi > 70 && <span style={{ color: T.red,   marginLeft: 8 }}>⚠️ Overbought</span>}
              {searchChart[searchChart.length-1]?.rsi < 30 && <span style={{ color: T.green, marginLeft: 8 }}>✅ Oversold</span>}
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <ComposedChart data={searchChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.muted }}
                  tickFormatter={d => d?.slice(5,10)}
                  interval={tickInterval(searchChart.length)} />
                <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: T.muted }} width={28} />
                <Tooltip
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                  formatter={v => [v?.toFixed(2), "RSI"]}
                  labelFormatter={l => l?.slice(0,10)} />
                <ReferenceLine y={70} stroke={T.red}   strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke={T.green} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="rsi" stroke={T.amber} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* MACD */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
              MACD — {searchChart[searchChart.length-1]?.macd?.toFixed(3) ?? "—"}
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <ComposedChart data={searchChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.muted }}
                  tickFormatter={d => d?.slice(5,10)}
                  interval={tickInterval(searchChart.length)} />
                <YAxis tick={{ fontSize: 9, fill: T.muted }} width={35} />
                <Tooltip
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [v?.toFixed(4), name === "macd" ? "MACD" : "Signal"]}
                  labelFormatter={l => l?.slice(0,10)} />
                <ReferenceLine y={0} stroke={T.muted} strokeDasharray="3 3" />
                <Bar dataKey="macd_hist" radius={[2,2,0,0]}>
                  {searchChart.map((d, i) => (
                    <Cell key={i} fill={d.macd_hist >= 0 ? T.green : T.red} opacity={0.8} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="macd"     stroke={T.accent} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="macd_sig" stroke={T.red}    strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Volume */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
              Volume
              <span style={{ marginLeft: 8, color: T.accent, fontWeight: 700 }}>
                {searchChart[searchChart.length-1]?.volume ? (searchChart[searchChart.length-1].volume / 1e6).toFixed(1) + "M" : "—"}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={searchChart}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.muted }}
                  tickFormatter={d => d?.slice(5,10)}
                  interval={tickInterval(searchChart.length)} />
                <YAxis tick={{ fontSize: 9, fill: T.muted }} tickFormatter={v => `${(v/1e6).toFixed(0)}M`} width={40} />
                <Tooltip
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                  formatter={v => [`${(v/1e6).toFixed(2)}M`, "Volume"]}
                  labelFormatter={l => l?.slice(0,10)} />
                <Bar dataKey="volume" radius={[2,2,0,0]}>
                  {searchChart.map((d, i) => (
                    <Cell key={i} fill={i > 0 && d.close >= searchChart[i-1]?.close ? T.green : T.red} opacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
            </>
          )}
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 0", color: T.muted }}>Loading chart...</div>
      )}
    </div>

    {/* Description */}
    {searchFundamentals?.description && (
      <div style={{ padding: "12px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
        {searchFundamentals.description}
      </div>
    )}
  </div>
)}

      {/* ── Index Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
        {loading
          ? ["S&P 500","NASDAQ","DOW","RUSSELL","VIX","NYSE"].map(n => (
              <div key={n} style={{ ...s.statCard, padding: 14 }}>
                <div style={s.statLabel}>{n}</div>
                <div style={{ color: T.muted, fontSize: 13 }}>Loading...</div>
              </div>
            ))
          : indices.map(idx => (
              <div key={idx.name} style={{ ...s.statCard, padding: 14, borderTop: `3px solid ${idx.change_pct >= 0 ? T.green : T.red}` }}>
                <div style={s.statLabel}>{idx.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmt(idx.price)}</div>
                <div style={{ fontSize: 12, color: color(idx.change_pct), marginTop: 2, fontWeight: 600 }}>
                  {sign(idx.change_pct)}{idx.change_pct}%
                </div>
              </div>
            ))
        }
      </div>

      {/* ── Stock Chart ── */}
      <div style={{ ...s.card, marginBottom: 20 }} className="ng-glow-card">

        {/* Chart Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.h3}>{selSym}</div>
            <span style={{ ...s.badge, ...s.badgeGreen, fontSize: 10, display: "inline-flex", alignItems: "center" }}>
              <span className="ng-live-dot" style={{ width: 6, height: 6, marginRight: 4 }} />LIVE
            </span>
            {histLoading && <span style={{ fontSize: 12, color: T.muted }}>Loading...</span>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {CHART_SYMS.map(sym => (
                <button key={sym} onClick={() => setSelSym(sym)}
                  style={{ ...s.navItem, ...(selSym === sym ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
                  {sym}
                </button>
              ))}
            </div>
            <div style={{ width: 1, background: T.border, height: 20 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {CHART_PERIODS.map(([val, label]) => (
                <button key={val} onClick={() => setSelPeriod(val)}
                  style={{ ...s.navItem, ...(selPeriod === val ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ width: 1, background: T.border, height: 20 }} />
            <button
              onClick={() => setShowIndicators(p => !p)}
              style={{ ...s.navItem, ...(showIndicators ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
              📊 Indicators
            </button>
          </div>
        </div>

        {/* Latest Indicator Pills */}
        {latest && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ ...s.badge, background: T.surface, color: T.muted, border: `1px solid ${T.border}`, fontSize: 11 }}>
              Close: <strong style={{ color: T.accent }}>${latest.close}</strong>
            </span>
            {latest.ema20 && (
              <span style={{ ...s.badge, background: T.surface, color: T.muted, border: `1px solid ${T.border}`, fontSize: 11 }}>
                EMA20: <strong style={{ color: "#a78bfa" }}>${latest.ema20}</strong>
              </span>
            )}
            {latest.ema50 && (
              <span style={{ ...s.badge, background: T.surface, color: T.muted, border: `1px solid ${T.border}`, fontSize: 11 }}>
                EMA50: <strong style={{ color: "#60a5fa" }}>${latest.ema50}</strong>
              </span>
            )}
            {latest.rsi && (
              <span style={{ ...s.badge, background: T.surface, border: `1px solid ${T.border}`, fontSize: 11 }}>
                RSI: <strong style={{ color: rsiColor }}>{latest.rsi}</strong>
                <span style={{ color: T.muted, marginLeft: 4 }}>
                  {latest.rsi > 70 ? "⚠️ Overbought" : latest.rsi < 30 ? "✅ Oversold" : ""}
                </span>
              </span>
            )}
            {latest.macd != null && (
              <span style={{ ...s.badge, background: T.surface, border: `1px solid ${T.border}`, fontSize: 11 }}>
                MACD: <strong style={{ color: macdColor }}>{latest.macd?.toFixed(3)}</strong>
              </span>
            )}
            {latest.bb_upper && (
              <span style={{ ...s.badge, background: T.surface, color: T.muted, border: `1px solid ${T.border}`, fontSize: 11 }}>
                BB: <strong style={{ color: T.green }}>${latest.bb_lower}</strong>
                {" – "}
                <strong style={{ color: T.red }}>${latest.bb_upper}</strong>
              </span>
            )}
          </div>
        )}

        {/* Price + EMA Chart */}
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={history}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={T.accent} stopOpacity={0.25} />
                <stop offset="95%" stopColor={T.accent} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }}
              tickFormatter={d => d?.slice(5,10)}
              interval={tickInterval(history.length)} />
            <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: T.muted }}
              tickFormatter={v => `$${v}`} width={55} />
            <Tooltip
              contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
              formatter={(v, name) => {
                const labels = { close: "Price", ema20: "EMA 20", ema50: "EMA 50", bb_upper: "BB Upper", bb_lower: "BB Lower" };
                return [`$${Number(v).toFixed(2)}`, labels[name] || name];
              }}
              labelFormatter={l => l?.slice(0,10)} />
            <Area  type="monotone" dataKey="close"    stroke={T.accent}   fill="url(#grad)" strokeWidth={2}   dot={false} />
            <Line  type="monotone" dataKey="ema20"    stroke="#a78bfa"    strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line  type="monotone" dataKey="ema50"    stroke="#60a5fa"    strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            {showIndicators && <>
              <Line type="monotone" dataKey="bb_upper" stroke={T.red}   strokeWidth={1} dot={false} strokeDasharray="2 3" opacity={0.7} />
              <Line type="monotone" dataKey="bb_lower" stroke={T.green} strokeWidth={1} dot={false} strokeDasharray="2 3" opacity={0.7} />
              <Line type="monotone" dataKey="bb_mid"   stroke={T.muted} strokeWidth={1} dot={false} strokeDasharray="2 3" opacity={0.5} />
            </>}
          </ComposedChart>
        </ResponsiveContainer>

        {/* RSI + MACD — sirf indicators button on hone pe */}
        {showIndicators && (
          <>
            {/* RSI Chart */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600 }}>
                RSI (14)
                <span style={{ marginLeft: 8, color: rsiColor, fontWeight: 700 }}>
                  {latest?.rsi ?? "—"}
                </span>
                <span style={{ marginLeft: 8, fontSize: 11, color: T.muted }}>
                  70 = Overbought · 30 = Oversold
                </span>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <ComposedChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.muted }}
                    tickFormatter={d => d?.slice(5,10)}
                    interval={tickInterval(history.length)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: T.muted }} width={30} />
                  <Tooltip
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                    formatter={v => [v?.toFixed(2), "RSI"]}
                    labelFormatter={l => l?.slice(0,10)} />
                  <ReferenceLine y={70} stroke={T.red}   strokeDasharray="3 3" label={{ value: "70", fill: T.red,   fontSize: 10 }} />
                  <ReferenceLine y={30} stroke={T.green} strokeDasharray="3 3" label={{ value: "30", fill: T.green, fontSize: 10 }} />
                  <ReferenceLine y={50} stroke={T.muted} strokeDasharray="2 4" opacity={0.5} />
                  <Line type="monotone" dataKey="rsi" stroke={T.amber} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* MACD Chart */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600 }}>
                MACD (12, 26, 9)
                <span style={{ marginLeft: 8, color: macdColor, fontWeight: 700 }}>
                  {latest?.macd?.toFixed(3) ?? "—"}
                </span>
                <span style={{ marginLeft: 8, fontSize: 11, color: T.muted }}>
                  Signal: {latest?.macd_sig?.toFixed(3) ?? "—"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <ComposedChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.muted }}
                    tickFormatter={d => d?.slice(5,10)}
                    interval={tickInterval(history.length)} />
                  <YAxis tick={{ fontSize: 9, fill: T.muted }} width={40} />
                  <Tooltip
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                    formatter={(v, name) => [v?.toFixed(4), name === "macd" ? "MACD" : name === "macd_sig" ? "Signal" : "Histogram"]}
                    labelFormatter={l => l?.slice(0,10)} />
                  <ReferenceLine y={0} stroke={T.muted} strokeDasharray="3 3" />
                  <Bar dataKey="macd_hist" radius={[2,2,0,0]}>
                    {history.map((d, i) => (
                      <Cell key={i} fill={d.macd_hist >= 0 ? T.green : T.red} opacity={0.8} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="macd"     stroke={T.accent} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="macd_sig" stroke={T.red}    strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Chart */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600 }}>
                Volume
                <span style={{ marginLeft: 8, color: T.accent, fontWeight: 700 }}>
                  {latest?.volume ? (latest.volume / 1e6).toFixed(1) + "M" : "—"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={history}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.muted }}
                    tickFormatter={d => d?.slice(5,10)}
                    interval={tickInterval(history.length)} />
                  <YAxis tick={{ fontSize: 9, fill: T.muted }} tickFormatter={v => `${(v/1e6).toFixed(0)}M`} width={40} />
                  <Tooltip
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                    formatter={v => [`${(v/1e6).toFixed(2)}M`, "Volume"]}
                    labelFormatter={l => l?.slice(0,10)} />
                  <Bar dataKey="volume" radius={[2,2,0,0]}>
                    {history.map((d, i) => (
                      <Cell key={i} fill={i > 0 && d.close >= history[i-1]?.close ? T.green : T.red} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: T.muted, flexWrap: "wrap" }}>
              {[
                ["──", T.accent,  "Price"],
                ["- -", "#a78bfa", "EMA 20"],
                ["- -", "#60a5fa", "EMA 50"],
                ["- -", T.red,    "BB Upper"],
                ["- -", T.green,  "BB Lower"],
              ].map(([line, col, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: col, fontWeight: 700 }}>{line}</span> {label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id}
            style={{ ...s.navItem, ...(tab === t.id ? s.navItemActive : {}), fontSize: 13 }}
            onClick={() => { setTab(t.id); if (t.id === "ml signals" && !mlScanned) loadMLSignals(); }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div style={s.card}>

        {/* Indices */}
        {tab === "indices" && (
          <table style={s.table}>
            <thead><tr>
              {["Index","Price","Change","Change %","52W High","52W Low"].map(h =>
                <th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {indices.map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ ...s.td, fontWeight: 700 }}>{fmt(r.price)}</td>
                  <td style={{ ...s.td, color: color(r.change),     fontWeight: 600 }}>{sign(r.change)}{r.change}</td>
                  <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>{sign(r.change_pct)}{r.change_pct}%</td>
                  <td style={s.td}>{fmt(r["52w_high"])}</td>
                  <td style={s.td}>{fmt(r["52w_low"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Sectors */}
        {tab === "sectors" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sectors.map(sec => ({ name: sec.sector?.split(" ")[0], val: sec.change_pct }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`${v}%`, "Change"]} />
                  <ReferenceLine y={0} stroke={T.border} />
                  <Bar dataKey="val" radius={[4,4,0,0]}>
                    {sectors.map((sec, i) => (
                      <Cell key={i} fill={sec.change_pct >= 0 ? T.green : T.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table style={s.table}>
              <thead><tr>
                {["Sector","ETF","Price","Change %","Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {sectors.map(r => (
                  <tr key={r.symbol}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{r.sector}</td>
                    <td style={{ ...s.td, fontFamily: "monospace", color: T.accent }}>{r.symbol}</td>
                    <td style={s.td}>{fmt(r.price)}</td>
                    <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>{sign(r.change_pct)}{r.change_pct}%</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(r.signal?.includes("BUY") ? s.badgeGreen : r.signal === "HOLD" ? s.badgeAmber : s.badgeRed) }}>
                        {r.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Crypto */}
        {tab === "crypto" && (
          <table style={s.table}>
            <thead><tr>
              {["Asset","Symbol","Price","Change %","Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {crypto.map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ ...s.td, fontFamily: "monospace", color: T.amber }}>{r.symbol}</td>
                  <td style={{ ...s.td, fontWeight: 700 }}>{fmt(r.price)}</td>
                  <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>{sign(r.change_pct)}{r.change_pct}%</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(r.signal?.includes("BUY") ? s.badgeGreen : r.signal === "HOLD" ? s.badgeAmber : s.badgeRed) }}>
                      {r.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Gainers */}
        {tab === "gainers" && (
          <table style={s.table}>
            <thead><tr>
              {["Symbol","Price","Change %","Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(movers.top_gainers || []).map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 700, color: T.accent, fontFamily: "monospace" }}>{r.symbol}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>${r.price}</td>
                  <td style={{ ...s.td, color: T.green, fontWeight: 700 }}>+{r.change_pct}%</td>
                  <td style={s.td}><span style={{ ...s.badge, ...s.badgeGreen }}>{r.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Losers */}
        {tab === "losers" && (
          <table style={s.table}>
            <thead><tr>
              {["Symbol","Price","Change %","Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(movers.top_losers || []).map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 700, color: T.accent, fontFamily: "monospace" }}>{r.symbol}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>${r.price}</td>
                  <td style={{ ...s.td, color: T.red, fontWeight: 700 }}>{r.change_pct}%</td>
                  <td style={s.td}><span style={{ ...s.badge, ...s.badgeRed }}>{r.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ML Signals */}
        {tab === "ml signals" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🤖 NexaGuard ML — Stock Signal Scanner</div>
                <div style={{ fontSize: 12, color: T.muted }}>XGBoost model · 2-day forward return prediction · 16 technical features</div>
              </div>
              <button onClick={loadMLSignals} style={{ ...s.navItem, ...s.navItemActive, fontSize: 12, padding: "6px 14px" }}>
                ↻ Re-scan Market
              </button>
            </div>

            {/* ── NEW: Single Stock ML Search ── */}
            <div style={{ marginBottom: 20, padding: "14px 16px", background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 10 }}>
                🔍 Predict Any Stock
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...s.input, flex: 1, marginTop: 0, padding: "8px 12px", fontFamily: "monospace" }}
                  placeholder="e.g. AAPL, Tesla, Nvidia..."
                  value={mlSearch}
                  onChange={e => setMlSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchML()}
                />
                <button
                  onClick={searchML}
                  disabled={mlSearchLoading}
                  style={{ ...s.navItem, ...s.navItemActive, padding: "8px 20px", fontSize: 13, opacity: mlSearchLoading ? 0.6 : 1 }}>
                  {mlSearchLoading ? "⏳ Running..." : "🤖 Predict"}
                </button>
                {mlResult && (
                  <button
                    onClick={() => { setMlResult(null); setMlSearch(""); setMlSearchError(null); setNewsResult(null); setNewsError(null); setArticleSummaries({}); setExpandedSummary({}); }}
                    style={{ ...s.navItem, fontSize: 12, padding: "8px 12px" }}>
                    ✕
                  </button>
                )}
              </div>

              {/* Error */}
              {mlSearchError && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#450a0a", border: `1px solid ${T.red}`, fontSize: 12, color: T.red }}>
                  ⚠️ {mlSearchError}
                </div>
              )}

              {/* Result Card */}
              {mlResult && !mlSearchError && (
                <>
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                  {[
                    ["Symbol",     mlResult.symbol,                               T.accent],
                    ["Price",      `$${Number(mlResult.price).toFixed(2)}`,        T.accent],
                    ["Signal",     mlResult.signal,                                sigColor(mlResult.signal)],
                    ["UP Prob",    `${Number(mlResult.up_prob).toFixed(1)}%`,      Number(mlResult.up_prob) >= 65 ? T.green : Number(mlResult.up_prob) >= 55 ? T.amber : T.muted],
                    ["Confidence", mlResult.confidence,                            mlResult.confidence === "HIGH" ? T.green : mlResult.confidence === "MEDIUM" ? T.amber : T.red],
                  ].map(([label, val, col]) => (
                    <div key={label} style={{ background: T.card, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.05em" }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: col, fontFamily: label === "Symbol" ? "monospace" : "inherit" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* ── Simple visual graph: UP vs DOWN probability ── */}
                <div style={{ marginTop: 16, background: T.card, borderRadius: 8, padding: "14px 16px", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {mlResult.symbol} — Next-Move Probability
                  </div>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart
                      layout="vertical"
                      data={[
                        { name: "UP",   value: Number(mlResult.up_prob) },
                        { name: "DOWN", value: 100 - Number(mlResult.up_prob) },
                      ]}
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: T.muted, fontWeight: 600 }} width={50} />
                      <Tooltip
                        contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                        formatter={v => [`${Number(v).toFixed(1)}%`, "Probability"]} />
                      <Bar dataKey="value" radius={[0,4,4,0]} barSize={26}>
                        <Cell fill={T.green} />
                        <Cell fill={T.red} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
                    Model ka andaza hai <strong style={{ color: sigColor(mlResult.signal) }}>{mlResult.signal}</strong> —
                    {" "}yani agle 2 din mein price <strong style={{ color: T.green }}>{Number(mlResult.up_prob).toFixed(1)}%</strong> chance
                    upar jaane ka aur <strong style={{ color: T.red }}>{(100 - Number(mlResult.up_prob)).toFixed(1)}%</strong> chance neeche/flat rehne ka.
                  </div>
                </div>
                </>
              )}

              {/* ── News + AI Sentiment (fetched alongside the prediction above) ── */}
              {newsError && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#450a0a", border: `1px solid ${T.red}`, fontSize: 12, color: T.red }}>
                  📰 {newsError}
                </div>
              )}

              {newsResult && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ background: T.card, borderRadius: 8, padding: "14px 16px", border: `1px solid ${T.border}`, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      🧭 Combined AI Outlook — Technicals + News
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                      {newsResult.combined_verdict}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      News sentiment score: <strong style={{ color: newsResult.news_sentiment_score > 20 ? T.green : newsResult.news_sentiment_score < -20 ? T.red : T.amber }}>
                        {newsResult.news_sentiment_score > 0 ? "+" : ""}{newsResult.news_sentiment_score}
                      </strong> ({newsResult.news_summary})
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    📰 Latest Headlines
                  </div>
                  {(newsResult.articles || []).length === 0 && (
                    <div style={{ fontSize: 12, color: T.muted }}>No recent headlines found.</div>
                  )}
                  {(newsResult.articles || []).map((a, i) => {
                    const sentColor =
                      a.sentiment === "Bullish" ? T.green :
                      a.sentiment === "Bearish" ? T.red   : T.muted;
                    const sentBg =
                      a.sentiment === "Bullish" ? "rgba(34,197,94,0.12)" :
                      a.sentiment === "Bearish" ? "rgba(239,68,68,0.12)" : "rgba(107,122,153,0.12)";

                    // ── NEW: per-article summary state/toggle ──
                    const sum    = articleSummaries[a.link];
                    const isOpen = !!expandedSummary[a.link];

                    return (
                      <div key={i} style={{ background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 6, overflow: "hidden" }}>
                        {/* Row: title + source + sentiment + source link + summary toggle */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {a.title}
                            </div>
                            <div style={{ fontSize: 11, color: T.muted }}>
                              {a.source || "News"}{a.published ? ` · ${a.published}` : ""}
                            </div>
                          </div>

                          <span style={{ ...s.badge, background: sentBg, color: sentColor, flexShrink: 0 }}>
                            {a.sentiment}
                          </span>

                          {/* NEW: link to the original source */}
                          <a href={a.link} target="_blank" rel="noopener noreferrer"
                            style={{ ...s.navItem, fontSize: 11, padding: "4px 10px", flexShrink: 0, textDecoration: "none" }}>
                            🔗 Source
                          </a>

                          {/* NEW: on-demand AI summary toggle */}
                          <button
                            onClick={() => toggleSummary(a.link)}
                            style={{ ...s.navItem, ...(isOpen ? s.navItemActive : {}), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>
                            📝 {isOpen ? "Hide" : "Summary"}
                          </button>
                        </div>

                        {/* NEW: expanded summary panel */}
                        {isOpen && (
                          <div style={{ padding: "0 12px 12px", fontSize: 12, color: T.muted, lineHeight: 1.6, borderTop: `1px solid ${T.border}` }}>
                            {sum?.loading && <div style={{ paddingTop: 10 }}>⏳ Summarizing article...</div>}
                            {sum?.error   && <div style={{ paddingTop: 10, color: T.red }}>⚠️ {sum.error}</div>}
                            {sum?.text    && (
                              <div style={{ paddingTop: 10 }}>
                                {sum.text}
                                {sum.resolvedUrl && (
                                  <div style={{ marginTop: 8 }}>
                                    <a href={sum.resolvedUrl} target="_blank" rel="noopener noreferrer"
                                      style={{ color: T.accent, fontSize: 11, textDecoration: "none" }}>
                                      🔗 Open full article →
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary Cards */}
            {!mlLoading && mlSignals.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  ["🟢 Strong Buy", mlBuy.length,    T.green, "HIGH confidence"],
                  ["🟡 Buy",        mlMedBuy.length, T.green, "MEDIUM confidence"],
                  ["⏸ Hold",        mlHold.length,   T.amber, "Wait & watch"],
                  ["🔴 Sell",       mlSell.length,   T.red,   "Bearish signal"],
                ].map(([label, count, col, sub]) => (
                  <div key={label} style={{ background: T.surface, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}`, borderTop: `3px solid ${col}` }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: col, lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading */}
            {mlLoading && (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                <div style={{ color: T.muted, fontSize: 14 }}>ML model running on 15 symbols...</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>Downloading data + running XGBoost predictions</div>
              </div>
            )}

            {/* Not scanned */}
            {!mlLoading && !mlScanned && (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
                <div style={{ color: T.muted, fontSize: 14 }}>Click "Re-scan Market" to run ML predictions</div>
              </div>
            )}

            {/* Table */}
            {!mlLoading && mlSignals.length > 0 && (
              <table style={s.table}>
                <thead><tr>
                  {["Symbol","Price","ML Signal","UP Prob","Confidence","Strength","Action"].map(h =>
                    <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {mlSignals.map(r => {
                    const prob   = parseFloat(r.up_prob) || 0;
                    const isBuy  = r.signal === "BUY";
                    const isSell = r.signal === "SELL";
                    const isHigh = r.confidence === "HIGH";
                    const isMed  = r.confidence === "MEDIUM";
                    const barCol = prob >= 65 ? T.green : prob >= 55 ? T.amber : T.muted;
                    return (
                      <tr key={r.symbol}>
                        <td style={{ ...s.td, fontWeight: 700, color: T.accent, fontFamily: "monospace", fontSize: 14 }}>{r.symbol}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>${Number(r.price).toFixed(2)}</td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, ...(isBuy ? s.badgeGreen : isSell ? s.badgeRed : s.badgeAmber) }}>
                            {r.signal}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontWeight: 700, color: barCol, fontSize: 14 }}>{prob.toFixed(1)}%</td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, ...(isHigh ? s.badgeGreen : isMed ? s.badgeAmber : s.badgeRed), fontSize: 11 }}>
                            {r.confidence}
                          </span>
                        </td>
                        <td style={{ ...s.td, minWidth: 130 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.border, overflow: "hidden" }}>
                              <div style={{ width: `${prob}%`, height: "100%", borderRadius: 3, background: barCol, transition: "width 0.4s ease" }} />
                            </div>
                            <span style={{ fontSize: 11, color: T.muted, minWidth: 28, textAlign: "right" }}>{prob.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={s.td}>
                          {isBuy  && isHigh ? <span style={{ color: T.green, fontWeight: 700 }}>🟢 Strong Buy</span>
                         : isBuy  && isMed  ? <span style={{ color: T.green             }}>🟢 Buy</span>
                         : isSell && isHigh ? <span style={{ color: T.red,   fontWeight: 700 }}>🔴 Strong Sell</span>
                         : isSell           ? <span style={{ color: T.red               }}>🔴 Sell</span>
                         :                   <span style={{ color: T.muted              }}>🟡 Hold</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Disclaimer */}
            {!mlLoading && mlSignals.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: T.muted, textAlign: "center", marginTop: 16 }}>
                  *This is for informational purposes only and not financial advice.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}