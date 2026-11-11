"use client";

/**
 * Project deletion shared by the home cards, the editors (deck, design
 * system) and the codelab page: the confirm dialog (type the project name),
 * the `DELETE /projects/{id}` call and the cleanup of the local caches.
 */

import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import { invalidateThumbCache } from "@/components/SiteThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { clearBootPrompt } from "@/lib/create-project";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { removeProject } from "@/lib/lists-cache";

export type DeletableProject = { id: string; name: string };

/** Deletes the project on the API, then forgets it in the session caches. */
export async function deleteProject(projectId: string, locale: string): Promise<void> {
  await api(`/projects/${projectId}`, { method: "DELETE" });
  forgetProject(projectId, locale);
}

/** Drops a deleted project from the list cache, the thumbnails and the boot prompt. */
export function forgetProject(projectId: string, locale: string): void {
  clearBootPrompt(projectId);
  removeProject(locale, projectId);
  invalidateThumbCache(projectId);
}

/** Same guard as the builder: type the project name to delete it. */
export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: DeletableProject;
  onClose: () => void;
  /** Called once the project is deleted and forgotten locally. */
  onDeleted: () => void;
}) {
  const { t, locale } = useI18n();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = confirm.trim() === project.name.trim();
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t("homeDeleteTitle").replace("{name}", project.name)}
      description={t("optionsDangerHelp")}
      closeLabel={t("uiClose")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("homeCancel")}
          </Button>
          <Button variant="danger" type="submit" form="f-delete-form" icon="trash" loading={busy} disabled={!ok}>
            {busy ? t("optionsDangerDeleting") : t("optionsDangerDelete")}
          </Button>
        </>
      }
    >
      <form
        id="f-delete-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ok || busy) return;
          setBusy(true);
          setError(null);
          deleteProject(project.id, locale)
            .then(onDeleted)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : t("errorGeneric"));
              setBusy(false);
            });
        }}
      >
        <Field label={t("optionsDangerConfirm").replace("{name}", project.name)} error={error}>
          <Input data-autofocus value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" disabled={busy} />
        </Field>
      </form>
    </Dialog>
  );
}

/**
 * The "Delete project" action of an editor: `request()` opens the confirm
 * dialog, render `dialog` once; after deletion the page goes to `afterHref`.
 */
export function useDeleteProject(project: DeletableProject | null, afterHref: string): {
  request: () => void;
  dialog: ReactNode;
} {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const request = useCallback(() => setOpen(true), []);
  const dialog =
    open && project ? (
      <DeleteProjectDialog
        project={project}
        onClose={() => setOpen(false)}
        onDeleted={() => {
          setOpen(false);
          router.replace(afterHref);
        }}
      />
    ) : null;
  return { request, dialog };
}
