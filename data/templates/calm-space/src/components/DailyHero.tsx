import PlayIcon from "./PlayIcon";

type Props = { label: string; title: string; meta: string; playLabel: string; className?: string };

/** Featured session card with a big play button (Home "Daily calm", Sleep story). */
export default function DailyHero({ label, title, meta, playLabel, className }: Props) {
  return (
    <div className={className ? `daily ${className}` : "daily"}>
      <div className="daily-copy">
        <p className="lbl">{label}</p>
        <h2>{title}</h2>
        <span className="daily-meta">{meta}</span>
      </div>
      <button className="daily-play" aria-label={playLabel}><PlayIcon /></button>
    </div>
  );
}
