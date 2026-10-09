import "../styles/explore.css";
import CategoryChips from "../components/CategoryChips";
import ListRow from "../components/ListRow";
import { EXPLORE } from "../data";

export default function ExploreScreen() {
  return (
    <main className="app-main explore-screen">
      <CategoryChips />
      <section className="card">
        {EXPLORE.map((t) => (
          <ListRow key={t.name} icon={t.icon} title={t.name} sub={t.teacher}>
            <span className="dur">{t.mins}</span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}
