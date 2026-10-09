import { ALBUMS } from "../data";

export default function Albums() {
  return (
    <section className="albums" id="music">
      <h2 className="section-title">
        <span className="title-line" />DISCOGRAPHY<span className="title-line" />
      </h2>
      <div className="album-grid">
        {ALBUMS.map((a) => (
          <article key={a.title} className="album">
            <div className="album-stack">
              <div className="vinyl" aria-hidden="true">
                <div className="vinyl-label" />
              </div>
              <div className="album-cover">
                <img src={a.img} alt={a.title} />
                <span className="album-year">{a.year}</span>
              </div>
            </div>
            <h3>{a.title}</h3>
            <p className="album-type">{a.type}</p>
            <p className="album-note">{a.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
