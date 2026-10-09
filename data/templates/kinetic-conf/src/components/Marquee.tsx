import { Asterisk } from "lucide-react";

type Props = { words: string[]; reverse?: boolean; outlineFirst?: boolean };

export default function Marquee({ words, reverse, outlineFirst }: Props) {
  const row = [...words, ...words, ...words];
  return (
    <div className="marquee">
      <div className={reverse ? "marquee-track reverse" : "marquee-track"}>
        {row.map((w, i) => (
          <span key={i} className={(i % 2 === 0) === !!outlineFirst ? "mq-word outline" : "mq-word"}>
            {w}
            <span className="mq-dot" aria-hidden>
              <Asterisk strokeWidth={1.25} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
