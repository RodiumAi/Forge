import { Star } from "lucide-react";

const quotes = [
  { text: "They rewired our signup journey in weeks and the numbers moved almost overnight. Genuinely impressive pace.", name: "Amara Feld", role: "Head of Product, Ledgerly", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=70" },
  { text: "It felt less like hiring an agency and more like unlocking a senior team we could not have recruited ourselves.", name: "Tomas Reine", role: "CTO, Chartfox", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70" },
  { text: "Clear scope, honest timelines, and the final build went beyond what we asked for. We renewed immediately.", name: "Priya Anand", role: "Founder, Vitalpath", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=70" },
];

export default function Testimonials() {
  return (
    <section className="quotes container">
      <p className="eyebrow">Client feedback</p>
      <h2>Words from the teams we serve</h2>
      <div className="quote-grid">
        {quotes.map((q) => (
          <blockquote key={q.name} className="quote">
            <span className="stars" aria-label="5 out of 5 stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
              ))}
            </span>
            <p>&ldquo;{q.text}&rdquo;</p>
            <footer>
              <img className="avatar" src={q.img} alt={`Portrait of ${q.name}`} loading="lazy" />
              <span><strong>{q.name}</strong><br />{q.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
