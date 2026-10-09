import { SHOTS } from "../data";

type Props = { active: string };

export default function Gallery({ active }: Props) {
  const visible = active === "All" ? SHOTS : SHOTS.filter((s) => s.category === active);

  return (
    <main className="grid">
      {visible.map((shot, i) => (
        <figure key={shot.id} className={"tile" + (shot.tall ? " tile--tall" : "")}>
          <div className="tile-photo" style={{ background: shot.gradient }}>
            <img
              src={shot.src}
              alt={shot.alt}
              loading={i === 0 ? undefined : "lazy"}
            />
          </div>
          <figcaption className="tile-caption">
            <span className="tile-title">{shot.title}</span>
            <span className="tile-cat">{shot.category}</span>
          </figcaption>
        </figure>
      ))}
    </main>
  );
}
