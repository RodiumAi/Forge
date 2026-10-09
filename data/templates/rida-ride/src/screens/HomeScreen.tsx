import "../styles/home.css";
import { CarFront, Search } from "lucide-react";
import BoltIcon from "../components/BoltIcon";
import MapLayers from "../components/MapLayers";
import { RIDES, type RideId } from "../data";

type Props = { ride: RideId; onRide: (id: RideId) => void };

export default function HomeScreen({ ride, onRide }: Props) {
  return (
    <main className="app-main home-screen">
      <div className="ride-screen">
        <div className="map" aria-hidden>
          <MapLayers routeClass="map-route" viewBox="0 0 340 260" path="M46 214 C 96 170, 120 176, 150 132 S 214 66, 292 44" />
          <span className="map-car"><CarFront size={24} strokeWidth={1.7} aria-hidden /></span>
        </div>

        <div className="ride-sheet">
          <span className="grabber" aria-hidden />
          <button className="wa-field">
            <span className="wa-ic"><Search size={20} strokeWidth={1.9} aria-hidden /></span>
            <span className="wa-text">Where to?</span>
            <span className="wa-tag">Now</span>
          </button>

          <p className="sheet-lbl">Choose a ride</p>
          <div className="rides">
            {RIDES.map((r) => (
              <button
                key={r.id}
                className={ride === r.id ? "ride-opt sel" : "ride-opt"}
                aria-pressed={ride === r.id}
                onClick={() => onRide(r.id)}
              >
                <span className="ride-glyph"><r.icon size={24} strokeWidth={1.7} aria-hidden /></span>
                <span className="ride-meta">
                  <strong>{r.name}</strong>
                  <span>{r.desc} · {r.eta} away</span>
                </span>
                <span className="ride-price">{r.price}<small>CFA</small></span>
              </button>
            ))}
          </div>

          <button className="btn-primary book"><BoltIcon /> Book ride</button>
        </div>
      </div>
    </main>
  );
}
