import { treatments } from "../data";

export default function Treatments() {
  return (
    <section className="treatments" id="treatments">
      <div className="sec-head">
        <p className="eyebrow">The Menu</p>
        <h2>Treatments, priced gently</h2>
        <p className="sec-sub">Every session includes steam-room access and unlimited daybed time after.</p>
      </div>
      <div className="treat-grid">
        {treatments.map((t) => (
          <article className="treat-card" key={t.name}>
            <span className="treat-icon">
              <t.icon size={22} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3>{t.name}</h3>
            <p>{t.desc}</p>
            <div className="treat-meta">
              <span className="treat-time">{t.duration}</span>
              <span className="treat-price">{t.price}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
