import Nav from "./components/Nav";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import Workflow from "./components/Workflow";
import Pricing from "./components/Pricing";
import Faq from "./components/Faq";
import CtaBand from "./components/CtaBand";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Workflow />
      <Pricing />
      <Faq />
      <CtaBand />
      <Footer />
    </div>
  );
}
