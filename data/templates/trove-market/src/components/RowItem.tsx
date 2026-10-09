import type { ReactNode } from "react";
import type { Product } from "../data";

type Props = {
  product?: Product;
  icon?: ReactNode;
  title: string;
  sub: ReactNode;
  children: ReactNode;
};

/* List line: product thumbnail (or tinted icon tile), title + subline, trailing slot.
   Used by Search, Cart and Account. */
export default function RowItem({ product, icon, title, sub, children }: Props) {
  return (
    <div className="row-item">
      {product ? (
        <span className="ava" style={{ backgroundImage: product.grad }}><img src={product.img} alt="" loading="lazy" /></span>
      ) : (
        <span className="ava tint" aria-hidden>{icon}</span>
      )}
      <span className="meta"><strong>{title}</strong>{sub}</span>
      {children}
    </div>
  );
}
