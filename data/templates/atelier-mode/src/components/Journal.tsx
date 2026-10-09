import { journal } from "../data";

export default function Journal() {
  return (
    <section className="journal">
      <div className="section-head">
        <p className="kicker">Journal</p>
        <h2>Notes from the Atelier</h2>
      </div>
      <div className="journal-grid">
        {journal.map((j) => (
          <article className="journal-card" key={j.title}>
            <p className="journal-date">{j.date}</p>
            <h3>{j.title}</h3>
            <p className="journal-excerpt">{j.excerpt}</p>
            <a href="#heritage" className="btn-line">Read the note</a>
          </article>
        ))}
      </div>
    </section>
  );
}
