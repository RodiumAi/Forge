import "../styles/history.css";
import { MessageSquare } from "lucide-react";
import { HISTORY } from "../data";

type Props = { onOpen: () => void };

export default function HistoryScreen({ onOpen }: Props) {
  return (
    <main className="app-main history-screen">
      <section className="card list">
        {HISTORY.map((h) => (
          <button className="tx" key={h.title} onClick={onOpen}>
            <span className="ava" aria-hidden><MessageSquare size={22} strokeWidth={1.8} aria-hidden /></span>
            <span className="meta"><strong>{h.title}</strong><span>{h.snippet}</span></span>
            <span className="when">{h.time}</span>
          </button>
        ))}
      </section>
    </main>
  );
}
