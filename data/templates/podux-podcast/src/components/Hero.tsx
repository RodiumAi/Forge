import { Play } from "lucide-react";
import { U } from "../data";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="chip">Season 4 now streaming</span>
        <h1>Signal&amp;Noise, a podcast about building software that people actually use</h1>
        <p className="lead">
          Two engineers and a sound designer unpack the messy, funny, human side
          of shipping code. New episode every other Tuesday.
        </p>
        <div className="hero-actions">
          <a className="btn btn-accent" href="#episodes">Start listening</a>
          <a className="btn btn-ghost" href="#hosts">Meet the crew</a>
        </div>
        <p className="stat"><strong>1,200+</strong> listeners tune in weekly</p>
      </div>
      <div className="hero-art">
        <img
          className="hero-img"
          src={U("photo-1478737270239-2f02b77fc618", 1200)}
          alt="Condenser microphone in a recording studio with warm lighting"
        />
        <span className="hero-play">
          <Play size={24} fill="currentColor" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}
