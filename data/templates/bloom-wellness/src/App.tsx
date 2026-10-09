import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Treatments from "./components/Treatments";
import Schedule from "./components/Schedule";
import Ritual from "./components/Ritual";
import Stories from "./components/Stories";
import Plans from "./components/Plans";
import Visit from "./components/Visit";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <Treatments />
      <Schedule />
      <Ritual />
      <Stories />
      <Plans />
      <Visit />
      <Footer />
    </div>
  );
}
