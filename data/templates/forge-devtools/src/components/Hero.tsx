import InstallBox from "./InstallBox";
import Terminal from "./Terminal";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-glow" aria-hidden />
      <span className="hero-badge">v3.2 — now with esbuild metafile support</span>
      <h1 className="h1">
        Trace <span className="grad">every byte</span> your build ships.
      </h1>
      <p className="lede">
        Hexbin is a bundle forensics CLI. It tells you what's in your JavaScript,
        why it's there, and exactly how to make it smaller — in one command,
        with zero configuration.
      </p>
      <InstallBox />
      <Terminal />
    </section>
  );
}
