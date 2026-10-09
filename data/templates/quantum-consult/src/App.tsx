import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Figures from "./components/Figures";
import Practices from "./components/Practices";
import Evidence from "./components/Evidence";
import Cases from "./components/Cases";
import Leadership from "./components/Leadership";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <Figures />
      <Practices />
      <Evidence />
      <Cases />
      <Leadership />
      <Contact />
      <Footer />
    </div>
  );
}
