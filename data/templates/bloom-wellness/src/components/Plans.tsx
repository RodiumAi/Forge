import { Leaf } from "lucide-react";
import { memberships } from "../data";

export default function Plans() {
  return (
    <section className="plans">
      <div className="sec-head">
        <p className="eyebrow">Memberships</p>
        <h2>Make calm a habit</h2>
        <p className="sec-sub">Pause or cancel anytime — wellness should never feel like a contract.</p>
      </div>
      <div className="plan-grid">
        {memberships.map((m, i) => (
          <article className={`plan ${i === 1 ? "plan-featured" : ""}`} key={m.name}>
            {i === 1 && <span className="plan-badge">Most loved</span>}
            <h3>{m.name}</h3>
            <p className="plan-price">{m.price}</p>
            <ul>
              {m.perks.map((p) => (
                <li key={p}>
                  <Leaf className="icon-leaf" size={14} aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
            <a href="#visit" className={i === 1 ? "btn-main" : "btn-soft"}>Choose {m.name}</a>
          </article>
        ))}
      </div>
    </section>
  );
}
