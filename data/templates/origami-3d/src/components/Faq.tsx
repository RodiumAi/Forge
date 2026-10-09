import { useState } from "react";
import { Minus, Plus } from "lucide-react";

const faqs = [
  {
    q: "Does Foldspace run fully in the browser?",
    a: "Yes. The constraint solver is compiled to WebAssembly and runs locally. Nothing leaves your machine until you hit share.",
  },
  {
    q: "Can I import existing CAD files?",
    a: "STEP, IGES, DXF and SVG all import with hinge detection. Most sheet-metal parts round-trip losslessly.",
  },
  {
    q: "What materials does the fab network support?",
    a: "Aluminium 5052, mild steel, birch ply, acrylic, PETG and polypropylene, in thicknesses from 0.5 to 6 mm.",
  },
  {
    q: "Is there an API?",
    a: "A full REST + WebSocket API ships with the Studio plan. Generate geometry from code, trigger exports, or embed the viewer.",
  },
];

export default function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section className="section" id="faq">
      <div className="section-head">
        <h2 className="section-title">Questions, unfolded</h2>
      </div>
      <div className="faq">
        {faqs.map((f, i) => (
          <div className={"faq-item" + (openFaq === i ? " open" : "")} key={f.q}>
            <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              {f.q}
              <span className="faq-toggle">
                {openFaq === i ? <Minus size={16} strokeWidth={2.25} /> : <Plus size={16} strokeWidth={2.25} />}
              </span>
            </button>
            {openFaq === i && <p className="faq-a">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
