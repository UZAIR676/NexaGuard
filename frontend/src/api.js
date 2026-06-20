const BASE = "http://localhost:8000";

const get = async (url) => {
  const r = await fetch(BASE + url);
  return r.json();
};

export const api = {
  // Market
  indices:   () => get("/api/market/indices"),
  sectors:   () => get("/api/market/sectors"),
  movers:    (market = "sp500") => get(`/api/market/movers?market=${market}&top=10`),
  crypto:    () => get("/api/market/crypto"),
  etfs:      () => get("/api/market/etfs"),
  summary:   () => get("/api/market/summary"),
  stock:     (sym) => get(`/api/stock/${sym}`),
  history:   (sym, period = "1mo") => get(`/api/stock/${encodeURIComponent(sym)}/history?period=${period}`),
  fundamentals: (sym) => get(`/api/stock/${sym}/fundamentals`),
  batch:     (syms) => get(`/api/stocks/batch?symbols=${syms.join(",")}`),
  search:    (q) => get(`/api/search/${q}`),

  // Fraud
  detectFraud: async (payload) => {
    const r = await fetch(BASE + "/api/fraud/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  },
  fraudStats:  () => get("/api/fraud/stats"),
  fraudRecent: (limit = 10) => get(`/api/fraud/recent?limit=${limit}`),
  fraudAlerts: (limit = 10) => get(`/api/fraud/alerts?limit=${limit}`),
};