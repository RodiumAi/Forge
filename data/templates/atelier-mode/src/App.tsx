import Announce from "./components/Announce";
import Topbar from "./components/Topbar";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Lookbook from "./components/Lookbook";
import Shop from "./components/Shop";
import Heritage from "./components/Heritage";
import Services from "./components/Services";
import Journal from "./components/Journal";
import Newsletter from "./components/Newsletter";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Announce />
      <Topbar />
      <Hero />
      <Marquee />
      <Lookbook />
      <Shop />
      <Heritage />
      <Services />
      <Journal />
      <Newsletter />
      <Footer />
    </div>
  );
}
