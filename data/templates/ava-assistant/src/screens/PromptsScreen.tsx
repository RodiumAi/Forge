import "../styles/prompts.css";
import { PROMPTS } from "../data";

type Props = { onPick: (body: string) => void };

export default function PromptsScreen({ onPick }: Props) {
  return (
    <main className="app-main prompts-screen">
      <div className="section-head"><h2>Prompt library</h2><span className="pill">6 ideas</span></div>
      <div className="prompt-grid">
        {PROMPTS.map((p) => (
          <button className="prompt" key={p.title} onClick={() => onPick(p.body)}>
            <span className="cat"><span className="cat-ic"><p.icon size={18} strokeWidth={1.7} aria-hidden /></span>{p.cat}</span>
            <strong>{p.title}</strong>
            <span className="one-line">{p.body}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
