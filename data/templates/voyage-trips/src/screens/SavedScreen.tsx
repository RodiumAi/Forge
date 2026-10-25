import "../styles/saved.css";
import { Compass, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import DestinationCard from "../components/DestinationCard";
import { useFavorites } from "../components/Favorites";
import { byId, euro, type Destination } from "../data";

export default function SavedScreen() {
  const { ids } = useFavorites();
  const saved = ids.map(byId).filter((d): d is Destination => Boolean(d));
  const avg = saved.length ? Math.round(saved.reduce((s, d) => s + d.price, 0) / saved.length) : 0;

  return (
    <main className="app-main saved-screen">
      <p className="summary">
        <strong>{saved.length}</strong> {saved.length === 1 ? "place" : "places"} saved
        {saved.length > 0 && <span> · avg. {euro(avg)} a night</span>}
      </p>

      {saved.length ? (
        <div className="grid">
          {saved.map((d) => <DestinationCard key={d.id} d={d} size="grid" />)}
        </div>
      ) : (
        <div className="empty">
          <span className="empty-mark"><Heart size={30} strokeWidth={2} aria-hidden /></span>
          <h2>Nothing saved <em>yet</em></h2>
          <p className="muted">Tap the heart on any destination and it lands here, ready for later.</p>
          <Link to="/" className="btn-primary"><Compass size={18} strokeWidth={2.2} aria-hidden /> Start exploring</Link>
        </div>
      )}
    </main>
  );
}
