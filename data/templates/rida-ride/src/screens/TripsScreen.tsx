import "../styles/trips.css";
import ListRow from "../components/ListRow";
import { TRIPS } from "../data";

export default function TripsScreen() {
  return (
    <main className="app-main trips-screen">
      <section className="card">
        {TRIPS.map((t) => (
          <ListRow
            key={t.from + t.date}
            avaClass="route-ava"
            icon={<><i className="r-dot" /><i className="r-line" /><i className="r-pin" /></>}
            title={`${t.from} → ${t.to}`}
            sub={t.date}
          >
            <span className="trip-right">
              <span className="amount">{t.fare}</span>
              <span className={"status " + (t.up ? "up" : t.status === "Cancelled" ? "off" : "done")}>{t.status}</span>
            </span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}
