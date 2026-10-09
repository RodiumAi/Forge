type Props = { items: string[]; value: string; label: string; onChange: (value: string) => void };

/* Horizontally scrolling single-choice chips (Home categories, Search cuisines). */
export default function ChipRow({ items, value, label, onChange }: Props) {
  return (
    <div className="chips" role="tablist" aria-label={label}>
      {items.map((c) => (
        <button key={c} className={c === value ? "chip on" : "chip"} aria-pressed={c === value} onClick={() => onChange(c)}>{c}</button>
      ))}
    </div>
  );
}
