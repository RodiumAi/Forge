import { heritage } from "../data";

export default function Heritage() {
  return (
    <section className="heritage" id="heritage">
      <div className="heritage-media">
        <img
          src="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=70"
          alt="Garments in the atelier"
          loading="lazy"
        />
      </div>
      <div className="heritage-copy">
        <p className="kicker">La Maison</p>
        <h2>Ninety Years of the Quiet Hand</h2>
        <p className="heritage-lede">
          Maison Vernet has never advertised. It has never licensed a perfume. It makes clothes, slowly,
          for people who understand that restraint is the rarest luxury of all.
        </p>
        <ul className="timeline">
          {heritage.map((h) => (
            <li key={h.year}>
              <span className="timeline-year">{h.year}</span>
              <span className="timeline-event">{h.event}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
