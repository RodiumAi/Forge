import "../styles/rooms.css";
import { ArrowUpRight, Droplets, Thermometer } from "lucide-react";
import { Link } from "react-router-dom";
import { useHome } from "../components/HomeState";
import { ROOMS } from "../data";

export default function RoomsScreen() {
  const { devices } = useHome();
  const [first, ...rest] = ROOMS;
  const count = (room: string) => {
    const list = devices.filter((d) => d.room === room);
    return { total: list.length, on: list.filter((d) => d.on).length };
  };

  return (
    <main className="app-main rooms-screen">
      <p className="muted intro">{ROOMS.length} rooms, {devices.length} devices, {devices.filter((d) => d.on).length} running now.</p>

      <Link to={`/room/${first.id}`} className="room-card big">
        <img src={first.photo} alt="" />
        <div className="rc-body">
          <span className="rc-count glass">{count(first.id).on} of {count(first.id).total} on</span>
          <div className="rc-foot">
            <div>
              <h2>{first.name}</h2>
              <p><Thermometer size={14} strokeWidth={2} aria-hidden /> {first.temp}° <Droplets size={14} strokeWidth={2} aria-hidden /> {first.humidity}%</p>
            </div>
            <span className="rc-go"><ArrowUpRight size={20} strokeWidth={2} aria-hidden /></span>
          </div>
        </div>
      </Link>

      <div className="room-grid">
        {rest.map((r) => {
          const c = count(r.id);
          return (
            <Link key={r.id} to={`/room/${r.id}`} className="room-card">
              <img src={r.photo} alt="" />
              <div className="rc-body">
                <span className={c.on ? "rc-dot on" : "rc-dot"} aria-hidden />
                <div className="rc-foot">
                  <div>
                    <h2>{r.name}</h2>
                    <p>{c.total} devices, {r.temp}°</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
