import { useState } from "react";
import { Minus, Plus } from "lucide-react";

const FAQS = [
  {
    q: "How much does it cost?",
    a: "Identity projects start at $28k. Websites at $45k. Campaigns depend on how famous you want to be. If that made you flinch, we're probably not your studio — and that's fine.",
  },
  {
    q: "How long does it take?",
    a: "Identity: 5-7 weeks. Website: 8-12 weeks. We don't do 'quick versions'. Quick versions are how brands end up beige.",
  },
  {
    q: "Do you work with startups?",
    a: "Constantly. Half our clients are seed-to-Series-B. We take two equity-partial projects per year. Pitch us.",
  },
  {
    q: "Can we just get a logo?",
    a: "No. A logo without a system is a sticker. We do stickers too, but only as part of something bigger.",
  },
  {
    q: "Who will actually work on our project?",
    a: "The people you meet in the first call. No bait-and-switch to juniors. 14 people, zero account managers.",
  },
  {
    q: "Do you do AI-generated design?",
    a: "We use tools like everyone else. But every idea, sketch and final pixel is decided by a human with taste and a deadline.",
  },
];

export default function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section className="faq" id="faq">
      <h2 className="section-title">
        REAL QUESTIONS<span className="title-dot">.</span>
      </h2>
      <div className="faq-list">
        {FAQS.map((f, i) => (
          <div key={f.q} className={`faq-item ${openFaq === i ? "open" : ""}`}>
            <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              {f.q}
              <span className="faq-toggle">
                {openFaq === i ? (
                  <Minus size={18} strokeWidth={4} aria-hidden="true" />
                ) : (
                  <Plus size={18} strokeWidth={4} aria-hidden="true" />
                )}
              </span>
            </button>
            {openFaq === i && <p className="faq-a">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
