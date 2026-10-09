import { TOUR } from "../data";

export default function Tour() {
  return (
    <section className="live" id="tour">
      <div className="live-media">
        <img
          src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=70"
          alt="Neon Nights live"
        />
        <div className="live-overlay" />
        <div className="live-caption">
          <h2>THE ARCADE TOUR '26</h2>
          <p>Full analog rig · laser wall · 6 cities</p>
        </div>
      </div>
      <ul className="tour-list">
        {TOUR.map((t) => (
          <li key={t.city} className="tour-row">
            <span className="tour-date">{t.date}</span>
            <span className="tour-city">
              <strong>{t.city}</strong>
              <small>{t.venue}</small>
            </span>
            <a
              className={`btn btn-sm ${t.status === "Sold out" ? "btn-dead" : "btn-neon"}`}
              href="#tour"
            >
              {t.status}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
