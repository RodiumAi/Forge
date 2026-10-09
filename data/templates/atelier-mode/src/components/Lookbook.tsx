import { lookbook } from "../data";

export default function Lookbook() {
  return (
    <section className="lookbook" id="lookbook">
      <div className="section-head">
        <p className="kicker">Lookbook</p>
        <h2>The Season, Framed</h2>
      </div>
      <div className="look-grid">
        {lookbook.map((look, i) => (
          <figure className={`look look-${i + 1}`} key={look.title}>
            <img src={look.img} alt={look.title} loading="lazy" />
            <figcaption>
              <span className="look-title">{look.title}</span>
              <span className="look-note">{look.note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
