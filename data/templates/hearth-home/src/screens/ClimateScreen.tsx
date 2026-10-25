import "../styles/climate.css";
import { ArrowLeft, Droplets, Fan, Flame, Minus, Plus, Snowflake, Sun, Wind } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHome, type ClimateMode } from "../components/HomeState";
import ThermostatDial from "../components/ThermostatDial";
import { HOME, ROOMS } from "../data";

const MODES: { id: ClimateMode; label: string; icon: typeof Sun }[] = [
  { id: "heat", label: "Heat", icon: Flame },
  { id: "cool", label: "Cool", icon: Snowflake },
  { id: "auto", label: "Auto", icon: Wind },
];

const VERB = { heat: "Heating to", cool: "Cooling to", auto: "Holding at" } as const;

const SCHEDULE = [
  { time: "06:30", label: "Wake up", temp: 23 },
  { time: "09:00", label: "Out for work", temp: 26 },
  { time: "18:30", label: "Back home", temp: 22.5 },
  { time: "22:30", label: "Sleep", temp: 21 },
];

/** Stack screen (no tab bar): thermostat dial, mode, humidity and schedule. */
export default function ClimateScreen() {
  const navigate = useNavigate();
  const { target, setTarget, mode, setMode } = useHome();
  const [roomId, setRoomId] = useState(ROOMS[0].id);
  const [fan, setFan] = useState(2);
  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0];

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  return (
    <div className={`app-shell climate-screen ${mode}`}>
      <header className="climate-bar">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2} aria-hidden /></button>
        <h1>Climate</h1>
        <span className="bar-space" aria-hidden />
      </header>

      <div className="chips rooms" role="radiogroup" aria-label="Room">
        {ROOMS.slice(0, 4).map((r) => (
          <button key={r.id} role="radio" aria-checked={roomId === r.id} className={roomId === r.id ? "chip on" : "chip"} onClick={() => setRoomId(r.id)}>{r.name}</button>
        ))}
      </div>

      <section className="dial-wrap">
        <div className="dial-glow" aria-hidden />
        <ThermostatDial target={target} current={room.temp} mode={mode} />
        <div className="dial-center">
          <p className="dc-label">{VERB[mode]}</p>
          <p className="dc-temp">{target.toFixed(1)}<sup>°</sup></p>
          <p className="dc-now">Room at {room.temp}°</p>
        </div>
        <div className="dial-scale" aria-hidden><span>16°</span><span>30°</span></div>
      </section>

      <div className="steppers">
        <button className="step" onClick={() => setTarget(target - 0.5)} aria-label="Lower by half a degree"><Minus size={24} strokeWidth={2} aria-hidden /></button>
        <div className="modes" role="radiogroup" aria-label="Mode">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} role="radio" aria-checked={mode === id} className={mode === id ? `mode on ${id}` : "mode"} onClick={() => setMode(id)}>
              <Icon size={18} strokeWidth={2} aria-hidden /><span>{label}</span>
            </button>
          ))}
        </div>
        <button className="step" onClick={() => setTarget(target + 0.5)} aria-label="Raise by half a degree"><Plus size={24} strokeWidth={2} aria-hidden /></button>
      </div>

      <section className="facts">
        <div className="fact">
          <span className="f-icon"><Droplets size={18} strokeWidth={2} aria-hidden /></span>
          <strong>{room.humidity}%</strong><span>Humidity</span>
          <i className="f-bar" aria-hidden><b style={{ width: `${room.humidity}%` }} /></i>
        </div>
        <div className="fact">
          <span className="f-icon"><Sun size={18} strokeWidth={2} aria-hidden /></span>
          <strong>{HOME.outside}°</strong><span>Outside, sunny</span>
        </div>
        <button className="fact" onClick={() => setFan((f) => (f % 3) + 1)} aria-label={`Fan speed ${fan}, tap to change`}>
          <span className="f-icon"><Fan size={18} strokeWidth={2} aria-hidden /></span>
          <strong>Speed {fan}</strong><span>Fan, tap to change</span>
        </button>
      </section>

      <section className="card schedule">
        <div className="section-head"><h2>Today's schedule</h2><span className="muted">Weekdays</span></div>
        <ul>
          {SCHEDULE.map((s) => (
            <li key={s.time}>
              <span className="s-time">{s.time}</span>
              <span className="s-label">{s.label}</span>
              <span className="s-temp">{s.temp}°</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
