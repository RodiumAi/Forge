const PROCESS = [
  {
    step: "A",
    title: "We listen",
    text: "One brutal kickoff workshop. You talk, we interrogate. 90 minutes, no slides.",
  },
  {
    step: "B",
    title: "We fight",
    text: "Three directions, one week. We argue internally so you don't have to. The best idea wins, not the safest.",
  },
  {
    step: "C",
    title: "We build",
    text: "Design, code, motion — all in-house, all in one room. You see progress every 48 hours.",
  },
  {
    step: "D",
    title: "We ship",
    text: "On time or we tell you why two weeks early. Then we measure what happened and brag about it.",
  },
];

const CLIENTS = [
  "MOSHPIT",
  "TANGERINE",
  "GRUBLAB",
  "OFFCUT",
  "HELVETICA GYM",
  "PLONK WINES",
  "DIALTONE",
  "KAPOW SNACKS",
  "BRUUT",
];

export default function Process() {
  return (
    <section className="process" id="process">
      <h2 className="section-title">
        HOW IT WORKS<span className="title-dot">.</span>
      </h2>
      <div className="process-grid">
        {PROCESS.map((p) => (
          <div key={p.step} className="process-card">
            <span className="process-step">{p.step}</span>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
      <div className="client-strip">
        <p className="client-label">BRANDS THAT SURVIVED US:</p>
        <div className="client-tags">
          {CLIENTS.map((c) => (
            <span key={c} className="tag">{c}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
