import { EXTRA_FEATURES, FEATURES } from "../data";

export default function Features() {
  return (
    <section className="features container" id="features">
      <div className="section-head">
        <h2>Built for serious volume.</h2>
        <p>Everything a professional desk needs, without the professional-desk paperwork.</p>
      </div>
      <div className="feature-grid">
        {[...FEATURES, ...EXTRA_FEATURES].map((f) => (
          <article key={f.title} className="feature gcard">
            <span className="feature-icon">
              <f.icon size={28} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
