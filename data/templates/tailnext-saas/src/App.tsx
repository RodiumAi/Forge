export default function App() {
  return (
    <div>
      <header className="top"><strong className="brand">TailNext</strong><button className="btn" type="button">Download</button></header>
      <section className="hero">
        <div>
          <h1>Free template to start a website with Next.js + Tailwind CSS</h1>
          <p>Production-ready starter with best practices, SEO, accessibility, dark mode and great page speed.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">Get template</button>
            <button type="button" style={{border:"1px solid #cbd5e1",background:"#fff",borderRadius:".7rem",padding:".7rem 1.1rem"}}>Learn more</button>
          </div>
          <div className="logos">
            <img src="/02-nextjs-logo.ae3da0a5.png" alt="Next.js" />
            <img src="/03-react-logo.5b4225d7.png" alt="React" />
            <img src="/04-tailwind-css-logo.9014e37f.png" alt="Tailwind" />
            <img src="/05-typescript-logo.37adc0f3.png" alt="TypeScript" />
          </div>
        </div>
        <img src="/01-hero.f20b02ee.jpg" alt="Hero" />
      </section>
      <section className="section">
        <h2>What you get with TailNext</h2>
        <p className="muted">Seamless integration, ready components and excellent performance.</p>
        <div className="grid3" style={{marginTop:"1rem"}}>
          {["Next.js + Tailwind","Ready-to-use Components","Excellent Page Speed"].map((t) => (
            <article className="card" key={t}><h3>{t}</h3><p className="muted">Built for marketing sites, SaaS and blogs.</p></article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="grid3">
          <img src="/06-camera-front.bdbd1228.jpg" alt="" style={{width:"100%",borderRadius:"1rem"}} />
          <img src="/07-camera-back.0083b6e2.jpg" alt="" style={{width:"100%",borderRadius:"1rem"}} />
          <img src="/08-gas.f4f7ed48.jpg" alt="" style={{width:"100%",borderRadius:"1rem"}} />
        </div>
      </section>
      <section className="section">
        <h2>Prices for each plan</h2>
        <div className="price" style={{marginTop:"1rem"}}>
          <article><h3>basic</h3><strong style={{fontSize:"1.8rem"}}>$29</strong><p className="muted">per month</p></article>
          <article className="hot"><h3>standard</h3><strong style={{fontSize:"1.8rem"}}>$69</strong><p className="muted">per month</p></article>
          <article><h3>premium</h3><strong style={{fontSize:"1.8rem"}}>$199</strong><p className="muted">per month</p></article>
        </div>
      </section>
      <footer className="section" style={{paddingBottom:"3rem"}}>
        <h2>Get in Touch</h2>
        <p className="muted">tailnext@gmail.com · New York</p>
      </footer>
    </div>
  );
}
