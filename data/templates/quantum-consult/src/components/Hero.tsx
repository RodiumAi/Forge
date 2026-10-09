export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-grid">
        <div className="hero-main">
          <p className="rule-label">Strategy · Operations · Transactions</p>
          <h1>
            Advice that survives contact with the <span className="copper">balance sheet.</span>
          </h1>
          <p className="hero-sub">
            Quantum Partners advises boards and chief executives on decisions where the cost of
            being wrong is measured in billions. We are retained for judgment, not decks.
          </p>
          <div className="hero-actions">
            <a href="#contact" className="btn-solid">Engage the firm</a>
            <a href="#cases" className="btn-outline">Review our work</a>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-fact">
            <span className="hero-fact-num">27</span>
            <span className="hero-fact-label">markets served</span>
          </div>
          <div className="hero-fact">
            <span className="hero-fact-num">2015</span>
            <span className="hero-fact-label">firm founded</span>
          </div>
          <div className="hero-fact">
            <span className="hero-fact-num">6</span>
            <span className="hero-fact-label">global offices</span>
          </div>
        </div>
      </div>
    </section>
  );
}
