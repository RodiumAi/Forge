import Nav from "./components/Nav";
import Hero from "./components/Hero";
import StatsBand from "./components/StatsBand";
import Programs from "./components/Programs";
import Results from "./components/Results";
import Coaches from "./components/Coaches";
import Plans from "./components/Plans";
import Schedule from "./components/Schedule";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <StatsBand />
      <Programs />
      <Results />
      <Coaches />
      <Plans />
      <Schedule />
      <FinalCta />
      <Footer />
    </div>
  );
}
