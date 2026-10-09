import { ArrowRight } from "lucide-react";
import { categories } from "../data";

export default function Categories() {
  return (
    <section className="cats">
      {categories.map((c) => (
        <a key={c.label} className="cat-tile" href="#shop" style={{ background: c.g }}>
          <img src={c.img} alt={c.alt} loading="lazy" />
          <h2>{c.label}</h2>
          <span>Shop now <ArrowRight className="cat-arrow" aria-hidden="true" /></span>
        </a>
      ))}
    </section>
  );
}
