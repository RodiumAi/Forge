export default function App() {
  return (
    <div>
      <header className="top"><strong className="brand">Play</strong><div style={{display:"flex",gap:".6rem"}}><button type="button" style={{background:"transparent",border:"1px solid #d1d5db",borderRadius:".55rem",padding:".6rem 1rem"}}>Sign In</button><button className="btn" type="button">Sign Up</button></div></header>
      <section className="hero">
        <div>
          <h1>Free template and starter for SaaS, Startup and App sites</h1>
          <p>Open-source Astro-inspired layout with essential pages, sections, components and a fully-functional blog feel.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">Download Now</button>
            <button type="button" style={{background:"#111827",color:"#fff",border:0,borderRadius:".55rem",padding:".7rem 1.1rem"}}>Star on Github</button>
          </div>
        </div>
        <img src="/01-hero-image.jpg" alt="Hero" />
      </section>
      <section className="section">
        <h2>Main Features Of Play</h2>
        <div className="grid4" style={{marginTop:"1rem"}}>
          {["Free and Open-Source","Multipurpose Template","High-quality Design","All Essential Elements"].map((t) => (
            <article className="card" key={t}><h3>{t}</h3><p className="muted">Everything you need to launch faster.</p></article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="grid3">
          <img src="/02-about-image-01.jpg" alt="" />
          <img src="/03-about-image-02.jpg" alt="" />
          <div className="card"><h3>09+ Years of experience</h3><p className="muted">Toolkit to build next-gen websites faster.</p></div>
        </div>
      </section>
      <section className="section">
        <h2>Awesome Pricing Plan</h2>
        <div className="price" style={{marginTop:"1rem"}}>
          <article><h3>Starter</h3><strong style={{fontSize:"1.8rem"}}>$25</strong><p className="muted">Per Month</p></article>
          <article className="hot"><h3>Basic</h3><strong style={{fontSize:"1.8rem"}}>$59</strong><p className="muted">Per Month</p></article>
          <article><h3>Premium</h3><strong style={{fontSize:"1.8rem"}}>$99</strong><p className="muted">Per Month</p></article>
        </div>
      </section>
      <section className="section">
        <h2>Our Creative Team</h2>
        <div className="grid4 team" style={{marginTop:"1rem"}}>
          {[
            ["/07-team-01.png","Matheus Ferrero"],
            ["/08-team-02.png","Stuard Ferrel"],
            ["/09-team-03.png","Eva Hudson"],
            ["/10-team-04.png","Jackie Sanders"],
          ].map(([img, name]) => (
            <article key={name}><img src={img} alt={name} /><h3 style={{fontSize:"1rem"}}>{name}</h3></article>
          ))}
        </div>
      </section>
      <section className="section blog" style={{paddingBottom:"3rem"}}>
        <h2>Our Recent News</h2>
        <div className="grid3" style={{marginTop:"1rem"}}>
          {[
            ["/11-blog-01.jpg","Upselling guide"],
            ["/12-blog-02.jpg","Wellness coaching"],
            ["/13-blog-03.jpg","AutoManage tools"],
          ].map(([img, title]) => (
            <article key={title}><img src={img} alt={title} /><h3 style={{fontSize:"1rem"}}>{title}</h3></article>
          ))}
        </div>
      </section>
    </div>
  );
}
