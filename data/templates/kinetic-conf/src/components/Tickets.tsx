import { Asterisk, MoveRight } from "lucide-react";

const TICKETS = [
  {
    name: "Standard",
    price: "€349",
    color: "blue",
    perks: ["All 3 days, all stages", "Conference kit & swag", "Lunch + coffee included", "Talk recordings"],
  },
  {
    name: "Pro",
    price: "€549",
    color: "accent",
    featured: true,
    perks: ["Everything in Standard", "1 hands-on workshop", "Speaker dinner invite", "Front-row seating", "Kinetic type specimen book"],
  },
  {
    name: "Studio ×5",
    price: "€1,990",
    color: "green",
    perks: ["5 Pro passes", "Team photo on stage 3", "Logo on the studio wall", "Priority workshop booking"],
  },
];

export default function Tickets() {
  return (
    <section className="section" id="tickets">
      <div className="section-head">
        <h2 className="h2"><span className="outline-text">Get</span> In</h2>
        <p className="section-sub">Early-bird pricing until January 31. Students: 50% off with a valid ID, any tier.</p>
      </div>
      <div className="ticket-grid">
        {TICKETS.map((t) => (
          <article className={t.featured ? "ticket featured" : "ticket"} key={t.name} data-color={t.color}>
            {t.featured && <span className="ticket-flag">Most popular</span>}
            <h3 className="ticket-name">{t.name}</h3>
            <div className="ticket-price">{t.price}</div>
            <ul className="ticket-perks">
              {t.perks.map((p) => (
                <li key={p}>
                  <Asterisk className="perk-icon" size={20} strokeWidth={1.5} aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
            <a className="btn btn-fg wide" href="#top">
              Buy {t.name} <MoveRight className="btn-icon" size={14} strokeWidth={2.5} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
