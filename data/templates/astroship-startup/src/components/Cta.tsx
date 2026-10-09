export default function Cta() {
  return (
    <section className="cta container">
      <div className="cta-visual">
        <img
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=70"
          alt="Laptop displaying growth charts on a desk"
          loading="lazy"
        />
      </div>
      <div className="cta-box">
        <h2>Build faster. Launch sooner.</h2>
        <p>Spin up a polished marketing site today and iterate as your product finds its audience.</p>
        <a className="btn btn-light" href="#">Get Started</a>
      </div>
    </section>
  );
}
