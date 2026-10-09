import { MoveRight } from "lucide-react";

export default function FinalCta() {
  return (
    <section className="final">
      <h2 className="final-title">
        FIRST WEEK'S <span className="stroke-dark">FREE.</span>
      </h2>
      <p className="final-sub">Walk in tonight. Doors don't close, and neither do trial spots — until they do.</p>
      <a className="btn btn-dark" href="#plans">
        CLAIM YOUR 7 DAYS <MoveRight size={16} strokeWidth={2.25} />
      </a>
    </section>
  );
}
