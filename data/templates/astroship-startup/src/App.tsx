import Topbar from "./components/Topbar";
import Hero from "./components/Hero";
import Logos from "./components/Logos";
import Features from "./components/Features";
import Cta from "./components/Cta";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Topbar />
      <Hero />
      <Logos />
      <Features />
      <Cta />
      <Footer />
    </div>
  );
}
