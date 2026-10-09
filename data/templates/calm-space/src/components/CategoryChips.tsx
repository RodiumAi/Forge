import { CATEGORIES } from "../data";

type Props = { onPick?: () => void };

export default function CategoryChips({ onPick }: Props) {
  return (
    <div className="chips" role="list">
      {CATEGORIES.map((c) => (
        <button className="chip-btn" role="listitem" key={c} onClick={onPick}>{c}</button>
      ))}
    </div>
  );
}
