const EXPERIENCE = [
  {
    role: "Lead Platform Engineer",
    company: "Northwind Systems",
    period: "Mar 2021 - Present",
    points: [
      "Own the internal deployment platform used by nine product squads.",
      "Cut median build times from 14 minutes to under 4 with remote caching.",
      "Introduced typed service contracts across the API gateway.",
      "Run the on-call rotation and post-incident review process."
    ]
  },
  {
    role: "Full Stack Engineer",
    company: "Cobalt Harbor Labs",
    period: "Aug 2017 - Feb 2021",
    points: [
      "Shipped a real-time logistics dashboard used by 40+ warehouses.",
      "Built event-driven pipelines on top of message queues and workers.",
      "Paired weekly with designers to keep the component library honest.",
      "Migrated a legacy monolith to modular TypeScript services."
    ]
  }
];

export default function Experience() {
  return (
    <section id="experience" className="section">
      <h2>Work Experience</h2>
      {EXPERIENCE.map((job) => (
        <article key={job.role} className="job">
          <div className="job-head">
            <h3>{job.role} <span className="job-at">@ {job.company}</span></h3>
            <span className="meta">{job.period}</span>
          </div>
          <ul>
            {job.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}
