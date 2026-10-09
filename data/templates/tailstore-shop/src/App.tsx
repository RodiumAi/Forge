import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import ProductGrid from "./components/ProductGrid";
import Promo from "./components/Promo";
import Footer from "./components/Footer";
import { latest, popular } from "./data";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="page">
        <Header />
        <Hero />
        <Categories />
        <ProductGrid id="shop" title="Popular products" products={popular} />
        <Promo />
        <ProductGrid title="Latest arrivals" products={latest} />
        <Footer />
      </div>
    </div>
  );
}
