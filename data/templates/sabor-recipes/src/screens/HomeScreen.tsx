import "../styles/home.css";
import { Clock, Flame } from "lucide-react";
import { CATEGORIES, HERO, RECIPES } from "../data";
import ChipRow from "../components/ChipRow";
import RecipeRow from "../components/RecipeRow";

type Props = { cat: string; onCat: (cat: string) => void; onSeeAll: () => void };

export default function HomeScreen({ cat, onCat, onSeeAll }: Props) {
  return (
    <main className="app-main home-screen">
      <article className="hero">
        <img src={HERO} alt="" />
        <div className="hero-scrim" aria-hidden />
        <div className="hero-body">
          <span className="eyebrow">Featured tonight</span>
          <h2>Smoky Tomato Shakshuka</h2>
          <div className="hero-pills">
            <span className="pill"><Clock size={16} strokeWidth={1.8} aria-hidden /> 25 min</span>
            <span className="pill soft"><Flame size={16} strokeWidth={1.7} aria-hidden /> Easy</span>
          </div>
        </div>
      </article>

      <ChipRow items={CATEGORIES} value={cat} label="Categories" onChange={onCat} />

      <div className="section-head"><h2>Popular this week</h2><a href="#" onClick={(e) => { e.preventDefault(); onSeeAll(); }}>See all</a></div>
      <section className="card list">
        {RECIPES.map((r) => <RecipeRow key={r.name} r={r} />)}
      </section>
    </main>
  );
}
