import "../styles/home.css";
import { ChevronRight, Droplets, Film, LockKeyhole, Moon, Plane, Sun, Sunset, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import DeviceTile from "../components/DeviceTile";
import { useHome } from "../components/HomeState";
import { HERO_PHOTO, HOME, ROOMS, SCENES, type SceneId } from "../data";

const SCENE_ICONS: Record<SceneId, typeof Sun> = { evening: Sunset, movie: Film, away: Plane, night: Moon };
const MODE_LABEL = { heat: "Heating to", cool: "Cooling to", auto: "Holding" } as const;

export default function HomeScreen() {
  const { devices, scene, setScene, target, mode } = useHome();
  const living = ROOMS[0];
  const onCount = devices.filter((d) => d.on).length;
  const favourites = devices.filter((d) => ["d1", "d2", "d4", "d6", "d8", "d10"].includes(d.id));

  return (
    <main className="app-main home-screen">
      <div className="backdrop" aria-hidden>
        <img src={HERO_PHOTO} alt="" />
      </div>

      <Link to="/climate" className="climate-hero glass">
        <div className="ch-top">
          <span className="kicker">{living.name}</span>
          <span className="ch-go"><ChevronRight size={18} strokeWidth={2} aria-hidden /></span>
        </div>
        <p className="ch-temp">{target.toFixed(1)}<sup>°C</sup></p>
        <p className="ch-mode"><span className={`mode-dot ${mode}`} />{MODE_LABEL[mode]} {target.toFixed(1)}°, room at {living.temp}°</p>
        <div className="ch-stats">
          <span><Droplets size={15} strokeWidth={2} aria-hidden /> {living.humidity}%</span>
          <span><Sun size={15} strokeWidth={2} aria-hidden /> {HOME.outside}° outside</span>
        </div>
      </Link>

      <section className="pulse" aria-label="Home status">
        <div className="glass"><strong>{onCount}</strong><span>Devices on</span></div>
        <div className="glass"><LockKeyhole size={18} strokeWidth={2} aria-hidden /><span>Door locked</span></div>
        <div className="glass"><Zap size={18} strokeWidth={2} aria-hidden /><span>68% solar</span></div>
      </section>

      <section>
        <div className="section-head"><h2>Scenes</h2><span className="muted">Tap to apply</span></div>
        <div className="chips" role="radiogroup" aria-label="Scene">
          {SCENES.map(({ id, label }) => {
            const Icon = SCENE_ICONS[id];
            return (
              <button key={id} role="radio" aria-checked={scene === id} className={scene === id ? "chip on" : "chip"} onClick={() => setScene(id)}>
                <Icon size={17} strokeWidth={2} aria-hidden /> {label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Favourites</h2><Link to="/rooms" className="link">All rooms</Link></div>
        <div className="devices">
          {favourites.map((d) => (
            <DeviceTile key={d.id} device={d} roomName={ROOMS.find((r) => r.id === d.room)?.name} />
          ))}
        </div>
      </section>
    </main>
  );
}
