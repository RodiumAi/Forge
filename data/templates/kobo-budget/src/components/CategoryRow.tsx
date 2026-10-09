import type { Category } from "../data";

/* Spent-vs-limit bar; turns red once the limit is reached. */
function Bar({ spent, limit, hue }: { spent: number; limit: number; hue: string }) {
  const pct = Math.min(Math.round((spent / limit) * 100), 100);
  const over = spent >= limit;
  return (
    <div className="track">
      <div className="fill" style={{ width: `${pct}%`, background: over ? "var(--danger)" : hue }} />
    </div>
  );
}

type Props = { cat: Category; amount: string; over?: boolean };

/* One category line (icon, name, amount, progress bar) for Home and Stats. */
export default function CategoryRow({ cat: c, amount, over }: Props) {
  return (
    <div className="cat">
      <span className="cat-ico" aria-hidden><c.Icon size={18} strokeWidth={1.8} /></span>
      <div className="cat-body">
        <div className="cat-top">
          <strong>{c.name}</strong>
          <span className={over ? "cat-amt over" : "cat-amt"}>{amount}</span>
        </div>
        <Bar spent={c.spent} limit={c.limit} hue={c.hue} />
      </div>
    </div>
  );
}
