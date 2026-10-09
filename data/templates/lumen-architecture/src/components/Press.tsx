const press = [
  { outlet: "Architectural Review", note: "Emerging Practice of the Year, shortlist — 2025" },
  { outlet: "Dezeen", note: "Kiln Pavilion: 'a lesson in restraint' — 2024" },
  { outlet: "Wallpaper*", note: "Top 20 studios to watch — 2024" },
  { outlet: "Domus", note: "Meridian House, cover feature — 2025" },
];

export default function Press() {
  return (
    <section className="section press">
      <div className="section-head">
        <span className="section-num">05</span>
        <h2 className="section-title">Recognition</h2>
      </div>
      <ul className="press-list">
        {press.map((p) => (
          <li className="press-row" key={p.outlet}>
            <span className="press-outlet">{p.outlet}</span>
            <span className="press-note">{p.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
