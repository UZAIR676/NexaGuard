import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { T, s } from "../theme";
import { api } from "../api";

export default function MarketData() {
  const [tab, setTab]               = useState("indices");
  const [indices, setIndices]       = useState([]);
  const [sectors, setSectors]       = useState([]);
  const [crypto, setCrypto]         = useState([]);
  const [movers, setMovers]         = useState({ top_gainers: [], top_losers: [] });
  const [history, setHistory]       = useState([]);
  const [selSym, setSelSym]         = useState("AAPL");
  const [selPeriod, setSelPeriod]   = useState("3mo");
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [mlSignals, setMlSignals]   = useState([]);
  const [mlLoading, setMlLoading]   = useState(false);
  const [mlScanned, setMlScanned]   = useState(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadHistory(selSym, selPeriod); }, [selSym, selPeriod]);

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
    try {
      const h = await api.history(sym, period);
      setHistory(h.data || []);
    } catch { }
  };

  const loadMLSignals = async () => {
    setMlLoading(true);
    try {
      const r = await fetch("http://localhost:8000/api/ml/scan");
      const data = await r.json();
      setMlSignals(Array.isArray(data) ? data : []);
      setMlScanned(true);
    } catch { }
    setMlLoading(false);
  };

  const doSearch = async () => {
    if (!search) return;
    try {
      const r = await api.search(search.toUpperCase());
      setSearchResult(r);
    } catch { }
  };

  const fmt = (p) => {
    if (!p && p !== 0) return "N/A";
    if (p >= 1e12) return `$${(p / 1e12).toFixed(2)}T`;
    if (p >= 1e9)  return `$${(p / 1e9).toFixed(2)}B`;
    if (p >= 1000) return `$${(p / 1000).toFixed(1)}K`;
    return `$${p.toFixed(2)}`;
  };

  const color = (v) => v > 0 ? T.green : T.red;
  const sign  = (v) => v > 0 ? "+" : "";

  const CHART_SYMS    = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META"];
  const CHART_PERIODS = [["1wk","1W"],["1mo","1M"],["3mo","3M"],["6mo","6M"],["1y","1Y"]];

  const mlBuy      = mlSignals.filter(r => r.signal === "BUY"  && r.confidence === "HIGH");
  const mlMedBuy   = mlSignals.filter(r => r.signal === "BUY"  && r.confidence !== "HIGH");
  const mlHold     = mlSignals.filter(r => r.signal === "HOLD");
  const mlSell     = mlSignals.filter(r => r.signal === "SELL");

  const TABS = [
    { id: "indices",    label: "📊 Indices"    },
    { id: "sectors",    label: "🏭 Sectors"    },
    { id: "crypto",     label: "₿ Crypto"      },
    { id: "gainers",    label: "📈 Gainers"    },
    { id: "losers",     label: "📉 Losers"     },
    { id: "ml signals", label: "🤖 ML Signals" },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={s.h2}>Market Data</div>
          <div style={s.muted}>Live USA market — real-time data from Yahoo Finance</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...s.input, width: 160, marginTop: 0, padding: "8px 12px" }}
            placeholder="Search: AAPL..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
          />
          <button onClick={doSearch}  style={{ ...s.navItem, ...s.navItemActive, padding: "8px 14px" }}>Search</button>
          <button onClick={loadAll}   style={{ ...s.navItem, ...s.navItemActive, padding: "8px 14px" }}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Search Result ── */}
      {searchResult && !searchResult.error && (
        <div style={{ ...s.card, marginBottom: 20, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{searchResult.symbol}</div>
            <div style={{ color: T.muted, fontSize: 13 }}>{searchResult.name}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.accent }}>{fmt(searchResult.price)}</div>
          <div style={{ ...s.badge, ...s.badgeAmber }}>{searchResult.sector}</div>
          <div style={{ color: T.muted, fontSize: 13 }}>Market Cap: <strong>{fmt(searchResult.market_cap)}</strong></div>
          <button onClick={() => setSearchResult(null)} style={{ ...s.navItem, marginLeft: "auto" }}>✕ Close</button>
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
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.h3}>{selSym}</div>
            <span style={{ ...s.badge, ...s.badgeGreen, fontSize: 10 }}>LIVE</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {CHART_SYMS.map(sym => (
                <button key={sym} onClick={() => setSelSym(sym)}
                  style={{ ...s.navItem, ...(selSym === sym ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
                  {sym}
                </button>
              ))}
            </div>
            <div style={{ width: 1, background: T.border }} />
            <div style={{ display: "flex", gap: 4 }}>
              {CHART_PERIODS.map(([val, label]) => (
                <button key={val} onClick={() => setSelPeriod(val)}
                  style={{ ...s.navItem, ...(selPeriod === val ? s.navItemActive : {}), fontSize: 11, padding: "3px 9px" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={T.accent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={T.accent} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }}
              tickFormatter={d => d?.slice(5,10)}
              interval={Math.floor(history.length / 6)} />
            <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: T.muted }}
              tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
              formatter={v => [`$${Number(v).toFixed(2)}`, selSym]}
              labelFormatter={l => l?.slice(0,10)} />
            <Area type="monotone" dataKey="close" stroke={T.accent} fill="url(#grad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
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
            <thead>
              <tr>{["Index","Price","Change","Change %","52W High","52W Low"].map(h =>
                <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
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
                <BarChart data={sectors.map(sec => ({
                  name: sec.sector?.split(" ")[0],
                  val:  sec.change_pct,
                }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`${v}%`, "Change"]} />
                  <Bar dataKey="val" radius={[4,4,0,0]}>
                    {sectors.map((sec, i) => (
                      <Cell key={i} fill={sec.change_pct >= 0 ? T.green : T.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table style={s.table}>
              <thead>
                <tr>{["Sector","ETF","Price","Change %","Signal"].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sectors.map(r => (
                  <tr key={r.symbol}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{r.sector}</td>
                    <td style={{ ...s.td, fontFamily: "monospace", color: T.accent }}>{r.symbol}</td>
                    <td style={s.td}>{fmt(r.price)}</td>
                    <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>
                      {sign(r.change_pct)}{r.change_pct}%
                    </td>
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
            <thead>
              <tr>{["Asset","Symbol","Price","Change %","Signal"].map(h =>
                <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {crypto.map(r => (
                <tr key={r.symbol}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ ...s.td, fontFamily: "monospace", color: T.amber }}>{r.symbol}</td>
                  <td style={{ ...s.td, fontWeight: 700 }}>{fmt(r.price)}</td>
                  <td style={{ ...s.td, color: color(r.change_pct), fontWeight: 600 }}>
                    {sign(r.change_pct)}{r.change_pct}%
                  </td>
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
            <thead>
              <tr>{["Symbol","Price","Change %","Signal"].map(h =>
                <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
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
            <thead>
              <tr>{["Symbol","Price","Change %","Signal"].map(h =>
                <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
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
            {/* ML Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  🤖 NexaGuard ML — Stock Signal Scanner
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  XGBoost model · 2-day forward return prediction · 16 technical features
                </div>
                <div style={{ fontSize: 11, color: T.amber, marginTop: 4 }}>
                  ⚠️ Model accuracy 53.3% — sirf HIGH confidence signals consider karein
                </div>
              </div>
              <button onClick={loadMLSignals}
                style={{ ...s.navItem, ...s.navItemActive, fontSize: 12, padding: "6px 14px" }}>
                ↻ Re-scan Market
              </button>
            </div>

            {/* Summary Cards */}
            {!mlLoading && mlSignals.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  ["🟢 Strong Buy", mlBuy.length,    T.green, "HIGH confidence BUY"],
                  ["🟡 Buy",        mlMedBuy.length, T.green, "MEDIUM confidence BUY"],
                  ["⏸ Hold",        mlHold.length,   T.amber, "Wait & watch"],
                  ["🔴 Sell",       mlSell.length,   T.red,   "Bearish signal"],
                ].map(([label, count, col, sub]) => (
                  <div key={label} style={{ background: T.surface, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}`, borderTop: `3px solid ${col}` }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
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

            {/* Not scanned yet */}
            {!mlLoading && !mlScanned && (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
                <div style={{ color: T.muted, fontSize: 14 }}>Click "Re-scan Market" to run ML predictions</div>
              </div>
            )}

            {/* Table */}
            {!mlLoading && mlSignals.length > 0 && (
              <table style={s.table}>
                <thead>
                  <tr>{["Symbol","Price","ML Signal","UP Prob","Confidence","Strength","Action"].map(h =>
                    <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
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
                        <td style={{ ...s.td, fontWeight: 700, color: T.accent, fontFamily: "monospace", fontSize: 14 }}>
                          {r.symbol}
                        </td>
                        <td style={{ ...s.td, fontWeight: 600 }}>
                          ${Number(r.price).toFixed(2)}
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, ...(isBuy ? s.badgeGreen : isSell ? s.badgeRed : s.badgeAmber) }}>
                            {r.signal}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontWeight: 700, color: barCol, fontSize: 14 }}>
                          {prob.toFixed(1)}%
                        </td>
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
                            <span style={{ fontSize: 11, color: T.muted, minWidth: 28, textAlign: "right" }}>
                              {prob.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td style={s.td}>
                          {isBuy  && isHigh ? <span style={{ color: T.green, fontWeight: 700, fontSize: 13 }}>🟢 Strong Buy</span>
                         : isBuy  && isMed  ? <span style={{ color: T.green, fontSize: 13             }}>🟢 Buy</span>
                         : isSell && isHigh ? <span style={{ color: T.red,   fontWeight: 700, fontSize: 13 }}>🔴 Strong Sell</span>
                         : isSell           ? <span style={{ color: T.red,   fontSize: 13             }}>🔴 Sell</span>
                         :                   <span style={{ color: T.muted,  fontSize: 13             }}>🟡 Hold</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Footer note */}
            {!mlLoading && mlSignals.length > 0 && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.muted }}>
                🛡️ <strong>Disclaimer:</strong> ML predictions are based on historical patterns. Not financial advice. 
                Model: XGBoost · Accuracy: 53.3% · Train data: 5 years · Features: 16 technical indicators.
                Improve accuracy: <code style={{ background: T.border, padding: "1px 5px", borderRadius: 3 }}>model hybrid</code>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}