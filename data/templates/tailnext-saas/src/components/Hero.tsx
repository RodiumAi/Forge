export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Release communication, solved</p>
        <h1>Ship product updates your users actually notice</h1>
        <p className="lead">
          Pulsedeck turns every release into a clear announcement, a targeted rollout and a
          measurable adoption curve — all from one calm dashboard.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#pricing">Start free trial</a>
          <a className="btn btn-ghost" href="#features">See how it works</a>
        </div>
      </div>
      <div className="hero-visual">
        <img
          className="hero-photo"
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=70"
          alt="Laptop displaying analytics charts on a desk"
        />
      </div>
    </section>
  );
}
