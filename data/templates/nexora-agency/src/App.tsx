import Topbar from "./components/Topbar";
import Hero from "./components/Hero";
import Clients from "./components/Clients";
import Services from "./components/Services";
import Why from "./components/Why";
import Process from "./components/Process";
import Work from "./components/Work";
import Testimonials from "./components/Testimonials";
import Cta from "./components/Cta";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Topbar />
      <Hero />
      <Clients />
      <Services />
      <Why />
      <Process />
      <Work />
      <Testimonials />
      <Cta />
      <Footer />
    </div>
  );
}
