const figures = [
  { value: "$2.4B", label: "Client value created since 2015" },
  { value: "340+", label: "Engagements delivered across 27 markets" },
  { value: "94%", label: "Of clients retain us beyond the first mandate" },
  { value: "18", label: "Former C-suite executives among our partners" },
];

export default function Figures() {
  return (
    <section className="figures">
      {figures.map((f) => (
        <div className="figure" key={f.value}>
          <span className="figure-value">{f.value}</span>
          <span className="figure-label">{f.label}</span>
        </div>
      ))}
    </section>
  );
}
