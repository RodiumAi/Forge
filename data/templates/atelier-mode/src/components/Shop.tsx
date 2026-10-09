import { ArrowRight } from "lucide-react";
import { products } from "../data";

export default function Shop() {
  return (
    <section className="shop" id="collection">
      <div className="section-head">
        <p className="kicker">The Collection</p>
        <h2>Pieces of the Season</h2>
        <p className="section-sub">Each garment is numbered, signed by its première main, and delivered in the maison's linen box.</p>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <article className="product" key={p.name}>
            <div className="product-media">
              <img src={p.img} alt={p.name} loading="lazy" />
              <span className="product-hover">
                View piece <ArrowRight size={11} aria-hidden="true" />
              </span>
            </div>
            <div className="product-info">
              <h3>{p.name}</h3>
              <p className="product-fabric">{p.fabric}</p>
              <p className="product-price">{p.price}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="shop-more">
        <a href="#collection" className="btn-line">View all 22 pieces</a>
      </div>
    </section>
  );
}
