import type { CSSProperties } from "react";

type Props = { title: string; sub: string; on: boolean; onToggle: () => void; style?: CSSProperties };

/** Settings line with a title, a hint and an on/off switch. */
export default function ToggleRow({ title, sub, on, onToggle, style }: Props) {
  return (
    <div className="row" style={style}>
      <div><strong style={{ fontSize: ".95rem" }}>{title}</strong><p className="muted" style={{ fontSize: ".8rem" }}>{sub}</p></div>
      <button className={on ? "toggle on" : "toggle"} aria-pressed={on} onClick={onToggle} />
    </div>
  );
}
