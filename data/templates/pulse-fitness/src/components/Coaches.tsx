const coaches = [
  {
    name: "Dre Okafor",
    role: "Head of Strength",
    creds: "CSCS · 14 yrs · 240kg deadlift",
    img: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Mia Santoro",
    role: "Conditioning Lead",
    creds: "Ex-national 800m · CF-L3",
    img: "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Viktor Hale",
    role: "Boxing Coach",
    creds: "22-3 amateur · ABA certified",
    img: "https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?auto=format&fit=crop&w=1200&q=70",
  },
];

export default function Coaches() {
  return (
    <section className="section diag diag-carbon" id="coaches">
      <div className="section-head">
        <h2 className="section-title">THE PEOPLE<br />WHO'LL <span className="lime">PUSH YOU.</span></h2>
        <p className="section-sub">
          Every coach at Pulse still competes. If they don't practice it, they don't program it.
        </p>
      </div>
      <div className="coach-grid">
        {coaches.map((c) => (
          <article className="coach-card" key={c.name}>
            <div className="coach-imgwrap">
              <img src={c.img} alt={c.name} />
            </div>
            <h3 className="coach-name">{c.name}</h3>
            <p className="coach-role">{c.role}</p>
            <p className="coach-creds">{c.creds}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
