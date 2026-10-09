import type { Product } from "../data";

export default function ProductCard({ p }: { p: Product }) {
  return (
    <article className="card">
      <div className="card-img" style={{ background: p.g }}>
        <img src={p.img} alt={p.alt} loading="lazy" />
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        <p className="cat">{p.cat}</p>
        <p className="price">
          <span>{p.price}</span>
          {p.old ? <s>{p.old}</s> : null}
        </p>
        <button className="btn btn-cart">Add to Cart</button>
      </div>
    </article>
  );
}
