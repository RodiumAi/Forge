export default function Philosophy() {
  return (
    <section className="section philosophy" id="philosophy">
      <div className="section-head">
        <span className="section-num">02</span>
        <h2 className="section-title">Philosophy</h2>
      </div>
      <div className="philosophy-grid">
        <figure className="philosophy-figure">
          <img
            src="https://images.unsplash.com/photo-1481253127861-534498168948?auto=format&fit=crop&w=1200&q=70"
            alt="Minimal stairwell with natural light"
          />
          <figcaption>Vault Gallery — stair core</figcaption>
        </figure>
        <div className="philosophy-copy">
          <p className="philosophy-lead">
            “A plan is a promise. We make very few, and we keep all of them.”
          </p>
          <p>
            We believe a building should be understood in one walk-through
            and rewarded on the hundredth. Our work begins with the section —
            how light falls, how air moves, where a person pauses — and only
            then addresses the facade.
          </p>
          <p>
            Every project is drawn by hand before it is modelled. The studio
            maintains a single material library, audited yearly: we would
            rather master forty materials than sample four hundred.
          </p>
          <ul className="philosophy-list">
            <li><span>—</span> Light before form, form before finish.</li>
            <li><span>—</span> Every detail drawn at 1:5 or it doesn't get built.</li>
            <li><span>—</span> Retrofit first; demolition is a last resort.</li>
            <li><span>—</span> One accent material per building, never more.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
