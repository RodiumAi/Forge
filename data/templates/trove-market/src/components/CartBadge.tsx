/* Orange count bubble on the cart icons (navbar + tab bar). Hidden when the cart is empty. */
export default function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="badge">{count}</span>;
}
