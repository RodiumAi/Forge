import { Search, SearchX, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import DoctorCard from "../components/DoctorCard";
import { DOCTORS, SPECIALTIES } from "../data";
import "../styles/doctors.css";

export default function DoctorsScreen() {
  const initial = (useLocation().state as { specialty?: string } | null)?.specialty ?? "all";
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState(initial);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCTORS.filter((d) =>
      (spec === "all" || d.specialty === spec) &&
      (!q || d.name.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.clinic.toLowerCase().includes(q)),
    );
  }, [query, spec]);

  return (
    <main className="app-main doctors-screen">
      <label className="field">
        <Search size={19} strokeWidth={2.2} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, specialty or clinic" aria-label="Search doctors" />
        {query && (
          <button className="clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} strokeWidth={2.4} aria-hidden /></button>
        )}
      </label>

      <div className="chips" role="tablist" aria-label="Specialty">
        <button className={spec === "all" ? "chip on" : "chip"} onClick={() => setSpec("all")} role="tab" aria-selected={spec === "all"}>All</button>
        {SPECIALTIES.map(({ id, label, icon: Icon }) => (
          <button key={id} className={spec === id ? "chip on" : "chip"} onClick={() => setSpec(id)} role="tab" aria-selected={spec === id}>
            <Icon size={16} strokeWidth={2.2} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <p className="count">{list.length} {list.length === 1 ? "doctor" : "doctors"} near Cotonou</p>

      {list.length ? (
        <ul className="doc-list">
          {list.map((d) => <DoctorCard key={d.id} doctor={d} />)}
        </ul>
      ) : (
        <div className="empty">
          <span><SearchX size={26} strokeWidth={2} aria-hidden /></span>
          <strong>No doctor found</strong>
          <p className="muted">Try another name or pick a different specialty.</p>
          <button className="link" onClick={() => { setQuery(""); setSpec("all"); }}>Reset filters</button>
        </div>
      )}
    </main>
  );
}
