export default function App() {
  const works = [
    { img: "/02-photo-1551650975-87deedd944c3.jpg", title: "Novu — SaaS Dashboard", tags: "SaaS · Figma · Tailwind" },
    { img: "/03-photo-1460925895917-afdab827c52f.jpg", title: "Finlo — Fintech App", tags: "Fintech · Landing" },
    { img: "/04-photo-1618005182384-a83a8bd57fbe.jpg", title: "Orea — Creative Agency", tags: "Agency · Animation" },
  ];
  return (
    <div>
      <header className="top">
        <strong className="brand">eliott</strong>
        <nav className="nav"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
        <button className="btn" type="button">Hire me</button>
      </header>
      <section className="hero">
        <div>
          <span className="badge"><span className="dot" />Available for work</span>
          <h1>Hi, I'm Eliott</h1>
          <p>Freelance UI/UX Designer &amp; Frontend Developer. I design and build digital products people love — fast, clean, accessible.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">View my work</button>
            <button type="button" style={{background:"transparent",border:"1px solid #333",color:"#fff",borderRadius:999,padding:".65rem 1rem"}}>Get in touch</button>
          </div>
          <div className="stats">
            <div><strong>34+</strong><span className="muted">Projects</span></div>
            <div><strong>21+</strong><span className="muted">Clients</span></div>
            <div><strong>5y</strong><span className="muted">Experience</span></div>
          </div>
        </div>
        <img src="/01-photo-1507003211169-0a1dd7228f2d.jpg" alt="Eliott" />
      </section>
      <section className="section" id="work">
        <p className="muted">Portfolio</p>
        <h2>Selected work</h2>
        <div className="grid3" style={{marginTop:"1rem"}}>
          {works.map((w) => (
            <article className="card" key={w.title}>
              <img src={w.img} alt={w.title} />
              <div className="body">
                <div className="muted" style={{fontSize:".8rem"}}>{w.tags}</div>
                <h3 style={{margin:".35rem 0"}}>{w.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section" id="about">
        <p className="muted">About me</p>
        <h2>A bit about who I am</h2>
        <p className="muted" style={{maxWidth:"40rem"}}>Based in Paris with 5 years shipping products for startups and agencies across Europe. Great interfaces get out of the way.</p>
      </section>
      <footer className="section" id="contact" style={{paddingBottom:"3rem"}}>
        <h2>Let's work together</h2>
        <p className="muted">hello@eliott.dev</p>
      </footer>
    </div>
  );
}
