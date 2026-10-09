const TESTIMONIALS = [
  {
    quote: "Mira turns vague requirements into systems that quietly keep working. Half our tooling still carries her fingerprints.",
    name: "Devon Aker",
    role: "Engineering Manager, Northwind Systems",
    gradient: "linear-gradient(135deg, #5eead4, #2563eb)",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70",
    alt: "Portrait of Devon Aker smiling"
  },
  {
    quote: "She reviews code the way good editors review prose: firmly, kindly, and always making the whole thing sharper.",
    name: "Priya Ranganathan",
    role: "Staff Engineer, Cobalt Harbor Labs",
    gradient: "linear-gradient(135deg, #f0abfc, #7c3aed)",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=70",
    alt: "Portrait of Priya Ranganathan smiling"
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="section">
      <h2>Testimonials</h2>
      <div className="quotes">
        {TESTIMONIALS.map((t) => (
          <blockquote key={t.name} className="quote">
            <p>&quot;{t.quote}&quot;</p>
            <footer className="quote-foot">
              <span className="quote-avatar" style={{ background: t.gradient }}>
                <img src={t.avatar} alt={t.alt} loading="lazy" />
              </span>
              <span>
                <strong>{t.name}</strong>
                <em className="muted"> — {t.role}</em>
              </span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
