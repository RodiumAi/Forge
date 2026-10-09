import { useState } from "react";
import Topbar from "./components/Topbar";
import Intro from "./components/Intro";
import Filters from "./components/Filters";
import Gallery from "./components/Gallery";
import Cta from "./components/Cta";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  const [active, setActive] = useState("All");

  return (
    <div className="home-screen">
      <div className="container">
        <Topbar active={active} onSelect={setActive} />
        <Intro />
        <Filters active={active} onSelect={setActive} />
        <Gallery active={active} />
        <Cta />
        <Footer />
      </div>
    </div>
  );
}
