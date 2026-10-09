import { MoveRight, Play } from "lucide-react";

const plans = [
  {
    name: "OFF-PEAK",
    price: "$59",
    features: ["Access 10am–4pm", "All open-gym zones", "Locker + towel", "App tracking"],
    featured: false,
  },
  {
    name: "ALL-IN",
    price: "$99",
    features: ["24/7 access", "Unlimited classes", "Quarterly testing day", "Guest pass monthly", "Recovery zone"],
    featured: true,
  },
  {
    name: "COACHED",
    price: "$219",
    features: ["Everything in ALL-IN", "2x weekly PT sessions", "Custom programming", "Nutrition check-ins"],
    featured: false,
  },
];

export default function Plans() {
  return (
    <section className="section" id="plans">
      <div className="section-head">
        <h2 className="section-title">MEMBERSHIP.<br /><span className="lime">NO CONTRACTS.</span></h2>
        <p className="section-sub">
          Month to month, cancel anytime in the app. We keep members with results, not paperwork.
        </p>
      </div>
      <div className="plan-grid">
        {plans.map((p) => (
          <div className={"plan" + (p.featured ? " featured" : "")} key={p.name}>
            {p.featured && <span className="plan-flag">MOST PICKED</span>}
            <h3 className="plan-name">{p.name}</h3>
            <p className="plan-price">
              {p.price}
              <span>/mo</span>
            </p>
            <ul className="plan-list">
              {p.features.map((f) => (
                <li key={f}><Play size={9} strokeWidth={0} fill="currentColor" /> {f}</li>
              ))}
            </ul>
            <a className={"btn " + (p.featured ? "btn-lime" : "btn-out")} href="#top">
              {p.featured ? (
                <>
                  START TRIAL <MoveRight size={16} strokeWidth={2.25} />
                </>
              ) : (
                "CHOOSE PLAN"
              )}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
