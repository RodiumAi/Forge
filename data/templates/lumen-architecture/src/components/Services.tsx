const services = [
  {
    num: "01",
    title: "Architecture",
    text: "Complete building design from feasibility to handover. We lead every drawing set ourselves — nothing is delegated past the studio door.",
  },
  {
    num: "02",
    title: "Interiors",
    text: "Interior architecture conceived with the building, never after it. Joinery, stone, light fittings and thresholds detailed to the millimetre.",
  },
  {
    num: "03",
    title: "Master planning",
    text: "Urban fragments and campus plans that privilege the pedestrian, the courtyard and the long view over the diagram.",
  },
  {
    num: "04",
    title: "Adaptive reuse",
    text: "We treat existing fabric as the most sustainable material available. Careful subtraction before any addition.",
  },
];

export default function Services() {
  return (
    <section className="section" id="services">
      <div className="section-head">
        <span className="section-num">03</span>
        <h2 className="section-title">What we do</h2>
        <p className="section-sub">Full scope, one team</p>
      </div>
      <div className="services-grid">
        {services.map((s) => (
          <div className="service" key={s.num}>
            <span className="service-num">{s.num}</span>
            <h3 className="service-title">{s.title}</h3>
            <p className="service-text">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
