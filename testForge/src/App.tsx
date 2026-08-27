import { useState, useEffect } from "react";
import {
  STUDIO_DATA,
  MARQUEE_WORDS,
  SERVICES,
  PROJECTS,
  PROCESS,
  FAQS,
  CLIENTS,
  ProjectItem,
} from "./data/studioData";
import { ArrowUpRight, X, Sparkles, CheckCircle2 } from "lucide-react";
import { PrivacyPolicy } from "./components/PrivacyPolicy";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"home" | "privacy">("home");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "BRANDING" | "WEB" | "CAMPAIGNS">("ALL");
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // Synchronize hash routing with internal view
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#privacy") {
        setCurrentPage("privacy");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (window.location.hash === "" || window.location.hash === "#top") {
        setCurrentPage("home");
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateToHome = () => {
    setCurrentPage("home");
    window.location.hash = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateToPrivacy = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setCurrentPage("privacy");
    window.location.hash = "privacy";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredProjects =
    activeFilter === "ALL"
      ? PROJECTS
      : PROJECTS.filter((p) => p.category === activeFilter);

  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); navigateToHome(); }}>
          {STUDIO_DATA.shortName}
        </a>
        <nav className="nav-links">
          <a
            href="#work"
            onClick={(e) => {
              if (currentPage === "privacy") {
                e.preventDefault();
                navigateToHome();
                setTimeout(() => {
                  document.getElementById("work")?.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }
            }}
          >
            Work
          </a>
          <a
            href="#services"
            onClick={(e) => {
              if (currentPage === "privacy") {
                e.preventDefault();
                navigateToHome();
                setTimeout(() => {
                  document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }
            }}
          >
            Services
          </a>
          <a
            href="#process"
            onClick={(e) => {
              if (currentPage === "privacy") {
                e.preventDefault();
                navigateToHome();
                setTimeout(() => {
                  document.getElementById("process")?.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }
            }}
          >
            Process
          </a>
          <a
            href="#faq"
            onClick={(e) => {
              if (currentPage === "privacy") {
                e.preventDefault();
                navigateToHome();
                setTimeout(() => {
                  document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }
            }}
          >
            FAQ
          </a>
          <button
            type="button"
            className={`nav-privacy-btn ${currentPage === "privacy" ? "nav-privacy-active" : ""}`}
            onClick={navigateToPrivacy}
          >
            Privacy
          </button>
        </nav>
        <a
          className="btn btn-accent"
          href="#contact"
          onClick={(e) => {
            if (currentPage === "privacy") {
              e.preventDefault();
              navigateToHome();
              setTimeout(() => {
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }
          }}
        >
          START A FIGHT →
        </a>
      </header>

      {currentPage === "privacy" ? (
        <PrivacyPolicy onBack={navigateToHome} />
      ) : (
        <main id="top">
          <section className="hero">
            <div className="sticker sticker-yellow">
              EST. {STUDIO_DATA.foundedYear}
              <br />
              {STUDIO_DATA.location.split(",")[0].toUpperCase()}
            </div>
            <div className="sticker sticker-blue">
              100% HUMAN
              <br />
              MADE ✷
            </div>
            <h1>
              {STUDIO_DATA.heroHeadline.line1}
              <br />
              {STUDIO_DATA.heroHeadline.line2}
              <br />
              {STUDIO_DATA.heroHeadline.line3}{" "}
              <span className="scribble">{STUDIO_DATA.heroHeadline.highlight}</span>
            </h1>
            <p className="hero-sub">{STUDIO_DATA.heroSub}</p>
            <div className="hero-cta">
              <a className="btn btn-black" href="#work">
                SEE THE WORK ↓
              </a>
              <a className="btn btn-white" href={`mailto:${STUDIO_DATA.email}`}>
                {STUDIO_DATA.email}
              </a>
            </div>
          </section>

          <div className="marquee" aria-hidden="true">
            <div className="marquee-track">
              {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, i) => (
                <span key={i} className="marquee-item">
                  {w} <span className="marquee-star">✦</span>
                </span>
              ))}
            </div>
          </div>

          <section className="services" id="services">
            <div className="services-header">
              <h2 className="section-title">
                WHAT WE DO<span className="title-dot">.</span>
              </h2>
              <p className="services-subtitle">
                Four battle-tested capabilities. No bloat, no outsourced fluff.
              </p>
            </div>
            <div className="service-grid">
              {SERVICES.map((s) => (
                <article key={s.num} className="service-card" style={{ background: s.color }}>
                  <div className="service-card-top">
                    <span className="service-num">{s.num}</span>
                    <span className="service-badge-pill">GUARANTEED BOLD</span>
                  </div>
                  <h3>{s.title}</h3>
                  <p className="service-desc">{s.text}</p>

                  <div className="service-block">
                    <span className="service-subheading">CORE ARSENAL</span>
                    <div className="service-skills">
                      {s.skills.map((skill) => (
                        <span key={skill} className="service-skill-tag">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="service-block">
                    <span className="service-subheading">DELIVERABLES</span>
                    <ul className="service-deliverables">
                      {s.deliverables.map((d) => (
                        <li key={d}>
                          <span className="deliv-dash">—</span> {d}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="service-footer">
                    <span className="service-cta">INQUIRE SPEC</span>
                    <span className="service-arrow">→</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="work" id="work">
            <div className="work-head">
              <div>
                <h2 className="section-title">
                  SELECTED
                  <br />
                  WORK<span className="title-dot">.</span>
                </h2>
                <div className="project-filters">
                  {(["ALL", "BRANDING", "WEB", "CAMPAIGNS"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`filter-btn ${activeFilter === filter ? "filter-btn-active" : ""}`}
                    >
                      {filter === "ALL" ? "ALL WORK (4)" : filter}
                    </button>
                  ))}
                </div>
              </div>
              <p className="work-note">
                37 projects shipped since {STUDIO_DATA.foundedYear}.<br />
                Click any project to inspect the case brief.
              </p>
            </div>

            <div className="project-grid">
              {filteredProjects.map((p, i) => (
                <article
                  key={p.id}
                  className={`project ${i % 2 === 1 ? "project-offset" : ""}`}
                  onClick={() => setSelectedProject(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedProject(p);
                    }
                  }}
                >
                  <div className="project-media">
                    <img src={p.img} alt={p.title} />
                    <span className="project-stat">{p.stat}</span>
                    <div className="project-overlay-badge">
                      <span>INSPECT CASE</span>
                      <ArrowUpRight className="project-overlay-icon" size={18} />
                    </div>
                  </div>
                  <div className="project-meta">
                    <div>
                      <h3>{p.title}</h3>
                      <p className="project-client-name">{p.client}</p>
                    </div>
                    <div className="project-tags">
                      <span className="tag">{p.tag}</span>
                      <span className="tag tag-year">{p.year}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {selectedProject && (
            <div className="modal-backdrop" onClick={() => setSelectedProject(null)}>
              <div
                className="project-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="modal-header">
                  <div className="modal-header-left">
                    <span className="tag tag-year">{selectedProject.year}</span>
                    <span className="tag">{selectedProject.category}</span>
                  </div>
                  <button
                    className="modal-close-btn"
                    onClick={() => setSelectedProject(null)}
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-media">
                    <img src={selectedProject.img} alt={selectedProject.title} />
                    <span className="modal-stat-badge">{selectedProject.stat}</span>
                  </div>

                  <div className="modal-content">
                    <h3 className="modal-title">{selectedProject.title}</h3>
                    <p className="modal-client">Client: {selectedProject.client}</p>
                    
                    <div className="modal-highlight-box">
                      <Sparkles size={18} className="modal-sparkle-icon" />
                      <div>
                        <strong>OUTCOME</strong>
                        <p>{selectedProject.outcome}</p>
                      </div>
                    </div>

                    <div className="modal-section">
                      <h4 className="modal-subtitle">SCOPE OF WORK</h4>
                      <ul className="modal-scope-list">
                        {selectedProject.scope.map((item) => (
                          <li key={item}>
                            <CheckCircle2 size={16} className="modal-check-icon" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="modal-actions">
                      <a
                        href="#contact"
                        className="btn btn-accent"
                        onClick={() => setSelectedProject(null)}
                      >
                        REQUEST SIMILAR BRIEF →
                      </a>
                      <button
                        className="btn btn-white"
                        onClick={() => setSelectedProject(null)}
                      >
                        CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="shout">
            <p>
              "THEY REBRANDED US IN SIX WEEKS AND OUR SIGN-UPS <em>DOUBLED</em>.
              ALSO THEY'RE ANNOYINGLY FUN TO WORK WITH."
            </p>
            <span className="shout-credit">— Petra Molnár, CEO of Tangerine Bank</span>
            <div className="shout-awards">
              <span className="tag">AWWWARDS SOTD ×3</span>
              <span className="tag">D&AD WOOD PENCIL</span>
              <span className="tag">CANNES SHORTLIST '25</span>
              <span className="tag">FWA OF THE MONTH</span>
            </div>
          </section>

          <section className="process" id="process">
            <h2 className="section-title">
              HOW IT WORKS<span className="title-dot">.</span>
            </h2>
            <div className="process-grid">
              {PROCESS.map((p) => (
                <div key={p.step} className="process-card">
                  <span className="process-step">{p.step}</span>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
            <div className="client-strip">
              <p className="client-label">BRANDS THAT SURVIVED US:</p>
              <div className="client-tags">
                {CLIENTS.map((c) => (
                  <span key={c} className="tag">{c}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="faq" id="faq">
            <h2 className="section-title">
              REAL QUESTIONS<span className="title-dot">.</span>
            </h2>
            <div className="faq-list">
              {FAQS.map((f, i) => (
                <div key={f.q} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {f.q}
                    <span className="faq-toggle">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && <p className="faq-a">{f.a}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="contact" id="contact">
            <div className="contact-box">
              <h2>
                GOT A PROJECT?
                <br />
                <span className="contact-accent">LET'S RUIN BEIGE TOGETHER.</span>
              </h2>
              <p>Tell us what you're building. We reply within 24 hours, usually with opinions.</p>
              <a className="btn btn-accent btn-big" href={`mailto:${STUDIO_DATA.email}`}>
                {STUDIO_DATA.email}
              </a>
              <div className="contact-facts">
                <span>⚑ {STUDIO_DATA.location}</span>
                <span>☎ {STUDIO_DATA.phone}</span>
                <span>✷ {STUDIO_DATA.statsNotice}</span>
              </div>
            </div>
          </section>
        </main>
      )}

      <footer className="footer">
        <div className="footer-top">
          <span className="footer-brand" onClick={navigateToHome} style={{ cursor: "pointer" }}>
            {STUDIO_DATA.shortName}
          </span>
          <div className="footer-links">
            <a href="#work" onClick={(e) => { if (currentPage === "privacy") { e.preventDefault(); navigateToHome(); } }}>Work</a>
            <a href="#services" onClick={(e) => { if (currentPage === "privacy") { e.preventDefault(); navigateToHome(); } }}>Services</a>
            <a href="#privacy" className="footer-privacy-highlight" onClick={navigateToPrivacy}>
              Privacy &amp; Data Policy ★
            </a>
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Instagram</a>
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>LinkedIn</a>
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 {STUDIO_DATA.name} BV — KvK 68492017</span>
          <div className="footer-legal-row">
            <button type="button" className="footer-privacy-link-btn" onClick={navigateToPrivacy}>
              Privacy Policy &amp; Security Charter
            </button>
            <span>•</span>
            <span>Made loudly in {STUDIO_DATA.location.split(",")[0]}. No AI wrote this. (A human did. Angrily.)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}