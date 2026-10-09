import { useState } from "react";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Maker",
    price: "$0",
    period: "forever",
    features: ["3 active projects", "Community fab network", "DXF export", "Public gallery"],
    featured: false,
  },
  {
    name: "Studio",
    price: "$32",
    period: "per seat / month",
    features: ["Unlimited projects", "Geometry version control", "STEP + 3MF export", "Priority fabrication", "SSO"],
    featured: true,
  },
  {
    name: "Factory",
    price: "Custom",
    period: "annual",
    features: ["On-prem solver cluster", "PLM integrations", "Dedicated success engineer", "SLA 99.95%"],
    featured: false,
  },
];

export default function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="section section-alt" id="pricing">
      <div className="section-head">
        <h2 className="section-title">Pricing that unfolds with you</h2>
        <div className="billing-toggle" role="group" aria-label="Billing period">
          <button
            className={billing === "monthly" ? "on" : ""}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            className={billing === "yearly" ? "on" : ""}
            onClick={() => setBilling("yearly")}
          >
            Yearly −20%
          </button>
        </div>
      </div>
      <div className="plans">
        {plans.map((p) => (
          <div className={"plan" + (p.featured ? " featured" : "")} key={p.name}>
            {p.featured && <span className="plan-flag">Most popular</span>}
            <h3 className="plan-name">{p.name}</h3>
            <p className="plan-price">
              {p.name === "Studio" && billing === "yearly" ? "$25" : p.price}
              <span> {p.period}</span>
            </p>
            <ul className="plan-list">
              {p.features.map((f) => (
                <li key={f}><Check size={12} strokeWidth={2.5} /> {f}</li>
              ))}
            </ul>
            <a className={"btn btn-lg " + (p.featured ? "btn-solid" : "btn-ghost")} href="#top">
              {p.price === "Custom" ? "Talk to sales" : "Get started"}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
