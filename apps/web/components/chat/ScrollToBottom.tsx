"use client";

import { Icon } from "@/components/ui/icon";
import { ArrowDown } from "lucide-react";

/**
 * Floating "jump to latest" affordance.
 *
 * Before this, scrolling up during a generation silently detached the view:
 * new content kept arriving with no indication and no way back other than
 * manually scrolling. `bottomRef` existed in the builder but was never used.
 */
export function ScrollToBottom({
  visible,
  unread,
  onClick,
  label,
}: {
  visible: boolean;
  unread?: boolean;
  onClick: () => void;
  label: string;
}) {
  if (!visible) return null;
  return (
    // Sticky INSIDE the scroll container: the previous absolute positioning
    // (bottom offset from the sidebar) landed the button behind the composer
    // and it showed as a clipped sliver at the panel edge.
    <div className="chat-jump-holder">
      <button
        type="button"
        className={`chat-jump${unread ? " has-unread" : ""}`}
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        <Icon icon={ArrowDown} size={16} />
        {unread ? <span className="chat-jump-dot" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}
