import { GEAR } from "../data";

export default function About() {
  return (
    <section className="about" id="about">
      <div className="about-card">
        <h2 className="section-title-left">FROM THE YEAR THAT NEVER WAS</h2>
        <p>
          Neon Nights is the solo project of producer Elena Voss. Raised on VHS tapes and
          arcade carpets, she builds every track on a wall of vintage synths — Juno-106,
          DX7, LinnDrum — recorded to tape before it ever touches a computer.
        </p>
        <p>
          Since 2022: 40M+ streams, two sold-out European tours, and placements in three
          films nobody will admit they cried during.
        </p>
        <div className="about-stats">
          <div><strong>40M+</strong><span>streams</span></div>
          <div><strong>3</strong><span>records</span></div>
          <div><strong>62</strong><span>shows played</span></div>
          <div><strong>1984</strong><span>spiritual home</span></div>
        </div>
        <div className="gear">
          <h3 className="gear-title">THE WALL OF SYNTHS</h3>
          <ul className="gear-list">
            {GEAR.map((g) => (
              <li key={g.name}>
                <strong>{g.name}</strong> — {g.role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
