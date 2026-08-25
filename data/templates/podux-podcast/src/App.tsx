export default function App() {
  const eps = [
    { img: "/02-podCast.webp", title: "How to ship secure websites", time: "23min" },
    { img: "/01-sidebiew.webp", title: "5 principles for clear code", time: "1h22" },
    { img: "/03-concentrated-young-african-american.webp", title: "Desktop development basics", time: "50min" },
    { img: "/02-podCast.webp", title: "Start your journey in SEO", time: "24min" },
  ];
  return (
    <div>
      <header className="top"><strong className="brand">Podux</strong><div style={{display:"flex",gap:".75rem"}}><button type="button" style={{background:"transparent",border:"1px solid #334155",color:"#fff",borderRadius:".7rem",padding:".65rem 1rem"}}>Sign in</button><button className="btn" type="button">Join Us</button></div></header>
      <section className="hero">
        <div>
          <p className="muted">New season available</p>
          <h1>Find and listen to your favorite podcast</h1>
          <p>Curated tech conversations for builders, designers and founders worldwide.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">Join us</button>
            <button type="button" style={{background:"#1e293b",border:0,color:"#fff",borderRadius:".7rem",padding:".7rem 1.1rem"}}>Listening Episode</button>
          </div>
          <div className="stats"><div><strong>300+</strong><div className="muted">Listeners</div></div><div><strong>45+</strong><div className="muted">Episodes</div></div></div>
        </div>
        <img src="/03-concentrated-young-african-american.webp" alt="Studio" />
      </section>
      <section className="section">
        <h2>Latest Podcast</h2>
        <div className="grid2" style={{marginTop:"1rem"}}>
          {eps.map((e) => (
            <article className="card" key={e.title + e.time}>
              <img src={e.img} alt="" />
              <div>
                <div className="muted" style={{fontSize:".8rem"}}>{e.time}</div>
                <h3 style={{margin:".25rem 0"}}>{e.title}</h3>
                <button className="btn" type="button" style={{padding:".45rem .8rem",fontSize:".85rem"}}>Play now</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <footer className="section" style={{paddingBottom:"3rem"}}>
        <h2>Subscribe for new episodes</h2>
        <p className="muted">Fresh drops every week for the tech community.</p>
      </footer>
    </div>
  );
}
