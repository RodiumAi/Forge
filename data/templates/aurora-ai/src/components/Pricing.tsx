import { useState } from "react";
import { Check } from "lucide-react";

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    blurb: "For side projects and evaluation.",
    features: ["10k model calls / month", "2 workflows", "Community support", "Shared infrastructure"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Scale",
    price: "$249",
    period: "/mo",
    blurb: "For teams shipping AI to production.",
    features: ["1M model calls / month", "Unlimited workflows", "Eval suite + regression alerts", "Priority routing (p99 < 1.2s)", "Slack support, 4h SLA"],
    cta: "Start 14-day trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "For regulated and high-volume workloads.",
    features: ["Unlimited volume", "VPC / on-prem deployment", "Zero data retention", "Dedicated solutions engineer", "99.99% uptime SLA"],
    cta: "Talk to sales",
    featured: false,
  },
];

export default function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="pricing container" id="pricing">
      <div className="section-head">
        <span className="pill">Pricing</span>
        <h2>Simple pricing. Serious infrastructure.</h2>
        <div className="billing-toggle glass">
          <button
            className={billing === "monthly" ? "active" : ""}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            className={billing === "yearly" ? "active" : ""}
            onClick={() => setBilling("yearly")}
          >
            Yearly <em>−20%</em>
          </button>
        </div>
      </div>
      <div className="tier-grid">
        {TIERS.map((t) => (
          <article key={t.name} className={`tier glass ${t.featured ? "tier-featured" : ""}`}>
            {t.featured && <span className="tier-badge">Most popular</span>}
            <h3>{t.name}</h3>
            <p className="tier-blurb">{t.blurb}</p>
            <div className="tier-price">
              <span className="tier-amount">
                {t.name === "Scale" && billing === "yearly" ? "$199" : t.price}
              </span>
              <span className="tier-period">{t.period}</span>
            </div>
            <ul>
              {t.features.map((f) => (
                <li key={f}>
                  <span className="check">
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  </span>{" "}
                  {f}
                </li>
              ))}
            </ul>
            <a className={`btn ${t.featured ? "btn-primary" : "btn-glass"} btn-block`} href="#top">
              {t.cta}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
