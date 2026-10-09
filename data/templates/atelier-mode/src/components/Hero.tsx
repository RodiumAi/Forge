export default function Hero() {
  return (
    <section className="hero">
      <img
        className="hero-img"
        src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=70"
        alt="Editorial fashion portrait"
      />
      <div className="hero-veil" />
      <div className="hero-copy">
        <p className="kicker">Automne — Hiver 2026</p>
        <h1>La Ligne Silencieuse</h1>
        <p className="hero-sub">Twenty-two looks cut in ivory, ink and bronze. Draped by hand in the Paris atelier.</p>
        <a href="#collection" className="btn-ghost">Discover the collection</a>
      </div>
    </section>
  );
}
