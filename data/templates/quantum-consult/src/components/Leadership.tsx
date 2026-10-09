const leaders = [
  {
    img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70",
    name: "Marcus Feld",
    role: "Managing Partner",
    bio: "Former group CFO. Leads the firm's financial services practice.",
  },
  {
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70",
    name: "Ingrid Salzer",
    role: "Senior Partner, Strategy",
    bio: "Two decades advising boards on portfolio and capital decisions.",
  },
  {
    img: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=70",
    name: "David Okonkwo",
    role: "Partner, M&A",
    bio: "Has led diligence on transactions exceeding $40B in aggregate.",
  },
];

export default function Leadership() {
  return (
    <section className="leadership" id="leadership">
      <div className="sec-rule">
        <span className="sec-num">§4</span>
        <h2>Leadership</h2>
      </div>
      <div className="leader-grid">
        {leaders.map((l) => (
          <article className="leader" key={l.name}>
            <img src={l.img} alt={l.name} loading="lazy" />
            <h3>{l.name}</h3>
            <p className="leader-role">{l.role}</p>
            <p className="leader-bio">{l.bio}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
