import { MoveRight } from "lucide-react";

const PROJECTS = [
  {
    title: "Miyawaki micro-forests, Lyon",
    tag: "Urban rewilding",
    desc: "Dense native forests on former parking lots. 27 pocket forests planted with schools and city crews — canopy closure expected in 4 years instead of 20.",
    img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70",
  },
  {
    title: "Living-soil transition, Occitanie",
    tag: "Regenerative agriculture",
    desc: "We fund the risky first three years when farmers drop synthetic inputs. 84 farms enrolled; average soil organic matter up 1.8 points.",
    img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=70",
  },
  {
    title: "Seagrass nurseries, Brittany coast",
    tag: "Blue carbon",
    desc: "Zostera meadows sequester carbon 35× faster than rainforest. Our divers replanted 12 hectares with local fishing cooperatives.",
    img: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1200&q=70",
  },
  {
    title: "Mangrove corridor, Casamance",
    tag: "Coastal restoration",
    desc: "Community-led replanting of 900,000 propagules across estuary villages — storm protection and fish stocks returning together.",
    img: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=70",
  },
];

export default function Projects() {
  return (
    <section className="section alt" id="projects">
      <div className="section-head center">
        <span className="eyebrow">Active projects</span>
        <h2 className="h2">Where your support takes root</h2>
      </div>
      <div className="project-grid">
        {PROJECTS.map((p, i) => (
          <article className={i % 2 ? "project reverse" : "project"} key={p.title}>
            <div className="project-photo">
              <img src={p.img} alt={p.title} loading="lazy" />
            </div>
            <div className="project-body">
              <span className="project-tag">{p.tag}</span>
              <h3 className="project-title">{p.title}</h3>
              <p className="project-desc">{p.desc}</p>
              <a className="project-link" href="#join">
                View plot data <MoveRight size={13} strokeWidth={2.5} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
