const logos = ["Norvane", "Quillbay", "Hexlight", "Marloe", "Driftkit", "Souther"];

export default function Logos() {
  return (
    <section className="logos container">
      <p className="logos-label">Trusted by teams that move quickly</p>
      <div className="logos-row">
        {logos.map((l) => (
          <span key={l} className="logo-item">{l}</span>
        ))}
      </div>
    </section>
  );
}
