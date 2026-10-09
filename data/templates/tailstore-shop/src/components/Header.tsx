import { ShoppingBag } from "lucide-react";

export default function Header() {
  return (
    <header className="header">
      <span className="logo">Verano&amp;Co</span>
      <nav>
        <a href="#shop">Home</a>
        <a href="#shop">Men</a>
        <a href="#shop">Women</a>
        <a href="#shop">Accessories</a>
      </nav>
      <button className="cart" aria-label="Cart">
        <span className="cart-icon"><ShoppingBag aria-hidden="true" /></span> Cart <span className="badge">3</span>
      </button>
    </header>
  );
}
