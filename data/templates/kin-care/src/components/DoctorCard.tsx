import { Heart, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { money, specialtyOf, type Doctor } from "../data";
import { useCare } from "./CareState";

/** Doctor row: portrait, name, specialty chip, rating, distance and fee, favourite toggle. */
export default function DoctorCard({ doctor }: { doctor: Doctor }) {
  const { favourites, toggleFavourite } = useCare();
  const fav = favourites.includes(doctor.id);
  const spec = specialtyOf(doctor.specialty);

  return (
    <li className="doc-card">
      <Link to={`/doctor/${doctor.id}`} className="doc-link">
        <span className="doc-photo"><img src={doctor.photo} alt="" />{doctor.today && <i className="online" aria-label="Available today" />}</span>
        <span className="doc-body">
          <strong>{doctor.name}</strong>
          <span className="spec-chip" style={{ background: spec.tint }}>{doctor.title}</span>
          <span className="doc-meta">
            <span className="rating"><Star size={13} strokeWidth={0} fill="currentColor" aria-hidden /> {doctor.rating.toFixed(1)}</span>
            <span>({doctor.reviews})</span>
            <span className="dot" aria-hidden />
            <span><MapPin size={12} strokeWidth={2.2} aria-hidden /> {doctor.distance}</span>
          </span>
          <span className="fee">{money(doctor.fee)}</span>
        </span>
      </Link>
      <button className={fav ? "fav on" : "fav"} onClick={() => toggleFavourite(doctor.id)} aria-pressed={fav} aria-label={fav ? "Remove from favourites" : "Add to favourites"}>
        <Heart size={18} strokeWidth={2.2} fill={fav ? "currentColor" : "none"} aria-hidden />
      </button>
    </li>
  );
}
