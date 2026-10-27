import "../styles/room.css";
import { ArrowLeft, Droplets, Power, Thermometer } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import DeviceTile from "../components/DeviceTile";
import { useHome } from "../components/HomeState";
import { ROOM_SCENES, ROOMS } from "../data";

/** Stack screen (no tab bar): one room, its lights with dimmers, scenes and other devices. */
export default function RoomScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { devices, toggle, setLevel, dimRoom } = useHome();
  const [scene, setScene] = useState<string | null>(null);
  const room = ROOMS.find((r) => r.id === id);
  if (!room) return <Navigate to="/rooms" replace />;

  const list = devices.filter((d) => d.room === room.id);
  const lights = list.filter((d) => d.level !== undefined);
  const others = list.filter((d) => d.level === undefined);
  const onCount = list.filter((d) => d.on).length;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/rooms", { replace: true });
  }

  return (
    <div className="app-shell room-screen">
      <header className="room-hero">
        <img src={room.photo.replace("w=600", "w=900")} alt="" />
        <div className="rh-bar">
          <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2} aria-hidden /></button>
          <button className="icon-btn" onClick={() => lights.forEach((l) => l.on && toggle(l.id))} aria-label="All lights off"><Power size={19} strokeWidth={2} aria-hidden /></button>
        </div>
        <div className="rh-title">
          <p className="kicker">{onCount} of {list.length} devices on</p>
          <h1>{room.name}</h1>
          <div className="rh-stats">
            <Link to="/climate" className="glass"><Thermometer size={15} strokeWidth={2} aria-hidden /> {room.temp}°</Link>
            <span className="glass"><Droplets size={15} strokeWidth={2} aria-hidden /> {room.humidity}%</span>
          </div>
        </div>
      </header>

      <div className="room-body">
        <section>
          <div className="section-head"><h2>Scenes</h2></div>
          <div className="chips" role="radiogroup" aria-label="Room scene">
            {ROOM_SCENES.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={scene === s.id}
                className={scene === s.id ? "chip on" : "chip"}
                onClick={() => { setScene(s.id); dimRoom(room.id, s.level); }}
              >
                {s.label} <small>{s.level}%</small>
              </button>
            ))}
          </div>
        </section>

        {lights.length > 0 && (
          <section>
            <div className="section-head"><h2>Lights</h2><span className="muted">{lights.filter((l) => l.on).length} on</span></div>
            <div className="lights">
              {lights.map((l) => {
                const Icon = l.icon;
                const level = l.on ? l.level ?? 0 : 0;
                return (
                  <div key={l.id} className={l.on ? "light on" : "light"}>
                    <div className="light-top">
                      <button className="light-icon" onClick={() => toggle(l.id)} aria-pressed={l.on} aria-label={`${l.name} on or off`}>
                        <Icon size={20} strokeWidth={1.9} aria-hidden />
                      </button>
                      <span className="light-name"><strong>{l.name}</strong><span>{l.on ? "Warm white, 2700K" : "Off"}</span></span>
                      <span className="light-pct">{level}%</span>
                    </div>
                    <input
                      className="slider"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={level}
                      onChange={(e) => { setScene(null); setLevel(l.id, Number(e.target.value)); }}
                      aria-label={`${l.name} brightness`}
                      style={{ "--v": `${level}%` } as CSSProperties}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <div className="section-head"><h2>Devices</h2></div>
            <div className="devices">
              {others.map((d) => <DeviceTile key={d.id} device={d} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
