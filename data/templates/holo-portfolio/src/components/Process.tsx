const process = [
  {
    num: "1",
    title: "Decode",
    text: "One week of questions. I dig until I understand what your audience actually feels.",
  },
  {
    num: "2",
    title: "Prototype",
    text: "Rough, real and interactive within days. We judge motion on screen, never on slides.",
  },
  {
    num: "3",
    title: "Polish",
    text: "Frame-by-frame tuning until 60fps is boringly reliable on a five-year-old phone.",
  },
  {
    num: "4",
    title: "Launch",
    text: "Handover with docs, source and a recorded walkthrough. No black boxes left behind.",
  },
];

export default function Process() {
  return (
    <section className="process">
      <h2 className="section-title">
        THE <span className="mega-grad">PROCESS</span>
      </h2>
      <div className="process-grid">
        {process.map((s) => (
          <article className="process-step" key={s.title}>
            <span className="process-num">
              <span className="process-ring">{s.num}</span>
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
