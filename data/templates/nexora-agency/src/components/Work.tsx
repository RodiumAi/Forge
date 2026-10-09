const work = [
  { tag: "FinTech · Design", title: "Ledgerly Console Refresh", tone: "a", img: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=70", alt: "Bright open-plan office with desks and monitors" },
  { tag: "SaaS · Engineering", title: "Chartfox Insights Suite", tone: "b", img: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=70", alt: "Team collaborating around a laptop in a meeting" },
  { tag: "HealthTech · Brand", title: "Vitalpath Care App", tone: "c", img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=70", alt: "People working together on laptops at a shared table" },
];

export default function Work() {
  return (
    <section id="work" className="work container">
      <p className="eyebrow">Selected work</p>
      <h2>Case studies that carry their own weight</h2>
      <div className="work-grid">
        {work.map((w) => (
          <article key={w.title} className={`work-card tone-${w.tone}`}>
            <div className="work-visual">
              <img src={w.img} alt={w.alt} loading="lazy" />
            </div>
            <p className="work-tag">{w.tag}</p>
            <h3>{w.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
