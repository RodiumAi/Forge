import Topbar from "./components/Topbar";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import Program from "./components/Program";
import Manifesto from "./components/Manifesto";
import Speakers from "./components/Speakers";
import Venue from "./components/Venue";
import Tickets from "./components/Tickets";
import Newsletter from "./components/Newsletter";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Topbar />
      <Hero />
      <Stats />
      <Program />
      <Manifesto />
      <Speakers />
      <Venue />
      <Tickets />
      <Newsletter />
      <Footer />
    </div>
  );
}
