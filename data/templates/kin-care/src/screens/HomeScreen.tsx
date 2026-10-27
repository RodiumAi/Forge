import { CalendarDays, ChevronRight, Clock, Footprints, HeartPulse, MoonStar, Search, SlidersHorizontal, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import DoctorCard from "../components/DoctorCard";
import PulseLine from "../components/PulseLine";
import { useCare } from "../components/CareState";
import { DOCTORS, SPECIALTIES, VITALS, doctorById } from "../data";
import "../styles/home.css";

const SLEEP_BARS = [62, 78, 54, 88, 70, 92, 80];

export default function HomeScreen() {
  const { upcoming } = useCare();
  const next = upcoming[0];
  const doctor = next ? doctorById(next.doctorId) : undefined;
  const stepsPct = Math.round((VITALS.steps / VITALS.stepsGoal) * 100);
  const top = DOCTORS.filter((d) => d.rating >= 4.8).slice(0, 3);

  return (
    <main className="app-main home-screen">
      <Link to="/doctors" className="search">
        <Search size={19} strokeWidth={2.2} aria-hidden />
        <span>Search doctors, specialties</span>
        <i aria-hidden><SlidersHorizontal size={17} strokeWidth={2.2} /></i>
      </Link>

      {next && doctor ? (
        <section className="hero" aria-label="Next appointment">
          <div className="hero-head">
            <span className="hero-kicker">Next appointment</span>
            <span className="hero-kind">{next.kind === "video" ? "Video call" : "In clinic"}</span>
          </div>
          <Link to={`/doctor/${doctor.id}`} className="hero-doc">
            <img src={doctor.photo} alt="" />
            <span>
              <strong>{doctor.name}</strong>
              <small>{doctor.title}, {next.note ?? "Consultation"}</small>
            </span>
            <ChevronRight size={20} strokeWidth={2.2} aria-hidden />
          </Link>
          <div className="hero-when">
            <span><CalendarDays size={16} strokeWidth={2.2} aria-hidden /> {next.day}, {next.date} {next.month}</span>
            <span><Clock size={16} strokeWidth={2.2} aria-hidden /> {next.time}</span>
          </div>
          {next.kind === "video" ? (
            <button className="hero-cta"><Video size={18} strokeWidth={2.2} aria-hidden /> Join video call</button>
          ) : (
            <Link to="/appointments" className="hero-cta">See details</Link>
          )}
        </section>
      ) : (
        <section className="hero empty">
          <strong>No visit planned</strong>
          <p>Find a doctor and book in two taps.</p>
          <Link to="/doctors" className="hero-cta">Find a doctor</Link>
        </section>
      )}

      <section>
        <div className="section-head"><h2>Today's vitals</h2><span className="muted small">Synced 8:12</span></div>
        <div className="vitals">
          <article className="vital heart">
            <span className="v-icon"><HeartPulse size={17} strokeWidth={2.2} aria-hidden /></span>
            <PulseLine />
            <strong>{VITALS.heart}<small> bpm</small></strong>
            <span className="v-label">Heart rate</span>
          </article>
          <article className="vital sleep">
            <span className="v-icon"><MoonStar size={17} strokeWidth={2.2} aria-hidden /></span>
            <div className="bars" aria-hidden>
              {SLEEP_BARS.map((h, i) => <i key={i} style={{ "--h": `${h}%` } as CSSProperties} />)}
            </div>
            <strong>{VITALS.sleep}</strong>
            <span className="v-label">Sleep</span>
          </article>
          <article className="vital steps">
            <span className="v-icon"><Footprints size={17} strokeWidth={2.2} aria-hidden /></span>
            <div className="meter" aria-hidden><i style={{ width: `${stepsPct}%` }} /></div>
            <strong>{VITALS.steps.toLocaleString("en-US")}</strong>
            <span className="v-label">{stepsPct}% of goal</span>
          </article>
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Specialties</h2><Link to="/doctors" className="link">See all</Link></div>
        <div className="specs">
          {SPECIALTIES.slice(0, 4).map(({ id, label, icon: Icon, tint }) => (
            <Link key={id} to="/doctors" state={{ specialty: id }} className="spec">
              <span style={{ background: tint }}><Icon size={22} strokeWidth={2} aria-hidden /></span>
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Top doctors</h2><Link to="/doctors" className="link">See all</Link></div>
        <ul className="doc-list">
          {top.map((d) => <DoctorCard key={d.id} doctor={d} />)}
        </ul>
      </section>
    </main>
  );
}
