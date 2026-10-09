const schedule = [
  { time: "06:00", mon: "Strength", wed: "Conditioning", fri: "Strength" },
  { time: "12:15", mon: "Boxing", wed: "Strength", fri: "Conditioning" },
  { time: "18:30", mon: "Conditioning", wed: "Boxing", fri: "Boxing" },
  { time: "20:00", mon: "Strength", wed: "Strength", fri: "Open mat" },
];

export default function Schedule() {
  return (
    <section className="section" id="schedule">
      <div className="section-head">
        <h2 className="section-title">THE WEEK,<br /><span className="lime">ON THE CLOCK.</span></h2>
        <p className="section-sub">
          Sample of the peak slots. The full 310-class grid lives in the app — book up to 7 days out.
        </p>
      </div>
      <div className="sched">
        <div className="sched-row sched-head-row">
          <span>TIME</span>
          <span>MON</span>
          <span>WED</span>
          <span>FRI</span>
        </div>
        {schedule.map((s) => (
          <div className="sched-row" key={s.time}>
            <span className="sched-time">{s.time}</span>
            <span>{s.mon}</span>
            <span>{s.wed}</span>
            <span>{s.fri}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
