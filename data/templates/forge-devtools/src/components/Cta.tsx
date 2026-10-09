export default function Cta() {
  return (
    <section className="cta" id="docs">
      <h2 className="cta-title">Your bundle has secrets.</h2>
      <p className="cta-sub">One command. Eight seconds. No account.</p>
      <code className="cta-cmd"><span className="dollar">$</span> npx hexbin analyze ./dist</code>
    </section>
  );
}
