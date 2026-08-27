import { useState } from "react";

const TICKERS = [
  { sym: "BTC", name: "Bitcoin", price: "$97,412.50", change: "+2.34%", up: true, spark: [42, 48, 45, 52, 58, 55, 63, 68, 64, 72, 78, 82] },
  { sym: "ETH", name: "Ethereum", price: "$3,486.20", change: "+1.87%", up: true, spark: [55, 52, 58, 54, 60, 65, 62, 68, 66, 71, 69, 74] },
  { sym: "SOL", name: "Solana", price: "$212.84", change: "-0.92%", up: false, spark: [72, 68, 70, 64, 66, 60, 63, 58, 61, 55, 58, 52] },
  { sym: "AVAX", name: "Avalanche", price: "$41.16", change: "+4.61%", up: true, spark: [38, 42, 40, 48, 46, 54, 58, 55, 62, 68, 72, 79] },
];

const STATS = [
  { value: "$14.2B", label: "30-day trading volume" },
  { value: "3.8M", label: "verified traders" },
  { value: "0.02%", label: "maker fee, flat" },
  { value: "7ms", label: "median order execution" },
];

const FEATURES = [
  {
    icon: "📈",
    title: "Pro-grade execution",
    text: "Our matching engine clears 1.2M orders per second with 7ms median latency. Colocated nodes in Frankfurt, Tokyo and Virginia.",
  },
  {
    icon: "🌊",
    title: "Deep liquidity",
    text: "Aggregated books across 18 venues. BTC/USDT spread of 0.8bps on average — tighter than any single exchange.",
  },
  {
    icon: "🤖",
    title: "Automation API",
    text: "REST + WebSocket + FIX. Backtest strategies against 6 years of tick data, then deploy with one endpoint change.",
  },
  {
    icon: "💳",
    title: "Instant on-ramp",
    text: "Buy crypto with SEPA, ACH, cards and Apple Pay in 34 currencies. Funds tradeable in under 60 seconds.",
  },
];

const VOLUME_BARS = [34, 52, 41, 68, 55, 74, 62, 88, 71, 95, 83, 100];

const EXTRA_FEATURES = [
  {
    icon: "🧊",
    title: "Cold-storage vaults",
    text: "Withdraw straight to institutional-grade custody. Free vault transfers, 24h time-locked releases, no counterparty games.",
  },
  {
    icon: "📱",
    title: "One app, every market",
    text: "Spot, perpetuals, options and staking in a single portfolio view. Rated 4.8 across 210k App Store reviews.",
  },
];

const SECURITY = [
  { icon: "🛡", title: "95% cold storage", text: "Client assets held in geographically distributed, air-gapped vaults with multi-party computation signing." },
  { icon: "🏛", title: "Regulated & audited", text: "Licensed under MiCA (EU) and registered with FinCEN. Quarterly proof-of-reserves attested by Hartmann LLP." },
  { icon: "🔒", title: "$500M insurance", text: "Custodial assets covered against theft and infrastructure failure through a syndicate led by Lloyd's of London." },
  { icon: "👁", title: "Real-time monitoring", text: "ML-driven anomaly detection reviews every withdrawal. Suspicious flows frozen in under 300ms." },
];

export default function App() {
  const [tab, setTab] = useState<"spot" | "futures" | "earn">("spot");

  return (
    <div className="page">
      <div className="glow glow-top" aria-hidden="true" />
      <div className="glow glow-mid" aria-hidden="true" />

      <div className="ticker-bar">
        <div className="ticker-track">
          {[...TICKERS, ...TICKERS, ...TICKERS].map((t, i) => (
            <span key={i} className="ticker-chip">
              <strong>{t.sym}</strong> {t.price}
              <em className={t.up ? "up" : "down"}>{t.change}</em>
            </span>
          ))}
        </div>
      </div>

      <header className="nav">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 4l9 16L21 4h-5l-4 8-4-8H3z" fill="#00e5a0" />
            </svg>
            VERTEX
          </a>
          <nav className="nav-links">
            <a href="#markets">Markets</a>
            <a href="#features">Trade</a>
            <a href="#security">Security</a>
            <a href="#top">Institutional</a>
            <a href="#top">Learn</a>
          </nav>
          <div className="nav-actions">
            <a className="btn btn-ghost" href="#top">Log in</a>
            <a className="btn btn-neon" href="#cta">Get started</a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy">
            <span className="pill">◆ Now live: EU MiCA-regulated entity</span>
            <h1>
              Trade crypto at the
              <br />
              <span className="neon-text">speed of thought.</span>
            </h1>
            <p className="lede">
              Vertex is the exchange built for people who take markets seriously. 280+ pairs,
              7ms execution, industry-lowest fees — with the security posture of a Swiss bank.
            </p>
            <div className="hero-cta">
              <a className="btn btn-neon btn-lg" href="#cta">Create free account</a>
              <a className="btn btn-outline btn-lg" href="#markets">View markets</a>
            </div>
            <div className="trust-row">
              <span>★ 4.8 on Trustpilot</span>
              <span>·</span>
              <span>3.8M traders</span>
              <span>·</span>
              <span>Proof-of-reserves audited</span>
            </div>
          </div>

          <div className="hero-panel gcard">
            <div className="panel-tabs">
              {(["spot", "futures", "earn"] as const).map((t) => (
                <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="panel-pair">
              <div>
                <span className="pair-name">BTC / USDT</span>
                <span className="pair-price">$97,412.50</span>
              </div>
              <span className="pair-change up">▲ +2.34%</span>
            </div>
            <div className="chart">
              {VOLUME_BARS.map((h, i) => (
                <span
                  key={i}
                  className={`bar ${i % 3 === 2 ? "bar-dim" : ""}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="panel-row">
              <span>24h High <strong>$98,105</strong></span>
              <span>24h Low <strong>$94,880</strong></span>
              <span>24h Vol <strong>$2.41B</strong></span>
            </div>
            <a className="btn btn-neon btn-block" href="#cta">
              {tab === "spot" ? "Buy BTC" : tab === "futures" ? "Open position" : "Stake & earn 5.2% APY"}
            </a>
          </div>
        </section>

        <section className="stats container">
          {STATS.map((s) => (
            <div key={s.label} className="stat gcard">
              <span className="stat-value neon-text">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        <section className="markets container" id="markets">
          <div className="section-head">
            <h2>Markets that never sleep. Neither do we.</h2>
            <p>Live pricing across 280+ pairs. These four moved the most in the last 24 hours.</p>
          </div>
          <div className="market-grid">
            {TICKERS.map((t) => (
              <article key={t.sym} className="market-card gcard">
                <div className="market-head">
                  <div>
                    <span className="market-sym">{t.sym}</span>
                    <span className="market-name">{t.name}</span>
                  </div>
                  <span className={`market-change ${t.up ? "up" : "down"}`}>{t.change}</span>
                </div>
                <span className="market-price">{t.price}</span>
                <div className="spark">
                  {t.spark.map((v, i) => (
                    <span
                      key={i}
                      className={`spark-bar ${t.up ? "spark-up" : "spark-down"}`}
                      style={{ height: `${v}%` }}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="features container" id="features">
          <div className="section-head">
            <h2>Built for serious volume.</h2>
            <p>Everything a professional desk needs, without the professional-desk paperwork.</p>
          </div>
          <div className="feature-grid">
            {[...FEATURES, ...EXTRA_FEATURES].map((f) => (
              <article key={f.title} className="feature gcard">
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="security container" id="security">
          <div className="security-media gcard">
            <img
              src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=70"
              alt="Security infrastructure"
            />
            <div className="security-badge gcard">
              <strong>$0</strong>
              <span>lost to breaches since 2019</span>
            </div>
          </div>
          <div className="security-copy">
            <span className="pill">Security</span>
            <h2>Your keys, our paranoia.</h2>
            <div className="security-list">
              {SECURITY.map((s) => (
                <div key={s.title} className="security-item">
                  <span className="security-icon">{s.icon}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cta container" id="cta">
          <div className="cta-panel gcard">
            <h2>
              Start trading in <span className="neon-text">under 3 minutes.</span>
            </h2>
            <p>Sign up, verify, deposit. Zero fees on your first $10,000 in volume.</p>
            <div className="hero-cta cta-center">
              <a className="btn btn-neon btn-lg" href="#top">Create free account</a>
              <a className="btn btn-outline btn-lg" href="#top">Talk to institutional sales</a>
            </div>
            <p className="cta-fine">
              Crypto assets are volatile. Trade responsibly. Vertex Europe UAB is authorised under MiCA.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <a className="brand" href="#top">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 4l9 16L21 4h-5l-4 8-4-8H3z" fill="#00e5a0" />
              </svg>
              VERTEX
            </a>
            <p className="footer-blurb">
              The exchange for serious traders. Vilnius · Frankfurt · Singapore.
            </p>
          </div>
          <div className="footer-cols">
            <div>
              <h4>Products</h4>
              <a href="#markets">Spot</a>
              <a href="#markets">Futures</a>
              <a href="#markets">Earn</a>
              <a href="#top">API</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#top">About</a>
              <a href="#top">Careers</a>
              <a href="#top">Press</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="#top">Terms</a>
              <a href="#top">Privacy</a>
              <a href="#top">Proof of reserves</a>
            </div>
          </div>
        </div>
        <div className="container footer-base">
          <span>© 2026 Vertex Europe UAB. All rights reserved.</span>
          <span>Not investment advice.</span>
        </div>
      </footer>
    </div>
  );
}
