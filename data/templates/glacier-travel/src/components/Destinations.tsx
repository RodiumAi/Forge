import { destinations } from "../data";

export default function Destinations() {
  return (
    <section className="section" id="destinations">
      <div className="section-head">
        <p className="eyebrow">2026 – 2027 season</p>
        <h2 className="section-title">Four journeys. No shortcuts.</h2>
        <p className="section-sub">
          Every departure is capped at eight travellers and two guides. When a
          trip says demanding, believe it — and know we'll get you ready.
        </p>
      </div>
      <div className="dest-grid">
        {destinations.map((d) => (
          <article className="dest-card" key={d.name}>
            <div className="dest-imgwrap">
              <img src={d.img} alt={d.name} />
              <span className="dest-grade">{d.grade}</span>
            </div>
            <div className="dest-body">
              <h3 className="dest-name">{d.name}</h3>
              <p className="dest-place">{d.place}</p>
              <div className="dest-foot">
                <span>{d.days}</span>
                <span className="dest-price">from {d.price}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
