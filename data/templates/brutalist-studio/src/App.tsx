import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Services from "./components/Services";
import Work from "./components/Work";
import Shout from "./components/Shout";
import Process from "./components/Process";
import Faq from "./components/Faq";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <main id="top">
        <Hero />
        <Marquee />
        <Services />
        <Work />
        <Shout />
        <Process />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
