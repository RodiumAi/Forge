import { Minus, Plus, Trash2 } from "lucide-react";

type Props = { qty: number; onChange: (qty: number) => void; label: string; small?: boolean };

/** Quantity stepper: a single "+" while at zero, then minus / count / plus. */
export default function Stepper({ qty, onChange, label, small = false }: Props) {
  const cls = small ? "stepper small" : "stepper";
  if (qty === 0) {
    return (
      <button className={`${cls} add`} onClick={() => onChange(1)} aria-label={`Add ${label}`}>
        <Plus size={18} strokeWidth={2.6} aria-hidden />
      </button>
    );
  }
  return (
    <div className={`${cls} on`} role="group" aria-label={`${label} quantity`}>
      <button onClick={() => onChange(qty - 1)} aria-label={qty === 1 ? `Remove ${label}` : `One less ${label}`}>
        {qty === 1 ? <Trash2 size={16} strokeWidth={2.2} aria-hidden /> : <Minus size={16} strokeWidth={2.6} aria-hidden />}
      </button>
      <span aria-live="polite">{qty}</span>
      <button onClick={() => onChange(qty + 1)} aria-label={`One more ${label}`}><Plus size={16} strokeWidth={2.6} aria-hidden /></button>
    </div>
  );
}
