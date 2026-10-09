const foldPanels = [
  {
    num: "01",
    title: "Sketch flat",
    text: "Start in 2D like you always have. Foldspace tracks every crease line as a live hinge with real material thickness.",
  },
  {
    num: "02",
    title: "Fold in space",
    text: "Pull any edge and the sheet folds along its hinges. Collision detection stops impossible geometry before you commit.",
  },
  {
    num: "03",
    title: "Ship the part",
    text: "Simulate load, unfold to a cut pattern, and send to fabrication — all without leaving the browser tab.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="section-head">
        <h2 className="section-title">From flat sheet to finished part</h2>
        <p className="section-sub">Hover a panel — it unfolds. That is also, roughly, the product.</p>
      </div>
      <div className="fold-row">
        {foldPanels.map((p) => (
          <div className="fold-scene" key={p.num}>
            <div className="fold-panel">
              <div className="fold-face">
                <span className="fold-num">{p.num}</span>
                <h3 className="fold-title">{p.title}</h3>
                <p className="fold-text">{p.text}</p>
              </div>
              <div className="fold-flap" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
