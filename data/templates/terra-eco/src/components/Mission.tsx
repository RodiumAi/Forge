const STEPS = [
  { n: "01", title: "Measure honestly", desc: "Full scope 1–3 accounting with open methodology. No creative boundaries, no offsets counted as reductions." },
  { n: "02", title: "Reduce first", desc: "We only fund removal for what genuinely cannot be reduced yet. Reduction roadmaps come before any credit purchase." },
  { n: "03", title: "Regenerate locally", desc: "Every euro flows to projects with named stewards, GPS-verified plots and five-year monitoring you can visit." },
];

export default function Mission() {
  return (
    <section className="section" id="mission">
      <div className="section-head center">
        <span className="eyebrow">How we work</span>
        <h2 className="h2">Three rules we never bend</h2>
      </div>
      <div className="steps">
        {STEPS.map((s) => (
          <article className="step" key={s.n}>
            <div className="step-n">{s.n}</div>
            <h3 className="step-title">{s.title}</h3>
            <p className="step-desc">{s.desc}</p>
          </article>
        ))}
      </div>
      <div className="mission-band">
        <img
          className="mission-img"
          src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=70"
          alt="Hands holding a young seedling in rich soil"
        />
        <blockquote className="mission-quote">
          “Sustainability asks how to do less harm. Regeneration asks how a place
          becomes more alive each year because you were there.”
          <cite>— Nadia Ferreira, co-founder</cite>
        </blockquote>
      </div>
    </section>
  );
}
