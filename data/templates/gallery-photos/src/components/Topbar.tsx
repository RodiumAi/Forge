import { CATEGORIES } from "../data";

type Props = { active: string; onSelect: (category: string) => void };

export default function Topbar({ active, onSelect }: Props) {
  return (
    <header className="topbar">
      <span className="brand">Aperture Field</span>
      <nav className="nav">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={"nav-link" + (active === c ? " nav-link--on" : "")}
            onClick={() => onSelect(c)}
          >
            {c}
          </button>
        ))}
      </nav>
    </header>
  );
}
