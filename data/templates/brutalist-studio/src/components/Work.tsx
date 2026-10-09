const PROJECTS = [
  {
    title: "MOSHPIT ENERGY",
    tag: "Brand + Packaging",
    year: "2026",
    img: "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=70",
    stat: "+312% shelf pickup",
  },
  {
    title: "TANGERINE BANK",
    tag: "Web + Motion",
    year: "2025",
    img: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=70",
    stat: "2.1M launch views",
  },
  {
    title: "GRUBLAB",
    tag: "Identity + Campaign",
    year: "2025",
    img: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=70",
    stat: "Cannes shortlist",
  },
  {
    title: "OFFCUT VINTAGE",
    tag: "E-commerce",
    year: "2024",
    img: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=70",
    stat: "+188% conversion",
  },
];

export default function Work() {
  return (
    <section className="work" id="work">
      <div className="work-head">
        <h2 className="section-title">
          SELECTED<br />WORK<span className="title-dot">.</span>
        </h2>
        <p className="work-note">
          37 projects shipped since 2017.<br />These four still make us grin.
        </p>
      </div>
      <div className="project-grid">
        {PROJECTS.map((p, i) => (
          <article key={p.title} className={`project ${i % 2 === 1 ? "project-offset" : ""}`}>
            <div className="project-media">
              <img src={p.img} alt={p.title} />
              <span className="project-stat">{p.stat}</span>
            </div>
            <div className="project-meta">
              <h3>{p.title}</h3>
              <div className="project-tags">
                <span className="tag">{p.tag}</span>
                <span className="tag tag-year">{p.year}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
