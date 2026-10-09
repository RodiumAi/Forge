const plans = [
  {
    name: "Starter", price: "$19", period: "per month", featured: false,
    perks: ["1 product space", "Unlimited posts", "Email announcements", "Community support"],
    cta: "Start free trial",
  },
  {
    name: "Growth", price: "$49", period: "per month", featured: true,
    perks: ["5 product spaces", "Rollout targeting", "Slack + in-app widgets", "Adoption analytics", "Priority support"],
    cta: "Choose Growth",
  },
  {
    name: "Scale", price: "$129", period: "per month", featured: false,
    perks: ["Unlimited spaces", "Approval workflows", "SSO and audit log", "Dedicated manager"],
    cta: "Talk to sales",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="pricing">
      <h2>Simple pricing</h2>
      <p className="section-lead">Every plan starts with a 14-day free trial. No card required.</p>
      <div className="plan-grid">
        {plans.map((plan) => (
          <article key={plan.name} className={plan.featured ? "plan plan-featured" : "plan"}>
            {plan.featured && <span className="plan-badge">Most popular</span>}
            <h3>{plan.name}</h3>
            <p className="plan-price">
              {plan.price} <small>{plan.period}</small>
            </p>
            <ul>
              {plan.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
            <a className={plan.featured ? "btn btn-primary" : "btn btn-ghost"} href="#contact">
              {plan.cta}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
