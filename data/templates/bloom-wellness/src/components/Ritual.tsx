import { ritual } from "../data";

export default function Ritual() {
  return (
    <section className="ritual" id="ritual">
      <div className="ritual-media">
        <img
          src="https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=70"
          alt="Calm spa interior"
          loading="lazy"
        />
        <img
          className="ritual-media-small"
          src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=70"
          alt="Facial treatment"
          loading="lazy"
        />
      </div>
      <div className="ritual-copy">
        <p className="eyebrow">How a visit unfolds</p>
        <h2>The Bloom ritual, in four breaths</h2>
        <ol className="steps">
          {ritual.map((r) => (
            <li key={r.step}>
              <span className="step-num">{r.step}</span>
              <div>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
