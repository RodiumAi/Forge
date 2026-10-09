import "../styles/search.css";
import { Search } from "lucide-react";
import { CUISINES, SEARCH_RESULTS } from "../data";
import ChipRow from "../components/ChipRow";
import RecipeRow from "../components/RecipeRow";

type Props = {
  query: string;
  cuisine: string;
  onQuery: (query: string) => void;
  onCuisine: (cuisine: string) => void;
};

export default function SearchScreen({ query, cuisine, onQuery, onCuisine }: Props) {
  return (
    <main className="app-main search-screen">
      <label className="search">
        <Search size={22} strokeWidth={1.8} aria-hidden />
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search recipes, ingredients…" aria-label="Search recipes" />
      </label>
      <ChipRow items={CUISINES} value={cuisine} label="Cuisines" onChange={onCuisine} />
      <div className="section-head"><h2>{cuisine === "All" ? "Trending" : cuisine}</h2><span className="muted count">{SEARCH_RESULTS.length} results</span></div>
      <section className="card list">
        {SEARCH_RESULTS.map((r) => <RecipeRow key={r.name} r={r} />)}
      </section>
    </main>
  );
}
