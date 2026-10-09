const steps = [
  { n: "01", title: "Listen", text: "We map your product, market and users to find the highest-impact bets." },
  { n: "02", title: "Shape", text: "Rough sketches become tested, polished interfaces backed by a shared system." },
  { n: "03", title: "Ship", text: "Engineers deliver in short cycles with staging previews you can click through." },
  { n: "04", title: "Grow", text: "After launch we watch real usage and keep tuning what matters most." },
];

export default function Process() {
  return (
    <section id="process" className="process container">
      <p className="eyebrow">How we work</p>
      <h2>A proven four-step delivery rhythm</h2>
      <div className="step-grid">
        {steps.map((s) => (
          <article key={s.n} className="step">
            <span className="step-n">{s.n}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
