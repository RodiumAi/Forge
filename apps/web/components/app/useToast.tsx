"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Glyph, type GlyphName } from "@/components/ui/glyph";

/** One short message at the bottom of the screen (`.f-toast`), gone after a few seconds. */
export function useToast(duration = 3600): [ReactNode, (text: string, icon?: GlyphName) => void] {
  const [toast, setToast] = useState<{ text: string; icon?: GlyphName; id: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), duration);
    return () => window.clearTimeout(timer);
  }, [toast, duration]);
  const show = useCallback((text: string, icon?: GlyphName) => setToast({ text, icon, id: Date.now() }), []);
  const node =
    toast && typeof document !== "undefined"
      ? createPortal(
          <div key={toast.id} className="f-toast f-scope" role="status" aria-live="polite">
            {toast.icon ? <Glyph name={toast.icon} size="sm" /> : null}
            <span>{toast.text}</span>
          </div>,
          document.body,
        )
      : null;
  return [node, show];
}
