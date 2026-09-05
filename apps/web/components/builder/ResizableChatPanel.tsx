"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronsLeft, ChevronsRight, PanelLeft } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

const WIDTH_KEY = "forge.builder.chatWidth";
const OPEN_KEY = "forge.builder.chatOpen";
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

function clampWidth(raw: number): number {
  if (typeof window === "undefined") {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw));
  }
  const cap = Math.min(MAX_WIDTH, Math.floor(window.innerWidth * 0.55));
  return Math.min(cap, Math.max(MIN_WIDTH, Math.round(raw)));
}

function readStoredWidth(): number {
  try {
    const raw = Number(window.localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(raw) && raw > 0) return clampWidth(raw);
  } catch {
    /* ignore */
  }
  return clampWidth(DEFAULT_WIDTH);
}

function readStoredOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

type Props = {
  children: ReactNode;
};

/**
 * Desktop chat rail: drag the right edge to resize, collapse to a thin strip,
 * reopen from the strip. Width/open persist in localStorage. Mobile keeps the
 * existing chat/workspace tab switcher (this rail stays full-width there).
 */
export function ResizableChatPanel({ children }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    setWidth(readStoredWidth());
    setOpen(readStoredOpen());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!open) return;
      event.preventDefault();
      dragStartX.current = event.clientX;
      dragStartWidth.current = width;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [open, width],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const delta = event.clientX - dragStartX.current;
      setWidth(clampWidth(dragStartWidth.current + delta));
    },
    [dragging],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }, [dragging]);

  return (
    <aside
      className={`builder-sidebar${open ? "" : " is-collapsed"}${dragging ? " is-resizing" : ""}`}
      style={open ? ({ ["--builder-chat-width"]: `${width}px` } as CSSProperties) : undefined}
      data-chat-open={open ? "1" : "0"}
    >
      <div className="builder-sidebar-body">
        {open ? (
          <div className="builder-chat-toolbar">
            <span className="builder-chat-toolbar-label">{t("chatLogLabel")}</span>
            <button
              type="button"
              className="builder-chat-collapse"
              title={t("chatPanelCollapse")}
              aria-label={t("chatPanelCollapse")}
              onClick={() => setOpen(false)}
            >
              <Icon icon={ChevronsLeft} className="ui-icon-sm" />
            </button>
          </div>
        ) : null}
        {children}
      </div>

      {open ? (
        <div
          className="builder-chat-resize"
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-label={t("chatPanelResize")}
          title={t("chatPanelResizeHint")}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          className="builder-chat-expand"
          title={t("chatPanelExpand")}
          aria-label={t("chatPanelExpand")}
          onClick={() => setOpen(true)}
        >
          <Icon icon={PanelLeft} className="ui-icon-md" />
          <Icon icon={ChevronsRight} className="ui-icon-sm builder-chat-expand-chevron" />
          <span className="builder-chat-expand-label">{t("builderTabChat")}</span>
        </button>
      )}
    </aside>
  );
}
