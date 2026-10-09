const stats = [
  { value: "16ms", label: "constraint solve, p95" },
  { value: "48k", label: "engineers on the platform" },
  { value: "2.3M", label: "parts fabricated in 2025" },
  { value: "40", label: "cities in the print network" },
];

export default function Workflow() {
  return (
    <section className="section">
      <div className="planes">
        <div className="plane plane-back" aria-hidden="true" />
        <div className="plane plane-mid" aria-hidden="true" />
        <div className="plane plane-front">
          <div className="plane-copy">
            <p className="eyebrow">Inside a real team</p>
            <h2 className="plane-title">Ortho Robotics cut prototype cycles from 3 weeks to 4 days</h2>
            <p className="plane-text">
              Their gripper chassis went through 31 folded revisions in one
              sprint. Every revision was a branch; every fabrication run, a
              tagged release. QA reviewed geometry diffs like pull requests.
            </p>
            <a className="btn btn-solid" href="#pricing">Read the case study</a>
          </div>
          <img
            className="plane-img"
            src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=70"
            alt="Engineer working at a prototyping workstation"
          />
        </div>
      </div>
      <div className="stats-row">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
