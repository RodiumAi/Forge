import type { Tx } from "../data";

/** One transaction: icon tile, label and time, signed amount. */
export default function TxRow({ tx }: { tx: Tx }) {
  const Icon = tx.icon;
  return (
    <li className="tx">
      <span className={tx.incoming ? "tx-icon in" : "tx-icon"}><Icon size={18} strokeWidth={2} aria-hidden /></span>
      <span className="tx-meta">
        <strong>{tx.name}</strong>
        <span>{tx.meta}</span>
      </span>
      <span className={tx.incoming ? "amount in" : "amount"}>{tx.amount}</span>
    </li>
  );
}
