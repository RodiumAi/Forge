"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * CSS tooltip shown on hover and keyboard focus. The trigger gets
 * aria-describedby so screen readers read the hint too. Use for short hints
 * only; an icon-only button still needs its own aria-label.
 */
export function Tooltip({
  content,
  side = "top",
  children,
}: {
  content: ReactNode;
  side?: "top" | "bottom" | "right";
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children, { "aria-describedby": id }) : children;
  return (
    <span className="f-tip">
      {child}
      <span role="tooltip" id={id} className="f-tip-bubble" data-side={side}>
        {content}
      </span>
    </span>
  );
}
