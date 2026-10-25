import { Copy, RotateCcw, ThumbsUp } from "lucide-react";
import { useState } from "react";
import type { Msg } from "../data";
import Orb from "./Orb";

/** One chat message. User messages are aqua bubbles on the right; Nova answers
 *  in plain text next to a tiny orb, with lines starting "- " shown as a list. */
export default function Message({ msg }: { msg: Msg }) {
  const [liked, setLiked] = useState(false);
  if (msg.role === "user") return <li className="msg user"><p>{msg.text}</p></li>;

  const lines = msg.text.split("\n");
  return (
    <li className="msg nova">
      <Orb size="xs" />
      <div className="msg-body">
        {lines.map((line, i) => {
          if (!line.trim()) return <span key={i} className="gap" />;
          if (line.startsWith("- ")) {
            const num = /^(\d+)\. (.*)$/.exec(line.slice(2));
            if (num) return <p key={i} className="bullet num"><b>{num[1]}</b>{num[2]}</p>;
            return <p key={i} className="bullet">{line.slice(2)}</p>;
          }
          return <p key={i}>{line}</p>;
        })}
        <div className="msg-actions">
          <button aria-label="Copy"><Copy size={15} strokeWidth={1.9} aria-hidden /></button>
          <button className={liked ? "on" : ""} onClick={() => setLiked((v) => !v)} aria-pressed={liked} aria-label="Good answer"><ThumbsUp size={15} strokeWidth={1.9} aria-hidden /></button>
          <button aria-label="Regenerate"><RotateCcw size={15} strokeWidth={1.9} aria-hidden /></button>
        </div>
      </div>
    </li>
  );
}

/** Three bouncing dots while Nova "types". */
export function Typing() {
  return (
    <li className="msg nova typing" aria-label="Nova is typing">
      <Orb size="xs" state="speaking" />
      <span className="dots"><i /><i /><i /></span>
    </li>
  );
}
