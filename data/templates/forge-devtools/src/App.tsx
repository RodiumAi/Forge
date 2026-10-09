import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Compare from "./components/Compare";
import Integrations from "./components/Integrations";
import OpenSource from "./components/OpenSource";
import Testimonials from "./components/Testimonials";
import Cta from "./components/Cta";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="page">
        <Nav />
        <Hero />
        <Features />
        <Compare />
        <Integrations />
        <OpenSource />
        <Testimonials />
        <Cta />
        <Footer />
      </div>
    </div>
  );
}
