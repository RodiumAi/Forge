export default function Hero() {
  return (
    <section className="hero container">
      <div className="hero-art">
        <img
          src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=70"
          alt="Analytics dashboard showing product metrics on a screen"
        />
      </div>
      <div className="hero-copy">
        <h1>Ship your startup site before lunch</h1>
        <p>
          Launchpath is a fictional starter kit for founders who want a marketing
          site that loads fast, reads well and grows with the product — without
          hiring a whole front-end team.
        </p>
        <div className="hero-cta">
          <a className="btn btn-dark" href="#">Get Started Free</a>
          <a className="btn btn-ghost" href="#">View on GitHub</a>
        </div>
      </div>
    </section>
  );
}
