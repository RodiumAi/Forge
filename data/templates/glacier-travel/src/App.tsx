import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Destinations from "./components/Destinations";
import Stats from "./components/Stats";
import Itinerary from "./components/Itinerary";
import Guides from "./components/Guides";
import Booking from "./components/Booking";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <Destinations />
      <Stats />
      <Itinerary />
      <Guides />
      <Booking />
      <Footer />
    </div>
  );
}
