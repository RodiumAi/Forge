import { useState } from "react";
import { Diamond, Star, Triangle } from "lucide-react";
import { VOLUME_BARS } from "../data";

export default function Hero() {
  const [tab, setTab] = useState<"spot" | "futures" | "earn">("spot");

  return (
    <section className="hero container">
      <div className="hero-copy">
        <span className="pill">
          <Diamond size={10} fill="currentColor" aria-hidden="true" /> Now live: EU MiCA-regulated entity
        </span>
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
          <span><Star className="inline-icon" size={11} fill="currentColor" aria-hidden="true" /> 4.8 on Trustpilot</span>
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
          <span className="pair-change up">
            <Triangle className="inline-icon" size={9} fill="currentColor" aria-hidden="true" /> +2.34%
          </span>
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
  );
}
