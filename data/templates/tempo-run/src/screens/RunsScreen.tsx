import "../styles/runs.css";
import { RUNS } from "../data";
import RouteThumb from "../components/RouteThumb";

export default function RunsScreen() {
  return (
    <main className="app-main runs-screen">
      <section className="card runs-list">
        {RUNS.map((r) => (
          <div className="runrow" key={r.name}>
            <RouteThumb seed={r.seed} small />
            <span className="meta">
              <strong>{r.name}</strong>
              <span>{r.when}</span>
            </span>
            <span className="runstat">
              <b>{r.km} km</b>
              <span>{r.pace} /km</span>
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
