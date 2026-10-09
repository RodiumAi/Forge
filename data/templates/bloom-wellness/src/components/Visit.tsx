export default function Visit() {
  return (
    <section className="visit" id="visit">
      <div className="visit-inner">
        <img
          src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=70"
          alt="Spa pool"
          loading="lazy"
        />
        <div className="visit-copy">
          <h2>Your first hour of quiet is waiting</h2>
          <p>
            New guests receive a complimentary steam session and herbal tea with any treatment.
            We recommend booking two days ahead — the calendar fills softly but surely.
          </p>
          <a href="#top" className="btn-main">Book your visit</a>
          <p className="visit-note">14 Willow Lane · Tue–Sun 9:00–21:00 · hello@bloomstudio.co</p>
        </div>
      </div>
    </section>
  );
}
