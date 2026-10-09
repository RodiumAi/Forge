export default function Hero() {
  return (
    <section className="hero">
      <div className="avatar">
        <img
          src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=70"
          alt="Portrait of Mira Solano"
        />
      </div>
      <h1>Hi, I&apos;m Mira Solano</h1>
      <p className="hero-sub">
        I build calm, dependable software for teams that ship every week.
        Currently deep in platform engineering, developer tooling and the
        occasional data visualization rabbit hole.
      </p>
      <div className="hero-links">
        <a href="#projects" className="btn btn--solid">See my work</a>
        <a href="#blogs" className="btn btn--ghost">Read the blog</a>
      </div>
    </section>
  );
}
