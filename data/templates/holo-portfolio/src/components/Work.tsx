import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const projects = [
  {
    img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=70",
    index: "01",
    title: "SYNTH/WAVE",
    desc: "Generative audio-reactive visuals for a synthwave label's world tour. Realtime WebGL, 60fps on stage screens.",
    tags: ["WebGL", "GLSL", "Audio API"],
    year: "2026",
  },
  {
    img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=70",
    index: "02",
    title: "NEON GRID",
    desc: "Interactive data sculpture for a fintech lobby — 40,000 particles mapping live market flow onto a 6m LED wall.",
    tags: ["Three.js", "TypeScript", "LED"],
    year: "2025",
  },
  {
    img: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1200&q=70",
    index: "03",
    title: "MORPH OS",
    desc: "Concept operating system UI for a sci-fi feature film. 200+ animated screens, all shipped as production plates.",
    tags: ["Motion", "UI Design", "Film"],
    year: "2025",
  },
  {
    img: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1200&q=70",
    index: "04",
    title: "LIQUID BRAND",
    desc: "A living identity system for an AI startup — the logo is a fluid simulation that reacts to product uptime.",
    tags: ["Branding", "Shaders", "AI"],
    year: "2024",
  },
];

export default function Work() {
  const [active, setActive] = useState(0);
  const project = projects[active];

  return (
    <section className="work" id="work">
      <div className="work-head">
        <h2 className="section-title">
          SELECTED <span className="mega-grad">WORK</span>
        </h2>
        <div className="work-cursor">
          <button
            className="arrow"
            onClick={() => setActive((active - 1 + projects.length) % projects.length)}
            aria-label="Previous project"
          >
            <ArrowLeft strokeWidth={1.25} aria-hidden="true" />
          </button>
          <span className="work-count">
            {project.index} / 0{projects.length}
          </span>
          <button
            className="arrow"
            onClick={() => setActive((active + 1) % projects.length)}
            aria-label="Next project"
          >
            <ArrowRight strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>

      <article className="holo-card" key={project.index}>
        <div className="holo-sheen" aria-hidden="true" />
        <div className="holo-media">
          <img src={project.img} alt={project.title} />
        </div>
        <div className="holo-body">
          <span className="holo-index">{project.index}</span>
          <h3>{project.title}</h3>
          <p>{project.desc}</p>
          <div className="tag-row">
            {project.tags.map((t) => (
              <span className="tag" key={t}>{t}</span>
            ))}
          </div>
          <span className="holo-year">{project.year}</span>
        </div>
      </article>

      <div className="work-grid">
        {projects.map((p, i) => (
          <button
            key={p.index}
            className={`work-thumb ${i === active ? "active" : ""}`}
            onClick={() => setActive(i)}
          >
            <img src={p.img} alt={p.title} loading="lazy" />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
