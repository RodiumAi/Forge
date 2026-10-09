export default function Hero() {
  return (
    <section className="hero container">
      <div className="hero-copy">
        <p className="eyebrow">Trusted by 300+ product teams</p>
        <h1>Design, build and scale digital products that earn their keep.</h1>
        <p className="lede">
          Kovento is a fictional studio of strategists, designers and engineers
          who plug into your roadmap and ship measurable outcomes for
          software-driven companies.
        </p>
        <div className="hero-cta">
          <a className="btn btn-accent" href="#">Start a Project</a>
          <a className="btn btn-ghost" href="#services">Explore Services</a>
        </div>
      </div>
      <div className="hero-panel">
        <div className="stat-card big">
          <span className="stat-live">Live</span>
          <strong>+132%</strong>
          <p>Activation lift</p>
        </div>
        <div className="stat-card">
          <strong>9.8k</strong>
          <p>Weekly active users</p>
        </div>
        <div className="stat-card">
          <strong>3.1x</strong>
          <p>Average ROI in 6 months</p>
        </div>
      </div>
    </section>
  );
}
