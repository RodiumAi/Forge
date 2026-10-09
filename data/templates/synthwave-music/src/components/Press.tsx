import { PRESS } from "../data";

export default function Press() {
  return (
    <section className="press">
      {PRESS.map((p) => (
        <blockquote key={p.source} className="press-quote">
          “{p.quote}”
          <cite>— {p.source}</cite>
        </blockquote>
      ))}
    </section>
  );
}
