const LOGOS = ["Fernbrook", "Klarwave", "Nordbank", "Hexalab", "Vantoro", "Prismatic"];

export default function Logos() {
  return (
    <section className="logos container" id="customers">
      <p className="logos-label">Trusted by teams shipping AI in production</p>
      <div className="logos-row">
        {LOGOS.map((l) => (
          <span key={l} className="logo-item">{l}</span>
        ))}
      </div>
    </section>
  );
}
