const NAV = ["Experience", "Projects", "Education", "Testimonials", "Blogs"];

const EXPERIENCE = [
  {
    role: "Lead Platform Engineer",
    company: "Northwind Systems",
    period: "Mar 2021 - Present",
    points: [
      "Own the internal deployment platform used by nine product squads.",
      "Cut median build times from 14 minutes to under 4 with remote caching.",
      "Introduced typed service contracts across the API gateway.",
      "Run the on-call rotation and post-incident review process."
    ]
  },
  {
    role: "Full Stack Engineer",
    company: "Cobalt Harbor Labs",
    period: "Aug 2017 - Feb 2021",
    points: [
      "Shipped a real-time logistics dashboard used by 40+ warehouses.",
      "Built event-driven pipelines on top of message queues and workers.",
      "Paired weekly with designers to keep the component library honest.",
      "Migrated a legacy monolith to modular TypeScript services."
    ]
  }
];

const PROJECTS = [
  {
    name: "Driftlog",
    tags: ["TypeScript", "React", "SQLite"],
    blurb: "An offline-first field notebook for research teams. Entries sync when a connection returns and merge without conflicts.",
    gradient: "linear-gradient(150deg, #134e4a, #0f2942 85%)"
  },
  {
    name: "Quorum Board",
    tags: ["Next.js", "Postgres", "WebSockets"],
    blurb: "A lightweight decision-tracking board for distributed teams: proposals, votes and a permanent audit trail.",
    gradient: "linear-gradient(160deg, #3b2f5e, #101726 85%)"
  },
  {
    name: "Pinch Metrics",
    tags: ["Node.js", "ClickHouse", "D3"],
    blurb: "Self-hosted product analytics that fits in a single container and answers questions in under a second.",
    gradient: "linear-gradient(140deg, #7c3f2d, #1a1420 85%)"
  }
];

const EDUCATION = [
  {
    title: "M.Sc. Software Engineering",
    school: "Valmora Institute of Technology",
    period: "2015 - 2017",
    detail: "Thesis on incremental compilation strategies for large TypeScript codebases. Teaching assistant for the distributed systems course."
  },
  {
    title: "B.Sc. Computer Science",
    school: "University of Eastvale",
    period: "2011 - 2015",
    detail: "Core curriculum in algorithms, databases and operating systems. Built a campus room-booking app still in use by two departments."
  }
];

const TESTIMONIALS = [
  {
    quote: "Mira turns vague requirements into systems that quietly keep working. Half our tooling still carries her fingerprints.",
    name: "Devon Aker",
    role: "Engineering Manager, Northwind Systems",
    gradient: "linear-gradient(135deg, #5eead4, #2563eb)"
  },
  {
    quote: "She reviews code the way good editors review prose: firmly, kindly, and always making the whole thing sharper.",
    name: "Priya Ranganathan",
    role: "Staff Engineer, Cobalt Harbor Labs",
    gradient: "linear-gradient(135deg, #f0abfc, #7c3aed)"
  }
];

const BLOGS = [
  { title: "Boring Deploys Are a Feature", date: "14 May 2026", teaser: "Why the most valuable pipeline is the one nobody talks about, and how to get there in small steps." },
  { title: "Reading Flame Graphs Without Fear", date: "2 Feb 2026", teaser: "A practical walkthrough for engineers who open a profiler once a quarter and immediately regret it." }
];

export default function App() {
  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">mira.solano<span className="brand-dot">()</span></span>
        <nav className="nav">
          {NAV.map((item) => (
            <a key={item} href={"#" + item.toLowerCase()}>{item}</a>
          ))}
        </nav>
      </header>

      <section className="hero">
        <div className="avatar" aria-hidden="true" />
        <h1>Hi, I&apos;m Mira Solano</h1>
        <p className="hero-sub">
          I build calm, dependable software for teams that ship every week.
          Currently deep in platform engineering, developer tooling and the
          occasional data visualization rabbit hole.
        </p>
        <div className="hero-links">
          <a href="#projects" className="btn btn--solid">See my work</a>
          <a href="#blogs" className="btn btn--ghost">Read the blog</a>
        </div>
      </section>

      <section id="experience" className="section">
        <h2>Work Experience</h2>
        {EXPERIENCE.map((job) => (
          <article key={job.role} className="job">
            <div className="job-head">
              <h3>{job.role} <span className="job-at">@ {job.company}</span></h3>
              <span className="meta">{job.period}</span>
            </div>
            <ul>
              {job.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </article>
        ))}
      </section>

      <section id="projects" className="section">
        <h2>Projects</h2>
        <div className="projects">
          {PROJECTS.map((proj) => (
            <article key={proj.name} className="card">
              <div className="card-thumb" style={{ background: proj.gradient }} />
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

      <section id="education" className="section">
        <h2>Education</h2>
        {EDUCATION.map((ed) => (
          <article key={ed.title} className="edu">
            <div className="job-head">
              <h3>{ed.title}</h3>
              <span className="meta">{ed.period}</span>
            </div>
            <p className="edu-school">{ed.school}</p>
            <p className="muted">{ed.detail}</p>
          </article>
        ))}
      </section>

      <section id="testimonials" className="section">
        <h2>Testimonials</h2>
        <div className="quotes">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name} className="quote">
              <p>&quot;{t.quote}&quot;</p>
              <footer className="quote-foot">
                <span className="quote-avatar" style={{ background: t.gradient }} />
                <span>
                  <strong>{t.name}</strong>
                  <em className="muted"> — {t.role}</em>
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section id="blogs" className="section">
        <h2>Blogs</h2>
        <div className="blogs">
          {BLOGS.map((b) => (
            <a key={b.title} href="#blogs" className="blog-card">
              <h3>{b.title}</h3>
              <p className="muted">{b.teaser}</p>
              <span className="meta">Published {b.date}</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>Mira Solano — a fictional developer, handcrafted for this template.</span>
      </footer>
    </div>
  );
}
