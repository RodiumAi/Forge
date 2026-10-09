import { TICKERS } from "../data";

export default function TickerBar() {
  return (
    <div className="ticker-bar">
      <div className="ticker-track">
        {[...TICKERS, ...TICKERS, ...TICKERS].map((t, i) => (
          <span key={i} className="ticker-chip">
            <strong>{t.sym}</strong> {t.price}
            <em className={t.up ? "up" : "down"}>{t.change}</em>
          </span>
        ))}
      </div>
    </div>
  );
}
