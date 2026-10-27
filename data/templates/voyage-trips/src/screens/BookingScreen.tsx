import "../styles/booking.css";
import { ArrowLeft, Check, Minus, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { byId, DATES, euro, NIGHTS } from "../data";

const SERVICE_FEE = 24;

/** Stack screen (no tab bar): pick dates and guests, confirm, success state. */
export default function BookingScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const d = byId(id);
  const [date, setDate] = useState(DATES[0].id);
  const [nights, setNights] = useState(5);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [done, setDone] = useState(false);
  if (!d) return <Navigate to="/" replace />;

  const day = DATES.find((x) => x.id === date) ?? DATES[0];
  const stay = d.price * nights;
  const total = stay + SERVICE_FEE;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/destination/${d?.id}`, { replace: true });
  }

  if (done) {
    return (
      <div className="app-shell booking-screen done">
        <img className="done-photo" src={d.photo} alt="" />
        <div className="done-mark"><Check size={38} strokeWidth={2.6} aria-hidden /></div>
        <p className="kicker">Booking confirmed</p>
        <h2>You're going to <em>{d.name}</em></h2>
        <p className="muted">{day.label} {day.date} {day.month}, {nights} nights for {adults + kids} guests. Reference VY-48213, sent to your email.</p>
        <div className="done-actions">
          <button className="btn-primary" onClick={() => navigate("/trips", { replace: true })}>View my trips</button>
          <button className="btn-ghost" onClick={() => navigate("/", { replace: true })}>Back to explore</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell booking-screen">
      <header className="bar">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2} aria-hidden /></button>
        <h1>Book your stay</h1>
        <span className="bar-space" aria-hidden />
      </header>

      <section className="summary">
        <img src={d.thumb} alt="" />
        <div>
          <strong>{d.name}</strong>
          <span>{d.stay}</span>
          <span className="rate"><Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden /> {d.rating} · {euro(d.price)} a night</span>
        </div>
      </section>

      <section>
        <h2>Check in</h2>
        <div className="dates" role="radiogroup" aria-label="Check-in date">
          {DATES.map((x) => (
            <button key={x.id} role="radio" aria-checked={date === x.id} className={date === x.id ? "on" : ""} onClick={() => setDate(x.id)}>
              <span>{x.label}</span><strong>{x.date}</strong><span>{x.month}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Nights</h2>
        <div className="chips" role="radiogroup" aria-label="Nights">
          {NIGHTS.map((n) => (
            <button key={n} role="radio" aria-checked={nights === n} className={nights === n ? "chip on" : "chip"} onClick={() => setNights(n)}>{n} nights</button>
          ))}
        </div>
      </section>

      <section className="guests">
        <h2>Guests</h2>
        <Stepper label="Adults" hint="13 and over" value={adults} min={1} onChange={setAdults} />
        <Stepper label="Children" hint="2 to 12" value={kids} min={0} onChange={setKids} />
      </section>

      <section className="totals">
        <div><span>{euro(d.price)} x {nights} nights</span><span>{euro(stay)}</span></div>
        <div><span>Service fee</span><span>{euro(SERVICE_FEE)}</span></div>
        <div className="grand"><span>Total</span><strong>{euro(total)}</strong></div>
      </section>

      <button className="btn-primary confirm" onClick={() => setDone(true)}>Confirm and pay {euro(total)}</button>
    </div>
  );
}

type StepperProps = { label: string; hint: string; value: number; min: number; onChange: (n: number) => void };

function Stepper({ label, hint, value, min, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <span className="s-label"><strong>{label}</strong><span>{hint}</span></span>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}><Minus size={18} strokeWidth={2.4} aria-hidden /></button>
      <output aria-live="polite">{value}</output>
      <button onClick={() => onChange(Math.min(8, value + 1))} aria-label={`More ${label.toLowerCase()}`}><Plus size={18} strokeWidth={2.4} aria-hidden /></button>
    </div>
  );
}
