import ProductCard from "./ProductCard";
import type { Product } from "../data";

type Props = { id?: string; title: string; products: Product[] };

export default function ProductGrid({ id, title, products }: Props) {
  return (
    <section className="grid-section" id={id}>
      <h2>{title}</h2>
      <div className="grid">
        {products.map((p) => <ProductCard key={p.name} p={p} />)}
      </div>
    </section>
  );
}
