const programs = [
  {
    tag: "STR",
    name: "Strength",
    desc: "Barbell-first programming in 6-week blocks. Squat, pull, press — logged, coached, progressed every single session.",
    stat: "5x",
    statLabel: "weekly slots",
    img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=70",
  },
  {
    tag: "CND",
    name: "Conditioning",
    desc: "Sleds, rowers, ski ergs and bad decisions. 45 minutes of intervals engineered to raise your engine, not wreck your joints.",
    stat: "900+",
    statLabel: "kcal average burn",
    img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=70",
  },
  {
    tag: "BOX",
    name: "Boxing",
    desc: "Real pad work, real footwork, zero cardio-boxing fluff. Beginners welcome; egos checked at the ropes.",
    stat: "12",
    statLabel: "rounds per class",
    img: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=70",
  },
];

export default function Programs() {
  return (
    <section className="section diag diag-lime" id="programs">
      <div className="section-head">
        <h2 className="section-title dark">PICK YOUR<br />POISON.</h2>
        <p className="section-sub dark">
          Three programs. All coached, all logged, all progressive. Drop-ins die here; systems win.
        </p>
      </div>
      <div className="program-grid">
        {programs.map((p) => (
          <article className="program-card" key={p.tag}>
            <div className="program-imgwrap">
              <img src={p.img} alt={p.name} />
              <span className="program-tag">{p.tag}</span>
            </div>
            <div className="program-body">
              <h3 className="program-name">{p.name}</h3>
              <p className="program-desc">{p.desc}</p>
              <div className="program-stat">
                <span className="program-stat-value">{p.stat}</span>
                <span className="program-stat-label">{p.statLabel}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
