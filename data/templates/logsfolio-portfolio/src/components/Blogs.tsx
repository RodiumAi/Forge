const BLOGS = [
  { title: "Boring Deploys Are a Feature", date: "14 May 2026", teaser: "Why the most valuable pipeline is the one nobody talks about, and how to get there in small steps." },
  { title: "Reading Flame Graphs Without Fear", date: "2 Feb 2026", teaser: "A practical walkthrough for engineers who open a profiler once a quarter and immediately regret it." }
];

export default function Blogs() {
  return (
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
  );
}
