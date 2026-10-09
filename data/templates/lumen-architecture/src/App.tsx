import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Strip from "./components/Strip";
import Work from "./components/Work";
import Philosophy from "./components/Philosophy";
import Services from "./components/Services";
import Studio from "./components/Studio";
import Press from "./components/Press";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <Strip />
      <Work />
      <Philosophy />
      <Services />
      <Studio />
      <Press />
      <Contact />
      <Footer />
    </div>
  );
}
