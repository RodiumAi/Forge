const PROJECTS = [
  {
    name: "Driftlog",
    tags: ["TypeScript", "React", "SQLite"],
    blurb: "An offline-first field notebook for research teams. Entries sync when a connection returns and merge without conflicts.",
    gradient: "linear-gradient(150deg, #134e4a, #0f2942 85%)",
    thumb: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=70",
    alt: "Code editor showing colorful source code on a dark screen"
  },
  {
    name: "Quorum Board",
    tags: ["Next.js", "Postgres", "WebSockets"],
    blurb: "A lightweight decision-tracking board for distributed teams: proposals, votes and a permanent audit trail.",
    gradient: "linear-gradient(160deg, #3b2f5e, #101726 85%)",
    thumb: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=70",
    alt: "Laptop screen displaying a programming environment"
  },
  {
    name: "Pinch Metrics",
    tags: ["Node.js", "ClickHouse", "D3"],
    blurb: "Self-hosted product analytics that fits in a single container and answers questions in under a second.",
    gradient: "linear-gradient(140deg, #7c3f2d, #1a1420 85%)",
    thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=70",
    alt: "MacBook with lines of code on the screen in a dim room"
  }
];

export default function Projects() {
  return (
    <section id="projects" className="section">
      <h2>Projects</h2>
      <div className="projects">
        {PROJECTS.map((proj) => (
          <article key={proj.name} className="card">
            <div className="card-thumb" style={{ background: proj.gradient }}>
              <img src={proj.thumb} alt={proj.alt} loading="lazy" />
            </div>
            <div className="card-body">
              <h3>{proj.name}</h3>
              <div className="tags">
                {proj.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
              <p>{proj.blurb}</p>
              <div className="card-links">
                <a href="#projects">Live demo</a>
                <a href="#projects">Repository</a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
