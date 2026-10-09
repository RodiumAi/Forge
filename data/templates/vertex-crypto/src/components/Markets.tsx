import { TICKERS } from "../data";

export default function Markets() {
  return (
    <section className="markets container" id="markets">
      <div className="section-head">
        <h2>Markets that never sleep. Neither do we.</h2>
        <p>Live pricing across 280+ pairs. These four moved the most in the last 24 hours.</p>
      </div>
      <div className="market-grid">
        {TICKERS.map((t) => (
          <article key={t.sym} className="market-card gcard">
            <div className="market-head">
              <div>
                <span className="market-sym">{t.sym}</span>
                <span className="market-name">{t.name}</span>
              </div>
              <span className={`market-change ${t.up ? "up" : "down"}`}>{t.change}</span>
            </div>
            <span className="market-price">{t.price}</span>
            <div className="spark">
              {t.spark.map((v, i) => (
                <span
                  key={i}
                  className={`spark-bar ${t.up ? "spark-up" : "spark-down"}`}
                  style={{ height: `${v}%` }}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
