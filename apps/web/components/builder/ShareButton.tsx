"use client";

/**
 * Share a project with other people (Canva-style invites), for every project
 * workspace: site and app builder, slides, codelab, design system. Only the
 * owner gets it; on a plan without seats it explains instead of opening.
 */

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { shareSeatLimit, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ShareProjectModal } from "./ShareProjectModal";

type Props = {
  projectId: string;
  projectName: string;
  className?: string;
  /** Bump to open the dialog from elsewhere (a phone tab bar, a menu). */
  request?: number;
  /** Render only the dialog and the hint, without the button. */
  hideButton?: boolean;
};

export function ShareButton({ projectId, projectName, className, request = 0, hideButton }: Props) {
  const { t } = useI18n();
  const limit = shareSeatLimit(useForgeStatus());
  const locked = limit === 0;
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 3200);
    return () => window.clearTimeout(timer);
  }, [hint]);

  function openShare() {
    if (locked) {
      setOpen(false);
      setHint(t("shareLocked"));
      return;
    }
    setHint(null);
    setOpen(true);
  }

  useEffect(() => {
    if (request > 0) openShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the request counter only
  }, [request]);

  return (
    <>
      {hideButton ? null : (
        <Button variant="ghost" size="sm" icon="users" className={className} aria-disabled={locked || undefined} onClick={openShare} title={t("shareTitle")}>
          <span className="f-bd-lbl">{t("bdShare")}</span>
        </Button>
      )}
      {hint ? (
        <p className="f-toast" role="status">
          <Glyph name="lock" size="sm" /> {hint}
        </p>
      ) : null}
      {open ? <ShareProjectModal projectId={projectId} projectName={projectName} seatLimit={limit} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
