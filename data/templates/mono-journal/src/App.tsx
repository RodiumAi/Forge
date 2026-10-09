import Masthead from "./components/Masthead";
import Hero from "./components/Hero";
import ArticleIndex from "./components/ArticleIndex";
import Essay from "./components/Essay";
import Quote from "./components/Quote";
import Archive from "./components/Archive";
import Letters from "./components/Letters";
import Subscribe from "./components/Subscribe";
import Footer from "./components/Footer";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="page">
        <Masthead />
        <Hero />
        <ArticleIndex />
        <Essay />
        <Quote />
        <Archive />
        <Letters />
        <Subscribe />
        <Footer />
      </div>
    </div>
  );
}
