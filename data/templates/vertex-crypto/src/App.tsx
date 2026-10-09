import Backdrop from "./components/Backdrop";
import TickerBar from "./components/TickerBar";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import Markets from "./components/Markets";
import Features from "./components/Features";
import Security from "./components/Security";
import Cta from "./components/Cta";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Backdrop />
      <TickerBar />
      <Nav />
      <main id="top">
        <Hero />
        <Stats />
        <Markets />
        <Features />
        <Security />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
