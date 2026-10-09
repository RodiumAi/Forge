const cases = [
  {
    img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=70",
    sector: "Banking — EMEA",
    title: "Repositioning a universal bank's corporate franchise",
    result: "+220bps return on tangible equity within 18 months",
  },
  {
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=70",
    sector: "Industrials — North America",
    title: "Post-merger integration of two logistics networks",
    result: "$310M in synergies captured, 9 months ahead of plan",
  },
  {
    img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=70",
    sector: "Healthcare — APAC",
    title: "Market entry strategy for a diagnostics platform",
    result: "Regulatory approval in 3 markets; first revenue in year one",
  },
];

export default function Cases() {
  return (
    <section className="cases" id="cases">
      <div className="sec-rule">
        <span className="sec-num">§3</span>
        <h2>Selected case studies</h2>
      </div>
      <div className="case-grid">
        {cases.map((c) => (
          <article className="case" key={c.title}>
            <div className="case-media">
              <img src={c.img} alt={c.sector} loading="lazy" />
            </div>
            <p className="case-sector">{c.sector}</p>
            <h3>{c.title}</h3>
            <p className="case-result">{c.result}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
