const ARCHIVE = [
  { issue: "Issue № 11", theme: "Attention", date: "Winter 2025" },
  { issue: "Issue № 10", theme: "Repair", date: "Autumn 2025" },
  { issue: "Issue № 09", theme: "Silence", date: "Summer 2025" },
  { issue: "Issue № 08", theme: "Borders", date: "Spring 2025" },
];

export default function Archive() {
  return (
    <section className="section" id="archive">
      <div className="section-rule">
        <h2 className="section-title">The archive</h2>
        <span className="section-note">Eleven issues, all free to read</span>
      </div>
      <div className="archive-grid">
        {ARCHIVE.map((i) => (
          <a className="archive-card" href="#index" key={i.issue}>
            <span className="archive-issue">{i.issue}</span>
            <span className="archive-theme">{i.theme}</span>
            <span className="archive-date">{i.date}</span>
          </a>
        ))}
      </div>
      <figure className="archive-figure">
        <img
          src="https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=70"
          alt="An open book, black and white"
          loading="lazy"
        />
        <figcaption>The letterpress edition of Issue № 09, “Silence”.</figcaption>
      </figure>
    </section>
  );
}
