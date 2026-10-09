import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Press from "./components/Press";
import Albums from "./components/Albums";
import Tracklist from "./components/Tracklist";
import Tour from "./components/Tour";
import About from "./components/About";
import Signup from "./components/Signup";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <main id="top">
        <Hero />
        <Press />
        <Albums />
        <Tracklist />
        <Tour />
        <About />
        <Signup />
      </main>
      <Footer />
    </div>
  );
}
