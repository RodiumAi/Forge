import "../styles/destination.css";
import { ArrowLeft, Clock, Heart, Hotel, MapPin, Plane, Star } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useFavorites } from "../components/Favorites";
import { byId, euro } from "../data";

/** Stack screen (no tab bar): hero photo, story, highlights, gallery, price and Book. */
export default function DestinationScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const d = byId(id);
  const { has, toggle } = useFavorites();
  if (!d) return <Navigate to="/" replace />;
  const saved = has(d.id);

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  return (
    <div className="app-shell destination-screen">
      <header className="hero">
        <img src={d.photo} alt="" />
        <div className="hero-bar">
          <button className="glass-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2.2} aria-hidden /></button>
          <button className={saved ? "glass-btn saved" : "glass-btn"} onClick={() => toggle(d.id)} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"}>
            <Heart size={20} strokeWidth={2.2} fill={saved ? "currentColor" : "none"} aria-hidden />
          </button>
        </div>
        <div className="hero-text">
          <span className="hero-place"><MapPin size={14} strokeWidth={2.4} aria-hidden /> {d.country}</span>
          <h1>{d.name}</h1>
        </div>
      </header>

      <div className="sheet">
        <div className="facts">
          <span><Star size={15} strokeWidth={2.4} fill="currentColor" aria-hidden /><strong>{d.rating}</strong> {d.reviews.toLocaleString("en-US")} reviews</span>
          <span><Plane size={15} strokeWidth={2.2} aria-hidden /> {d.flight}</span>
          <span><Clock size={15} strokeWidth={2.2} aria-hidden /> 5 nights ideal</span>
        </div>

        <p className="story">{d.description}</p>

        <section>
          <h2>Highlights</h2>
          <div className="highlights">
            {d.highlights.map((h) => <span key={h}>{h}</span>)}
          </div>
        </section>

        <section>
          <h2>Gallery</h2>
          <div className="gallery">
            {d.gallery.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}
          </div>
        </section>

        <section className="stay">
          <span className="stay-icon"><Hotel size={20} strokeWidth={2} aria-hidden /></span>
          <span><strong>{d.stay}</strong><span>Breakfast included, free cancellation</span></span>
        </section>
      </div>

      <footer className="book-bar">
        <p className="price"><strong>{euro(d.price)}</strong><span>per night</span></p>
        <Link to={`/booking/${d.id}`} className="btn-primary">Book now</Link>
      </footer>
    </div>
  );
}
