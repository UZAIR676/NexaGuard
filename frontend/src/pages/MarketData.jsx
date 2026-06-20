import { useState, useEffect } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { T, s } from "../theme";
import { api } from "../api";

export default function MarketData() {
  const [tab, setTab] = useState("indices");
  const [indices, setIndices] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [crypto, setCrypto] = useState([]);
  const [movers, setMovers] = useState({ top_gainers: [], top_losers: [] });
  const [history, setHistory] = useState([]);
  const [selSym, setSelSym] = useState("AAPL");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadHistory(selSym); }, [selSym]);

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
    } catch { console.log("Backend offline") }
    setLoading(false);
  };

  const loadHistory = async (sym) => {
    try {
      const h = await api.history(sym, "3mo");
      setHistory(h.data || []);
    } catch { }
  };

  const doSearch = async () => {
    if (!search) return;
    try {
      const r = await api.search(search.toUpperCase());
      setSearchResult(r);
    } catch { }
  };

  const fmt = (p) => {
    if (!p) return "N/A";
    if (p >= 1000000000000) return `$${(p / 1e12).toFixed(2)}T`;
    if (p >= 1000000000) return `$${(p / 1e9).toFixed(2)}B`;
    if (p >= 1000) return `$${(p / 1000).toFixed(1)}K`;
    return `$${p.toFixed(2)}`;
  };

  const color = (v) => v > 0 ? T.green : T.red;
  const sign = (v) => v > 0 ? "+" : "";

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={s.h2}>Market Data</div>
          <div style={s.muted}>Live USA market — real-time data from Yahoo Finance</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...s.input, width: 160, marginTop: 0, padding: "8px 12px" }}
            placeholder="Search: AAPL..."
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()} />
          <button onClick={doSearch} style={{ ...s.navItem, ...s.navItemActive, padding: "8px 14px" }}>Search</button>
          <button onClick={loadAll} style={{ ...s.navItem, ...s.navItemActive, padding: "8px 14px" }}>↻ Refresh</button>
        </div>
      </div>

      {/* Search result */}
      {searchResult && !searchResult.error && (
        <div style={{ ...s.card, marginBottom: 20, display: "flex", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{searchResult.symbol}</div>
            <div style={{ color: T.muted, fontSize: 13 }}>{searchResult.name}</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(searchResult.price)}</div>
          <div style={{ color: T.muted }}>{searchResult.sector}</div>
          <div style={{ color: T.muted }}>Market Cap: {fmt(searchResult.market_cap)}</div>
          <button onClick={() => setSearchResult(null)} style={{ ...s.navItem, marginLeft: "auto" }}>✕</button>
        </div>
      )}

      {/* Indices cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
        {loading ? ["S&P 500", "NASDAQ", "DOW", "RUSSELL", "VIX", "NYSE"].map(n => (
          <div key={n} style={{ ...s.statCard, padding: 14 }}>
            <div style={s.statLabel}>{n}</div>
            <div style={{ color: T.muted, fontSize: 13 }}>Loading...</div>
          </div>
        )) : indices.map(idx => (
          <div key={idx.name} style={{ ...s.statCard, padding: 14 }}>
            <div style={s.statLabel}>{idx.name}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(idx.price)}</div>
            <div style={{ fontSize: 12, color: color(idx.change_pct), marginTop: 2 }}>
              {sign(idx.change_pct)}{idx.change_pct}%
            </div>
          </div>
        ))}
      </div>

      {/* Stock chart */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={s.h3}>{selSym} — 3 Month Price Chart</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"].map(sym => (
              <button key={sym} onClick={() => setSelSym(sym)}
                style={{ ...s.navItem, ...(selSym === sym ? s.navItemActive : {}), fontSize: 12, padding: "4px 10px" }}>
                {sym}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.accent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }} tickFormatter={d => d?.slice(5, 10)} interval={Math.floor(history.length / 6)} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`$${v}`, selSym]} labelFormatter={l => l?.slice(0, 10)} />
            <Area type="monotone" dataKey="close" stroke={T.accent} fill="url(#grad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["indices", "sectors", "crypto", "gainers", "losers"].map(t => (
          <button key={t} style={{ ...s.navItem, ...(tab === t ? s.navItemActive : {}), textTransform: "capitalize" }}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={s.card}>
        {/* Indices tab */}
        {tab === "indices" && (
          <table style={s.table}>
            <thead><tr>{["Index", "Price", "Change", "Change %", "52W High", "52W Low"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {indices.map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{fmt(r.price)}</td>
                  <td style={{ ...s.td, color: color(r.change), fontWeight: 600 }}>{sign(r.change)}{r.change}</td>
                  <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>{sign(r.change_pct)}{r.change_pct}%</td>
                  <td style={s.td}>{fmt(r["52w_high"])}</td>
                  <td style={s.td}>{fmt(r["52w_low"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Sectors tab */}
        {tab === "sectors" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sectors.map(s => ({ name: s.sector?.split(" ")[0], val: s.change_pct, fill: s.change_pct > 0 ? T.green : T.red }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => [`${v}%`, "Change"]} />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]}
                    fill={T.green}
                    label={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table style={s.table}>
              <thead><tr>{["Sector", "ETF", "Price", "Change %", "Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
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

        {/* Crypto tab */}
        {tab === "crypto" && (
          <table style={s.table}>
            <thead><tr>{["Asset", "Symbol", "Price", "Change", "Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {crypto.map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ ...s.td, fontFamily: "monospace", color: T.amber }}>{r.symbol}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{fmt(r.price)}</td>
                  <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>{sign(r.change_pct)}{r.change_pct}%</td>
                  <td style={s.td}><span style={{ ...s.badge, ...(r.signal?.includes("BUY") ? s.badgeGreen : r.signal === "HOLD" ? s.badgeAmber : s.badgeRed) }}>{r.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Gainers tab */}
        {tab === "gainers" && (
          <table style={s.table}>
            <thead><tr>{["Symbol", "Price", "Change %", "Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(movers.top_gainers || []).map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600, color: T.accent }}>{r.symbol}</td>
                  <td style={s.td}>${r.price}</td>
                  <td style={{ ...s.td, color: T.green, fontWeight: 600 }}>+{r.change_pct}%</td>
                  <td style={s.td}><span style={{ ...s.badge, ...s.badgeGreen }}>{r.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Losers tab */}
        {tab === "losers" && (
          <table style={s.table}>
            <thead><tr>{["Symbol", "Price", "Change %", "Signal"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(movers.top_losers || []).map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600, color: T.accent }}>{r.symbol}</td>
                  <td style={s.td}>${r.price}</td>
                  <td style={{ ...s.td, color: T.red, fontWeight: 600 }}>{r.change_pct}%</td>
                  <td style={s.td}><span style={{ ...s.badge, ...s.badgeRed }}>{r.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
