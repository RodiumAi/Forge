import { guides } from "../data";

export default function Guides() {
  return (
    <section className="section guides" id="guides">
      <div className="guides-band">
        <img
          src="https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=70"
          alt="Rope team crossing a glacier"
        />
        <div className="guides-band-veil" />
        <blockquote className="guides-quote">
          “A guide's job is not to make the mountain safe.
          It's to make your judgement better.”
          <cite>— Anders Vik, Expedition Director</cite>
        </blockquote>
      </div>
      <div className="section-head">
        <p className="eyebrow">The team</p>
        <h2 className="section-title">Guides you'd rope up with anywhere</h2>
      </div>
      <div className="guide-grid">
        {guides.map((g) => (
          <article className="guide-card" key={g.name}>
            <img className="guide-img" src={g.img} alt={g.name} />
            <div className="guide-body">
              <h3 className="guide-name">{g.name}</h3>
              <p className="guide-role">{g.role}</p>
              <p className="guide-creds">{g.creds}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
