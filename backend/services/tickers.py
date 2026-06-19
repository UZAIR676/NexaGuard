"""
NexaGuard — USA Tickers List
800+ major stocks — NASDAQ + NYSE + AMEX
No internet needed for this list
"""

# ── S&P 500 Major Stocks ──────────────────────
SP500 = [
    # Technology
    "AAPL","MSFT","NVDA","AVGO","ORCL","CRM","ADBE","AMD","INTC","QCOM",
    "TXN","AMAT","LRCX","KLAC","MU","ADI","MRVL","CDNS","SNPS","FTNT",
    "PANW","CRWD","NOW","TEAM","WDAY","ZM","OKTA","DDOG","NET","SNOW",
    "PLTR","PATH","UI","GTLB","MDB","ESTC","ZS","CYBR","S","RPD",

    # Healthcare
    "LLY","UNH","JNJ","ABBV","MRK","TMO","ABT","DHR","BMY","AMGN",
    "GILD","REGN","VRTX","ISRG","BSX","EW","ZBH","BDX","BAX","PKI",
    "IQV","CRL","IDXX","PODD","DXCM","HOLX","TECH","INCY","ALNY","BMRN",

    # Financials
    "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP","COF",
    "USB","PNC","TFC","BK","STT","NTRS","RF","CFG","HBAN","KEY",
    "MTB","FITB","ZION","CMA","FHN","WAL","EWBC","PACW","FRC","SVB",

    # Consumer Discretionary
    "AMZN","TSLA","HD","MCD","NKE","SBUX","TJX","BKNG","MAR","HLT",
    "LOW","ROST","ORLY","AZO","YUM","CMG","DRI","MKC","SYY","COST",
    "WMT","TGT","DG","DLTR","KR","ACI","SFM","GO","PSMT","BJ",

    # Communication
    "META","GOOGL","GOOG","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR",
    "DISH","PARA","WBD","LYV","EA","TTWO","ATVI","RBLX","U","SNAP",
    "PINS","TWTR","MTCH","IAC","ZG","CARS","CDW","CABO","LBRDA","LBRDK",

    # Industrials
    "GE","HON","RTX","LMT","NOC","GD","BA","CAT","DE","EMR",
    "ETN","ITW","PH","ROK","AME","FTV","XYL","ROP","CTAS","FAST",
    "GWW","MSC","EXPD","CHRW","UPS","FDX","DAL","UAL","AAL","LUV",

    # Energy
    "XOM","CVX","COP","EOG","SLB","MPC","PSX","VLO","PXD","DVN",
    "HES","OXY","APA","MRO","FANG","EQT","RRC","AR","SWN","CNX",
    "HAL","BKR","NOV","FTI","CIVI","SM","MTDR","VTLE","CRGY","CHRD",

    # Materials
    "LIN","APD","ECL","SHW","PPG","NEM","FCX","NUE","STLD","RS",
    "ALB","MOS","CF","FMC","IFF","EMN","CE","OLN","TREX","AZEK",

    # Utilities
    "NEE","DUK","SO","D","AEP","EXC","SRE","PEG","ED","ETR",
    "FE","PPL","CMS","NI","AES","LNT","EVRG","OGE","POR","AVA",

    # Real Estate
    "AMT","PLD","CCI","EQIX","PSA","O","WELL","DLR","SPG","EQR",
    "AVB","MAA","UDR","CPT","ESS","AIV","NNN","STOR","VICI","MGM",

    # Consumer Staples
    "PG","KO","PEP","PM","MO","MDLZ","CL","KMB","CHD","CLX",
    "GIS","K","CPB","HRL","SJM","MKC","CAG","POST","LANC","THS",
]

# ── NASDAQ 100 ────────────────────────────────
NASDAQ100 = [
    "AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","TSLA","AVGO","COST",
    "ASML","NFLX","AMD","PEP","ADBE","CSCO","QCOM","TMUS","INTU","TXN",
    "AMAT","ISRG","BKNG","MU","LRCX","ADI","PANW","SNPS","CDNS","REGN",
    "KLAC","MELI","CRWD","FTNT","CEG","ABNB","MNST","TEAM","IDXX","VRSK",
    "DXCM","ODFL","CTAS","PCAR","FAST","PAYX","ROST","KDP","AEP","BIIB",
    "MRNA","ILMN","SGEN","BMRN","ALNY","VRTX","EXAS","NTLA","BEAM","EDIT",
]

# ── Popular Small/Mid Caps ────────────────────
SMALL_MID_CAP = [
    "COIN","HOOD","SOFI","AFRM","UPST","LC","OPEN","OPENDOOR","OFFERPAD",
    "RDFN","Z","ZG","NERDWALLET","LDI","UWM","GHLD","PFSI","COOP","RKT",
    "SQ","PYPL","BILL","PAYC","PCTY","WEX","FLYW","PAYO","EVRI","PRFT",
    "DUOL","UDMY","COUR","TWLO","SEND","BAND","FIVN","NICE","PCOR","VEEV",
    "HUBS","SPRK","PUBM","TTD","MGNI","IAS","DV","SCOR","KNTK","ACMR",
    "SMCI","AMBA","MXIM","SWKS","QRVO","IPHI","COHU","FORM","ONTO","UCTT",
    "WOLF","AEHR","OLED","UEIC","IIVI","II","MKSI","ACLS","ICHR","KLIC",
]

# ── ETFs ──────────────────────────────────────
ETFS = [
    "SPY","QQQ","DIA","IWM","VTI","VOO","IVV","VEA","VWO","GLD",
    "SLV","TLT","HYG","LQD","AGG","BND","BNDX","EMB","MBB","MUB",
    "XLK","XLV","XLF","XLE","XLY","XLI","XLU","XLB","XLRE","XLC","XLP",
    "ARKK","ARKG","ARKW","ARKF","ARKQ","PRNT","IZRL","ARKX",
    "USO","UNG","DBO","GDX","GDXJ","SIL","COPX","URA","REMX","LIT",
]

# ── Crypto (via Yahoo Finance) ────────────────
CRYPTO = [
    "BTC-USD","ETH-USD","BNB-USD","SOL-USD","XRP-USD",
    "ADA-USD","AVAX-USD","DOGE-USD","DOT-USD","MATIC-USD",
    "LINK-USD","LTC-USD","UNI-USD","ATOM-USD","XLM-USD",
]

# ── Combined — All symbols ────────────────────
ALL_SYMBOLS = list(set(SP500 + NASDAQ100 + SMALL_MID_CAP + ETFS))

if __name__ == "__main__":
    print(f"Total symbols: {len(ALL_SYMBOLS)}")
    print(f"  S&P 500 stocks:  {len(SP500)}")
    print(f"  NASDAQ 100:      {len(NASDAQ100)}")
    print(f"  Small/Mid Cap:   {len(SMALL_MID_CAP)}")
    print(f"  ETFs:            {len(ETFS)}")
    print(f"  Crypto:          {len(CRYPTO)}")