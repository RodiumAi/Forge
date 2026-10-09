import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Work from "./components/Work";
import Services from "./components/Services";
import About from "./components/About";
import Press from "./components/Press";
import Process from "./components/Process";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="page">
        <div className="grain" aria-hidden="true" />
        <Nav />
        <Hero />
        <Work />
        <Services />
        <About />
        <Press />
        <Process />
        <Contact />
        <Footer />
      </div>
    </div>
  );
}
