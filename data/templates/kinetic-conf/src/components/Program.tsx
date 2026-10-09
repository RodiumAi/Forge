import { useState } from "react";
import { Minus, Plus } from "lucide-react";

const SCHEDULE = [
  {
    day: "Day 01 — Wed May 14",
    theme: "Systems & Craft",
    items: [
      { time: "09:30", title: "Opening keynote: Interfaces after the screen", who: "Mara Voss — Head of Design, Fieldwork" },
      { time: "11:00", title: "Design tokens at planetary scale", who: "Jonas Reike — Staff Engineer, Klarna" },
      { time: "14:00", title: "Workshop: Variable fonts in production", who: "Studio Grotesque" },
      { time: "16:30", title: "The death and rebirth of the design system", who: "Amara Diallo — Principal Designer, Linear" },
    ],
  },
  {
    day: "Day 02 — Thu May 15",
    theme: "Motion & Machines",
    items: [
      { time: "09:30", title: "Choreographing UI: motion as language", who: "Kenji Nakamura — Motion Lead, Vercel" },
      { time: "11:00", title: "Shipping ML features without shipping regret", who: "Priya Sharma — AI Product, Figma" },
      { time: "14:00", title: "Workshop: WebGPU for interface designers", who: "Halide Collective" },
      { time: "16:30", title: "Panel: Who owns taste in the age of generation?", who: "Voss · Nakamura · Okafor" },
    ],
  },
  {
    day: "Day 03 — Fri May 16",
    theme: "Futures",
    items: [
      { time: "09:30", title: "Brutal honesty: a decade of shipping wrong things", who: "Tomas Okafor — Founder, Northbeam" },
      { time: "11:00", title: "Accessibility is a performance budget", who: "Lena Fischer — Web Platform, Mozilla" },
      { time: "14:00", title: "Lightning talks: 8 ideas × 8 minutes", who: "Community stage" },
      { time: "16:30", title: "Closing keynote: Make it weird again", who: "Ines Beckert — Creative Director, Studio Dumbar" },
    ],
  },
];

export default function Program() {
  const [openDay, setOpenDay] = useState(0);

  return (
    <section className="section" id="program">
      <div className="section-head">
        <h2 className="h2"><span className="outline-text">The</span> Program</h2>
        <p className="section-sub">Three days, three themes. Every talk is 30 minutes — no filler, no sponsors on stage.</p>
      </div>
      <div className="accordion">
        {SCHEDULE.map((d, i) => (
          <div className={openDay === i ? "acc-item open" : "acc-item"} key={d.day}>
            <button className="acc-head" onClick={() => setOpenDay(openDay === i ? -1 : i)}>
              <span className="acc-day">{d.day}</span>
              <span className="acc-theme">{d.theme}</span>
              <span className="acc-icon" aria-hidden>
                {openDay === i ? <Minus strokeWidth={3.5} /> : <Plus strokeWidth={3.5} />}
              </span>
            </button>
            {openDay === i && (
              <ul className="acc-body">
                {d.items.map((it) => (
                  <li className="acc-row" key={it.title}>
                    <span className="acc-time">{it.time}</span>
                    <span className="acc-title">{it.title}</span>
                    <span className="acc-who">{it.who}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
