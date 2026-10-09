import { MoveRight } from "lucide-react";

const FACTS = [
  "Nalepastraße 18, 12459 Berlin",
  "Doors 08:30 · talks 09:30–18:00",
  "Afterparty Friday, main hall, 21:00",
];

export default function Venue() {
  return (
    <section className="block block-green" id="venue">
      <div className="venue-grid">
        <div>
          <h2 className="block-title dark">Funkhaus, Berlin</h2>
          <p className="venue-copy">
            A 1950s broadcast complex on the Spree with the best acoustics in Europe.
            Stage 1 is the old recording hall; the workshop floor is the former tape archive.
            Ten minutes from Ostkreuz, five from the river.
          </p>
          <ul className="venue-list">
            {FACTS.map((f) => (
              <li key={f}>
                <MoveRight className="venue-arrow" size={16} strokeWidth={2.5} aria-hidden="true" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="venue-photo">
          <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=70" alt="Conference hall crowd" loading="lazy" />
        </div>
      </div>
    </section>
  );
}
