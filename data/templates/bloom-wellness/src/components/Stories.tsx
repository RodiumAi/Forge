import { testimonials } from "../data";

export default function Stories() {
  return (
    <section className="stories" id="stories">
      <div className="sec-head">
        <p className="eyebrow">Guest stories</p>
        <h2>Quiet words from quiet people</h2>
      </div>
      <div className="story-grid">
        {testimonials.map((t) => (
          <blockquote className="story" key={t.name}>
            <p>“{t.quote}”</p>
            <footer>
              <strong>{t.name}</strong>
              <span>{t.detail}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
