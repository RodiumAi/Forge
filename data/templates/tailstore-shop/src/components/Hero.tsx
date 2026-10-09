import { heroImage } from "../data";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Autumn drop 2026</p>
        <h1>Everyday pieces, made to outlast the season</h1>
        <p className="lead">
          Natural fabrics, honest cuts and prices that don&apos;t need a sale sticker.
        </p>
        <a className="btn btn-accent" href="#shop">Shop the collection</a>
      </div>
      <div className="hero-art">
        <img
          src={heroImage}
          alt="Curated rack of neutral-toned clothing on wooden hangers"
        />
      </div>
    </section>
  );
}
