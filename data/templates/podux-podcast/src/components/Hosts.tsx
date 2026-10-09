import { hosts } from "../data";

export default function Hosts() {
  return (
    <section className="hosts" id="hosts">
      <h2>Behind the microphones</h2>
      <div className="host-grid">
        {hosts.map((h) => (
          <article key={h.init} className="host">
            <div className="avatar" style={{ background: h.g }}>
              <img src={h.img} alt={h.alt} loading="lazy" />
            </div>
            <h3>{h.name}</h3>
            <p>{h.role}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
