import { MoveRight } from "lucide-react";

export default function Contact() {
  return (
    <section className="contact" id="contact">
      <h2 className="contact-title">
        We take on six
        <br />
        projects a year.
      </h2>
      <p className="contact-sub">
        Commissions for 2027 open in September. Write to us with a site, a
        brief, or simply an ambition.
      </p>
      <a className="contact-btn" href="mailto:studio@lumenatelier.com">
        studio@lumenatelier.com <span className="arrow"><MoveRight size={22} strokeWidth={1.25} /></span>
      </a>
    </section>
  );
}
