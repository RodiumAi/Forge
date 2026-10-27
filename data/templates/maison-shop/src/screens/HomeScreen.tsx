import "../styles/home.css";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { EDITORIAL, ME, PRODUCTS, productById } from "../data";

const NEW_IN = PRODUCTS.filter((p) => p.badge === "New" || p.category === "Dresses" || p.category === "Shoes");
const STORY = ["alba-coat", "noor-knit"].map((id) => productById(id));

export default function HomeScreen() {
  return (
    <main className="app-main home-screen">
      <p className="hello label">Good morning, {ME.first} · Free delivery over €200</p>

      <Link to="/product/alba-coat" className="cover">
        <img src={EDITORIAL.cover} alt="Model in a long camel coat" />
        <span className="cover-text">
          <span className="label">{EDITORIAL.issue}</span>
          <strong>{EDITORIAL.title}</strong>
          <span className="cover-cta">Read the edit <ArrowRight size={14} strokeWidth={1.6} aria-hidden /></span>
        </span>
      </Link>

      <section>
        <div className="section-head">
          <h2>New <em>in</em></h2>
          <Link to="/shop" className="text-link">View all</Link>
        </div>
        <div className="rail">
          {NEW_IN.map((p) => <ProductCard key={p.id} p={p} wide />)}
        </div>
      </section>

      <section className="story">
        <p className="label rust">The edit</p>
        <blockquote>{EDITORIAL.lede}</blockquote>
        <div className="story-grid">
          {EDITORIAL.story.map((src, i) => (
            <figure key={src} className={`frame f${i}`}>
              <img src={src} alt="" loading="lazy" />
            </figure>
          ))}
        </div>
        <ul className="shop-the-look">
          {STORY.map((p) => p && (
            <li key={p.id}>
              <Link to={`/product/${p.id}`}>
                <img src={p.images[0]} alt="" />
                <span><strong>{p.name}</strong><small>€{p.price}</small></span>
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="ateliers">
        <hr className="hair" />
        <div className="atelier-row">
          <span className="label">Made by</span>
          <p>Twelve independent ateliers in Portugal, Italy, France and Ghana. Every piece names its maker.</p>
        </div>
        <hr className="hair" />
      </section>
    </main>
  );
}
