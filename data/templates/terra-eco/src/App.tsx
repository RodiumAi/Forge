import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Wave from "./components/Wave";
import Impact from "./components/Impact";
import Mission from "./components/Mission";
import Projects from "./components/Projects";
import Standards from "./components/Standards";
import Voices from "./components/Voices";
import Join from "./components/Join";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <Wave fill="#3d5a3c" />
      <Impact />
      <Wave flip fill="#3d5a3c" />
      <Mission />
      <Wave fill="#dcd6c4" />
      <Projects />
      <Wave flip fill="#dcd6c4" />
      <Standards />
      <Wave fill="#3d5a3c" />
      <Voices />
      <Wave fill="#3d5a3c" />
      <Join />
      <Footer />
    </div>
  );
}
