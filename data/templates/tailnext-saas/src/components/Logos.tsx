const partners = ["Northbeam", "Kitefox", "Lumora", "Draftly", "Quanta", "Heliodor"];

export default function Logos() {
  return (
    <section className="logos" aria-label="Trusted by">
      {partners.map((p) => (
        <span key={p} className="logo-pill">{p}</span>
      ))}
    </section>
  );
}
