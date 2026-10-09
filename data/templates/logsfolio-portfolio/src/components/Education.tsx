const EDUCATION = [
  {
    title: "M.Sc. Software Engineering",
    school: "Valmora Institute of Technology",
    period: "2015 - 2017",
    detail: "Thesis on incremental compilation strategies for large TypeScript codebases. Teaching assistant for the distributed systems course."
  },
  {
    title: "B.Sc. Computer Science",
    school: "University of Eastvale",
    period: "2011 - 2015",
    detail: "Core curriculum in algorithms, databases and operating systems. Built a campus room-booking app still in use by two departments."
  }
];

export default function Education() {
  return (
    <section id="education" className="section">
      <h2>Education</h2>
      {EDUCATION.map((ed) => (
        <article key={ed.title} className="edu">
          <div className="job-head">
            <h3>{ed.title}</h3>
            <span className="meta">{ed.period}</span>
          </div>
          <p className="edu-school">{ed.school}</p>
          <p className="muted">{ed.detail}</p>
        </article>
      ))}
    </section>
  );
}
