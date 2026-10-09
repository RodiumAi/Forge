const clients = ["Ledgerly", "Chartfox", "Vitalpath", "Bramble", "Ostium", "Kelora"];

export default function Clients() {
  return (
    <section className="clients container">
      <p className="clients-label">Powering product teams at</p>
      <div className="clients-row">
        {clients.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
    </section>
  );
}
