import { Check } from "lucide-react";

const stats = [
  { value: "340+", label: "Projects shipped" },
  { value: "11 yrs", label: "In the field" },
  { value: "94%", label: "Client retention" },
  { value: "28", label: "Countries served" },
];

export default function Why() {
  return (
    <section className="why container">
      <div className="why-art">
        <img
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=70"
          alt="Modern studio office where the Kovento team works"
        />
        <div className="why-badge">Top Rated Studio<br />2026</div>
      </div>
      <div className="why-copy">
        <p className="eyebrow">Why Kovento</p>
        <h2>A senior crew, embedded in your workflow</h2>
        <p className="lede">
          No handoffs into the void. Our people work inside your tools every day,
          like teammates you did not have to recruit.
        </p>
        <ul className="why-list">
          <li><Check className="why-check" size={16} strokeWidth={3} aria-hidden="true" /><strong>Senior specialists only</strong> — the people you meet are the people who build.</li>
          <li><Check className="why-check" size={16} strokeWidth={3} aria-hidden="true" /><strong>Open weekly cadences</strong> with shared boards and live demos.</li>
          <li><Check className="why-check" size={16} strokeWidth={3} aria-hidden="true" /><strong>Flexible engagements</strong> — project, retainer or team extension.</li>
        </ul>
        <div className="stats-row">
          {stats.map((s) => (
            <div key={s.label}><strong>{s.value}</strong><span>{s.label}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
