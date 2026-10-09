import "../styles/add.css";
import { Delete } from "lucide-react";
import { CHIPS, KEYS } from "../data";

type Props = {
  amount: string;
  chip: string;
  note: string;
  onKey: (key: string) => void;
  onChip: (chip: string) => void;
  onNote: (note: string) => void;
  onSave: () => void;
};

export default function AddScreen({ amount, chip, note, onKey, onChip, onNote, onSave }: Props) {
  return (
    <main className="app-main add-screen">
      <div className="add">
        <div className="amount-display">
          <span className="cur">CFA</span>
          <span className="big">{amount}</span>
        </div>
        <div className="chips" role="group" aria-label="Category">
          {CHIPS.map((c) => (
            <button key={c} className={c === chip ? "chip on" : "chip"} onClick={() => onChip(c)}>{c}</button>
          ))}
        </div>
        <input className="note" placeholder="Add a note (optional)" value={note} onChange={(e) => onNote(e.target.value)} />
        <div className="keypad" aria-hidden>
          {KEYS.map((k) => (
            <button key={k} className="key" onClick={() => onKey(k)}>
              {k === "del" ? <Delete size={22} strokeWidth={1.7} /> : k}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={onSave}>Save expense</button>
      </div>
    </main>
  );
}
