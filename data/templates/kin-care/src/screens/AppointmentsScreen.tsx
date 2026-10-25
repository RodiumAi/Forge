import { Building2, CalendarPlus, Clock, FileText, RotateCcw, Star, Video, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCare } from "../components/CareState";
import { doctorById, type Appointment } from "../data";
import "../styles/appointments.css";

type View = "upcoming" | "past";

function Row({ a, past, onCancel }: { a: Appointment; past?: boolean; onCancel?: () => void }) {
  const doctor = doctorById(a.doctorId);
  if (!doctor) return null;
  const video = a.kind === "video";
  return (
    <li className={past ? "appt past" : "appt"}>
      <div className="appt-top">
        <span className="date"><small>{a.month}</small><strong>{a.date}</strong><small>{a.day}</small></span>
        <Link to={`/doctor/${doctor.id}`} className="who">
          <img src={doctor.photo} alt="" />
          <span>
            <strong>{doctor.name}</strong>
            <small>{doctor.title}</small>
          </span>
        </Link>
      </div>
      <div className="appt-meta">
        <span><Clock size={15} strokeWidth={2.2} aria-hidden /> {a.time}</span>
        <span className={video ? "kind video" : "kind"}>
          {video ? <Video size={15} strokeWidth={2.2} aria-hidden /> : <Building2 size={15} strokeWidth={2.2} aria-hidden />}
          {video ? "Video call" : "In clinic"}
        </span>
      </div>
      {a.note && <p className="note">{a.note}</p>}
      <div className="appt-actions">
        {past ? (
          <>
            <button className="ghost"><FileText size={16} strokeWidth={2.2} aria-hidden /> Prescription</button>
            <Link to={`/doctor/${doctor.id}`} className="solid"><RotateCcw size={16} strokeWidth={2.2} aria-hidden /> Book again</Link>
          </>
        ) : (
          <>
            <button className="ghost" onClick={onCancel}><X size={16} strokeWidth={2.4} aria-hidden /> Cancel</button>
            {video ? (
              <button className="solid"><Video size={16} strokeWidth={2.2} aria-hidden /> Join call</button>
            ) : (
              <button className="solid">Get directions</button>
            )}
          </>
        )}
      </div>
      {past && (
        <p className="rated"><Star size={14} strokeWidth={0} fill="currentColor" aria-hidden /> You rated this visit 5.0</p>
      )}
    </li>
  );
}

export default function AppointmentsScreen() {
  const { upcoming, past, cancel } = useCare();
  const [view, setView] = useState<View>("upcoming");
  const list = view === "upcoming" ? upcoming : past;

  return (
    <main className="app-main appointments-screen">
      <div className="segmented" role="tablist" aria-label="Appointments">
        <button className={view === "upcoming" ? "on" : ""} onClick={() => setView("upcoming")} role="tab" aria-selected={view === "upcoming"}>
          Upcoming <span className="badge">{upcoming.length}</span>
        </button>
        <button className={view === "past" ? "on" : ""} onClick={() => setView("past")} role="tab" aria-selected={view === "past"}>Past</button>
      </div>

      {list.length ? (
        <ul className="appts">
          {list.map((a) => <Row key={a.id} a={a} past={view === "past"} onCancel={() => cancel(a.id)} />)}
        </ul>
      ) : (
        <div className="empty">
          <span><CalendarPlus size={26} strokeWidth={2} aria-hidden /></span>
          <strong>Nothing planned yet</strong>
          <p className="muted">Book a visit and it will show up here with a reminder the day before.</p>
          <Link to="/doctors" className="btn-primary">Find a doctor</Link>
        </div>
      )}
    </main>
  );
}
