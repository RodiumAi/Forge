import Header from "./components/Header";
import Hero from "./components/Hero";
import Episodes from "./components/Episodes";
import Hosts from "./components/Hosts";
import Subscribe from "./components/Subscribe";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <Header />
      <Hero />
      <Episodes />
      <Hosts />
      <Subscribe />
      <Footer />
    </div>
  );
}
