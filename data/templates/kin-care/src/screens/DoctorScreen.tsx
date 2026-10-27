import { Award, Building2, CalendarCheck, ChevronLeft, Heart, MapPin, Star, UsersRound, Video } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useCare } from "../components/CareState";
import { DAYS, SLOTS, TAKEN, doctorById, money, specialtyOf } from "../data";
import "../styles/doctor.css";

type Kind = "video" | "clinic";

export default function DoctorScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { book, favourites, toggleFavourite } = useCare();
  const doctor = doctorById(id);
  const [day, setDay] = useState(DAYS[1].date);
  const [slot, setSlot] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("video");
  const [more, setMore] = useState(false);
  const [done, setDone] = useState(false);

  if (!doctor) return <Navigate to="/doctors" replace />;

  const fav = favourites.includes(doctor.id);
  const spec = specialtyOf(doctor.specialty);
  const picked = DAYS.find((d) => d.date === day) ?? DAYS[1];

  function back() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/doctors");
  }

  function confirm() {
    if (!doctor || !slot) return;
    book({ doctorId: doctor.id, day: picked.day, date: picked.date, month: picked.date === "1" ? "Nov" : "Oct", time: slot, kind, note: "New consultation" });
    setDone(true);
  }

  if (done && slot) {
    return (
      <div className="app-shell doctor-screen">
        <div className="success">
          <span className="ok-ring"><CalendarCheck size={34} strokeWidth={2} aria-hidden /></span>
          <h1>You're booked</h1>
          <p className="muted">{doctor.name} will see you {kind === "video" ? "on video" : "at " + doctor.clinic} on {picked.day} {picked.date} at {slot}. We'll remind you the day before.</p>
          <div className="summary">
            <img src={doctor.photo} alt="" />
            <span><strong>{doctor.name}</strong><small>{picked.day} {picked.date}, {slot}</small></span>
            <span className="fee">{money(doctor.fee)}</span>
          </div>
          <Link to="/appointments" className="btn-primary">View appointments</Link>
          <Link to="/" className="btn-ghost">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell doctor-screen">
      <header className="cover">
        <img src={doctor.photo.replace("w=600", "w=900")} alt="" />
        <div className="cover-bar">
          <button className="round" onClick={back} aria-label="Back"><ChevronLeft size={22} strokeWidth={2.4} aria-hidden /></button>
          <button className={fav ? "round fav-btn on" : "round fav-btn"} onClick={() => toggleFavourite(doctor.id)} aria-pressed={fav} aria-label="Favourite">
            <Heart size={20} strokeWidth={2.2} fill={fav ? "currentColor" : "none"} aria-hidden />
          </button>
        </div>
      </header>

      <section className="sheet">
        <div className="title">
          <span className="spec-chip" style={{ background: spec.tint }}>{doctor.title}</span>
          <h1>{doctor.name}</h1>
          <p className="muted"><MapPin size={14} strokeWidth={2.2} aria-hidden /> {doctor.clinic}, {doctor.distance}</p>
        </div>

        <div className="stats">
          <span><i><Award size={18} strokeWidth={2.2} aria-hidden /></i><strong>{doctor.years} yrs</strong><small>Experience</small></span>
          <span><i><UsersRound size={18} strokeWidth={2.2} aria-hidden /></i><strong>{doctor.patients}</strong><small>Patients</small></span>
          <span><i className="star"><Star size={18} strokeWidth={0} fill="currentColor" aria-hidden /></i><strong>{doctor.rating.toFixed(1)}</strong><small>{doctor.reviews} reviews</small></span>
        </div>

        <div>
          <h2>About</h2>
          <p className={more ? "about open" : "about"}>{doctor.about}</p>
          <button className="link" onClick={() => setMore(!more)}>{more ? "Show less" : "Read more"}</button>
        </div>

        <div>
          <h2>Consultation</h2>
          <div className="segmented kinds">
            <button className={kind === "video" ? "on" : ""} onClick={() => setKind("video")}><Video size={16} strokeWidth={2.2} aria-hidden /> Video</button>
            <button className={kind === "clinic" ? "on" : ""} onClick={() => setKind("clinic")}><Building2 size={16} strokeWidth={2.2} aria-hidden /> In clinic</button>
          </div>
        </div>

        <div>
          <div className="row-head"><h2>October 2026</h2><span className="muted">Pick a day</span></div>
          <div className="days">
            {DAYS.map((d) => (
              <button key={d.date} className={day === d.date ? "day on" : "day"} disabled={!d.open} onClick={() => { setDay(d.date); setSlot(null); }} aria-pressed={day === d.date}>
                <small>{d.day}</small><strong>{d.date}</strong>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="row-head"><h2>Available times</h2><span className="muted">{SLOTS.length - TAKEN.length} open</span></div>
          <div className="slots">
            {SLOTS.map((t) => {
              const taken = TAKEN.includes(t);
              return (
                <button key={t} className={slot === t ? "slot on" : "slot"} disabled={taken} onClick={() => setSlot(t)} aria-pressed={slot === t}>{t}</button>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="book-bar">
        <span><small>Consultation fee</small><strong>{money(doctor.fee)}</strong></span>
        <button className="btn-primary" disabled={!slot} onClick={confirm}>{slot ? `Book for ${slot}` : "Book appointment"}</button>
      </footer>
    </div>
  );
}
