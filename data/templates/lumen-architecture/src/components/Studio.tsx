const team = [
  {
    name: "Elias Vantorre",
    role: "Founding Principal",
    bio: "RIBA. Formerly senior associate at Herzog & de Meuron, Basel. Teaches at the AA.",
    img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Naomi Achterberg",
    role: "Principal, Interiors",
    bio: "Led the Vault Gallery interiors. Obsessed with the junction between timber and stone.",
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Tomas Ferreira",
    role: "Director, Technical",
    bio: "Twenty years of construction documentation. The person contractors call before they call anyone else.",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=70",
  },
];

export default function Studio() {
  return (
    <section className="section" id="studio">
      <div className="section-head">
        <span className="section-num">04</span>
        <h2 className="section-title">The studio</h2>
        <p className="section-sub">Three principals, one drawing board</p>
      </div>
      <div className="team-grid">
        {team.map((m) => (
          <article className="team-card" key={m.name}>
            <div className="team-img">
              <img src={m.img} alt={m.name} />
            </div>
            <h3 className="team-name">{m.name}</h3>
            <p className="team-role">{m.role}</p>
            <p className="team-bio">{m.bio}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
