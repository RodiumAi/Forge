const SPEAKERS = [
  { name: "Mara Voss", role: "Head of Design, Fieldwork", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=70" },
  { name: "Kenji Nakamura", role: "Motion Lead, Vercel", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=70" },
  { name: "Amara Diallo", role: "Principal Designer, Linear", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70" },
  { name: "Tomas Okafor", role: "Founder, Northbeam", img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70" },
  { name: "Priya Sharma", role: "AI Product, Figma", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1200&q=70" },
  { name: "Ines Beckert", role: "Creative Director, Studio Dumbar", img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=70" },
];

export default function Speakers() {
  return (
    <section className="section" id="speakers">
      <div className="section-head">
        <h2 className="h2">Speakers <span className="outline-text">’27</span></h2>
        <p className="section-sub">First six confirmed. Twelve more announced in waves — follow the newsletter below.</p>
      </div>
      <div className="speaker-grid">
        {SPEAKERS.map((s) => (
          <article className="speaker" key={s.name}>
            <div className="speaker-photo">
              <img src={s.img} alt={s.name} loading="lazy" />
            </div>
            <h3 className="speaker-name">{s.name}</h3>
            <p className="speaker-role">{s.role}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
