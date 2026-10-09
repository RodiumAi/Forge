type Props = { title: string; action?: string; onAction?: () => void };

export default function SectionHead({ title, action, onAction }: Props) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action && <a href="#" onClick={(e) => { e.preventDefault(); onAction?.(); }}>{action}</a>}
    </div>
  );
}
