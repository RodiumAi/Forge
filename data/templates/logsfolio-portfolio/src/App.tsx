import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Experience from "./components/Experience";
import Projects from "./components/Projects";
import Education from "./components/Education";
import Testimonials from "./components/Testimonials";
import Blogs from "./components/Blogs";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="container">
        <Nav />
        <Hero />
        <Experience />
        <Projects />
        <Education />
        <Testimonials />
        <Blogs />
        <Footer />
      </div>
    </div>
  );
}
