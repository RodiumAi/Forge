import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Logos from "./components/Logos";
import Gallery from "./components/Gallery";
import Features from "./components/Features";
import Pricing from "./components/Pricing";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="container">
        <Nav />
        <Hero />
        <Logos />
        <Gallery />
        <Features />
        <Pricing />
        <Footer />
      </div>
    </div>
  );
}
