import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** Lifts on hover (use on clickable cards). */
  interactive?: boolean;
  /** No padding, clips children (media cards). */
  flush?: boolean;
  dashed?: boolean;
  as?: "div" | "section" | "article";
};

/** Rounded 24px surface card. */
export function Card({ interactive, flush, dashed, as: Tag = "div", className, children, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      className={cx("f-card", interactive && "f-card-interactive", flush && "f-card-flush", dashed && "f-card-dashed", className)}
    >
      {children}
    </Tag>
  );
}

/** Card header: title on the left, an optional action (link, button) on the right. */
export function CardHead({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("f-card-head", className)}>
      <h3>{title}</h3>
      {action}
    </div>
  );
}

/** Settings and billing panel: padded surface with an optional title and lead. */
export function Panel({
  title,
  lead,
  actions,
  className,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, "title"> & { title?: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <section {...rest} className={cx("f-panel", className)}>
      {title || actions ? (
        <div className="f-card-head" style={{ marginBottom: lead ? 0 : 14 }}>
          {title ? <h2>{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {lead ? <p className="f-panel-lead" style={{ marginBottom: 14 }}>{lead}</p> : null}
      {children}
    </section>
  );
}
