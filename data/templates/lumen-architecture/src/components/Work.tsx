import { useState } from "react";

const projects = [
  {
    num: "01",
    title: "Meridian House",
    place: "Marfa, Texas",
    year: "2025",
    type: "Private residence",
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70",
    size: "wide",
  },
  {
    num: "02",
    title: "Kiln Pavilion",
    place: "Kyoto, Japan",
    year: "2024",
    type: "Cultural pavilion",
    img: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=70",
    size: "narrow",
  },
  {
    num: "03",
    title: "Vault Gallery",
    place: "Copenhagen, Denmark",
    year: "2024",
    type: "Contemporary art gallery",
    img: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=70",
    size: "narrow",
  },
  {
    num: "04",
    title: "Slate Courtyard",
    place: "Zürich, Switzerland",
    year: "2023",
    type: "Headquarters & atrium",
    img: "https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=1200&q=70",
    size: "wide",
  },
];

export default function Work() {
  const [activeProject, setActiveProject] = useState<string | null>(null);

  return (
    <section className="section" id="work">
      <div className="section-head">
        <span className="section-num">01</span>
        <h2 className="section-title">Selected work</h2>
        <p className="section-sub">Four projects, 2023 — 2025</p>
      </div>
      <div className="work-grid">
        {projects.map((p) => (
          <article
            key={p.num}
            className={"work-card " + p.size + (activeProject === p.num ? " active" : "")}
            onMouseEnter={() => setActiveProject(p.num)}
            onMouseLeave={() => setActiveProject(null)}
          >
            <div className="work-img">
              <img src={p.img} alt={p.title} />
            </div>
            <div className="work-meta">
              <span className="work-num">{p.num}</span>
              <h3 className="work-title">{p.title}</h3>
              <p className="work-detail">
                {p.type} · {p.place} · {p.year}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
