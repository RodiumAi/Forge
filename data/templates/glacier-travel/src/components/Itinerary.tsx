import { itinerary } from "../data";

export default function Itinerary() {
  return (
    <section className="section" id="itinerary">
      <div className="section-head">
        <p className="eyebrow">Sample itinerary</p>
        <h2 className="section-title">Patagonia Icefield Traverse, day by day</h2>
        <p className="section-sub">
          Fourteen days from Punta Arenas and back. Weather owns the schedule;
          we build in the margin so you don't feel it.
        </p>
      </div>
      <ol className="timeline">
        {itinerary.map((step) => (
          <li className="timeline-item" key={step.day}>
            <span className="timeline-dot" aria-hidden="true" />
            <div className="timeline-body">
              <span className="timeline-day">{step.day}</span>
              <h3 className="timeline-title">{step.title}</h3>
              <p className="timeline-text">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
