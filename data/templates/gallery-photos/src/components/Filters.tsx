import { CATEGORIES } from "../data";

type Props = { active: string; onSelect: (category: string) => void };

export default function Filters({ active, onSelect }: Props) {
  return (
    <section className="filters" aria-label="Category filters">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          className={"chip" + (active === c ? " chip--on" : "")}
          onClick={() => onSelect(c)}
        >
          {c}
        </button>
      ))}
    </section>
  );
}
