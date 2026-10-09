import { SECURITY } from "../data";

export default function Security() {
  return (
    <section className="security container" id="security">
      <div className="security-media gcard">
        <img
          src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=70"
          alt="Security infrastructure"
        />
        <div className="security-badge gcard">
          <strong>$0</strong>
          <span>lost to breaches since 2019</span>
        </div>
      </div>
      <div className="security-copy">
        <span className="pill">Security</span>
        <h2>Your keys, our paranoia.</h2>
        <div className="security-list">
          {SECURITY.map((s) => (
            <div key={s.title} className="security-item">
              <span className="security-icon">
                <s.icon size={22} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
