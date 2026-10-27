import "../styles/trips.css";
import { CalendarDays, Clock, Plane, QrCode, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { byId, PAST_TRIPS, TRIP } from "../data";

const VIEWS = ["Upcoming", "Past"] as const;

export default function TripsScreen() {
  const [view, setView] = useState<(typeof VIEWS)[number]>("Upcoming");
  const place = byId(TRIP.destination);
  const f = TRIP.flight;

  return (
    <main className="app-main trips-screen">
      <div className="segmented" role="tablist" aria-label="Trips">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>

      {view === "Upcoming" ? (
        <>
          <Link to={`/destination/${TRIP.destination}`} className="trip-hero">
            <img src={place?.photo} alt="" />
            <span className="trip-badge"><Clock size={13} strokeWidth={2.4} aria-hidden /> In {TRIP.countdown} days</span>
            <span className="trip-text">
              <span className="trip-name">{place?.name}</span>
              <span className="trip-dates"><CalendarDays size={14} strokeWidth={2.2} aria-hidden /> {TRIP.dates} · 5 nights</span>
            </span>
          </Link>

          <section className="pass" aria-label="Boarding pass">
            <div className="pass-top">
              <span className="pass-airline">{f.code}</span>
              <span>{f.cls}</span>
            </div>
            <div className="route">
              <div><strong>{f.from}</strong><span>{f.fromCity}</span><em>{f.depart}</em></div>
              <div className="route-line" aria-hidden><i /><Plane size={18} strokeWidth={2.2} /><i /></div>
              <div className="to"><strong>{f.to}</strong><span>{f.toCity}</span><em>{f.arrive}</em></div>
            </div>
            <div className="tear" aria-hidden />
            <div className="pass-grid">
              <div><span>Gate</span><strong>{f.gate}</strong></div>
              <div><span>Seat</span><strong>{f.seat}</strong></div>
              <div><span>Boards</span><strong>{f.boarding}</strong></div>
              <span className="qr"><QrCode size={34} strokeWidth={1.6} aria-hidden /></span>
            </div>
            <div className="barcode" aria-hidden />
          </section>

          <section>
            <div className="section-head"><h2>Itinerary</h2><span className="muted">{TRIP.itinerary.length} stops</span></div>
            <ol className="timeline">
              {TRIP.itinerary.map((s, i) => (
                <li key={s.title} className={i === 0 ? "next" : ""}>
                  <span className="t-when"><strong>{s.time}</strong>{s.day}</span>
                  <span className="t-dot" aria-hidden />
                  <span className="t-body"><strong>{s.title}</strong><span>{s.note}</span></span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <section className="card past">
          {PAST_TRIPS.map((t) => (
            <div key={t.id} className="row">
              <img src={t.photo} alt="" />
              <span className="row-body"><strong>{t.place}</strong><span>{t.dates} · {t.nights} nights</span></span>
              <span className="row-end rated"><Star size={14} strokeWidth={2.4} fill="currentColor" aria-hidden /><strong>{t.rating}</strong></span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
