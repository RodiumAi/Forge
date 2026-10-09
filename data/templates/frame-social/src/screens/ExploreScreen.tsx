import "../styles/explore.css";
import { EXPLORE } from "../data";
import PhotoCell from "../components/PhotoCell";

export default function ExploreScreen() {
  return (
    <main className="app-main explore-screen">
      <div className="search" aria-hidden>Search people, places, tags</div>
      <div className="grid explore-grid">
        {EXPLORE.map((id, i) => (
          <PhotoCell key={id + i} id={id} index={i} w={500} tall={i % 5 === 0} />
        ))}
      </div>
    </main>
  );
}
