const skills = [
  { name: "Creative coding / WebGL", pct: 95 },
  { name: "Motion design", pct: 90 },
  { name: "Brand systems", pct: 82 },
  { name: "3D & shaders", pct: 88 },
  { name: "Frontend engineering", pct: 85 },
];

export default function About() {
  return (
    <section className="about" id="about">
      <div className="about-media">
        <img
          src="https://images.unsplash.com/photo-1617042375876-a13e36732a04?auto=format&fit=crop&w=1200&q=70"
          alt="Studio workspace"
          loading="lazy"
        />
      </div>
      <div className="about-copy">
        <h2 className="section-title">
          ABOUT <span className="mega-grad">ME</span>
        </h2>
        <p>
          I'm Kaito Reyes — one person, one studio, zero account managers. I studied physics,
          fell into shaders, and never climbed out. Clients include record labels, film studios
          and startups that want their product to feel like the future arrived early.
        </p>
        <div className="skills">
          {skills.map((s) => (
            <div className="skill" key={s.name}>
              <div className="skill-row">
                <span>{s.name}</span>
                <span className="skill-pct">{s.pct}%</span>
              </div>
              <div className="skill-track">
                <div className="skill-fill" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
