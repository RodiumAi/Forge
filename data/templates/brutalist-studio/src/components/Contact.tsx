import { Asterisk, Flag, Phone } from "lucide-react";

export default function Contact() {
  return (
    <section className="contact" id="contact">
      <div className="contact-box">
        <h2>
          GOT A PROJECT?<br />
          <span className="contact-accent">LET'S RUIN BEIGE TOGETHER.</span>
        </h2>
        <p>Tell us what you're building. We reply within 24 hours, usually with opinions.</p>
        <a className="btn btn-accent btn-big" href="#top">hello@rawworks.studio</a>
        <div className="contact-facts">
          <span><Flag className="fact-icon" size={11} strokeWidth={3} fill="currentColor" aria-hidden="true" /> Rotterdam, NL</span>
          <span><Phone className="fact-icon" size={13} strokeWidth={2.5} fill="currentColor" aria-hidden="true" /> +31 10 555 0192</span>
          <span><Asterisk className="fact-icon" size={13} strokeWidth={3.5} aria-hidden="true" /> 2 project slots left for Q4</span>
        </div>
      </div>
    </section>
  );
}
