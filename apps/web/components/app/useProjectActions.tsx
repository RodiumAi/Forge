"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ShareProjectModal } from "@/components/builder/ShareProjectModal";
import { useFavorites, useLastOpened } from "@/components/home/use-home-prefs";
import { invalidateThumbCache } from "@/components/SiteThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { shareSeatLimit, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { patchProject, prependProject, removeProject } from "@/lib/lists-cache";
import { getSessionSnapshot, subscribeSession } from "@/lib/session-cache";

import { projectHref, type AppProject } from "./project-data";
import type { ProjectCardActions } from "./ProjectCard";
import { useToast } from "./useToast";

function RenameDialog({ project, onClose, onSaved }: { project: AppProject; onClose: () => void; onSaved: (p: AppProject) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = value.trim();
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t("homeRenameTitle")}
      closeLabel={t("uiClose")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("homeCancel")}
          </Button>
          <Button type="submit" form="f-rename-form" loading={busy} disabled={!name || name === project.name}>
            {t("homeSave")}
          </Button>
        </>
      }
    >
      <form
        id="f-rename-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name || busy) return;
          setBusy(true);
          setError(null);
          api<AppProject>(`/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name }) })
            .then((updated) => onSaved({ ...project, name: updated?.name ?? name, slug: updated?.slug ?? project.slug }))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : t("errorGeneric"));
              setBusy(false);
            });
        }}
      >
        <Field label={t("homeRenameLabel")} error={error}>
          <Input data-autofocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} disabled={busy} />
        </Field>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ project, onClose, onDeleted }: { project: AppProject; onClose: () => void; onDeleted: () => void }) {
  const { t } = useI18n();
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
          api(`/projects/${project.id}`, { method: "DELETE" })
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

function useAccount(): string | null {
  const [email, setEmail] = useState<string | null>(() =>
    typeof window !== "undefined" ? (getSessionSnapshot()?.profile?.email ?? null) : null,
  );
  useEffect(() => {
    setEmail(getSessionSnapshot()?.profile?.email ?? null);
    return subscribeSession((snap) => setEmail(snap?.profile?.email ?? null));
  }, []);
  return email;
}

/**
 * The project actions of the app pages (open, rename, duplicate, share,
 * delete, favourite) with their dialogs. `onChange` receives the list edits
 * so the page can update what it shows; the session list cache is kept in sync.
 */
export function useProjectActions(onChange: (change: { removed?: string; added?: AppProject; patched?: AppProject }) => void): {
  actions: ProjectCardActions;
  dialogs: ReactNode;
  favorites: ReadonlySet<string>;
  notify: (text: string) => void;
} {
  const router = useRouter();
  const { t, locale } = useI18n();
  const forge = useForgeStatus();
  const account = useAccount();
  const favorites = useFavorites(account);
  const lastOpened = useLastOpened(account);
  const [renaming, setRenaming] = useState<AppProject | null>(null);
  const [deleting, setDeleting] = useState<AppProject | null>(null);
  const [sharing, setSharing] = useState<AppProject | null>(null);
  const [toast, notify] = useToast();

  async function duplicate(project: AppProject) {
    notify(t("apDuplicating").replace("{name}", project.name), "copy");
    try {
      const copy = await api<AppProject>(`/projects/${project.id}/duplicate`, { method: "POST", retries: 0 });
      prependProject(locale, copy);
      onChange({ added: copy });
      notify(t("apDuplicated").replace("{name}", copy.name), "check");
    } catch (err) {
      if (err instanceof ApiError && err.code === "project_quota_exceeded") notify(t("projectQuotaReached"), "alert");
      else notify(err instanceof Error ? err.message : t("errorGeneric"), "alert");
    }
  }

  const actions: ProjectCardActions = {
    open: (project) => {
      lastOpened.record(project.id);
      router.push(projectHref(project));
    },
    rename: setRenaming,
    duplicate: (project) => void duplicate(project),
    share: setSharing,
    remove: setDeleting,
    isFavorite: favorites.isFavorite,
    toggleFavorite: (id) => {
      const on = !favorites.isFavorite(id);
      favorites.toggle(id);
      notify(on ? t("apFavAdded") : t("apFavRemoved"), "star");
    },
    onThumbPersisted: (id, info) => {
      const patch = { has_thumbnail: true, ...(info?.updated_at ? { updated_at: info.updated_at } : {}) };
      patchProject(locale, id, patch);
    },
  };

  const dialogs = (
    <>
      {toast}
      {renaming ? (
        <RenameDialog
          project={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(next) => {
            patchProject(locale, next.id, { name: next.name, slug: next.slug });
            onChange({ patched: next });
            setRenaming(null);
            notify(t("apRenamed"), "check");
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          project={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            removeProject(locale, deleting.id);
            invalidateThumbCache(deleting.id);
            onChange({ removed: deleting.id });
            setDeleting(null);
            notify(t("apDeleted"), "trash");
          }}
        />
      ) : null}
      {sharing ? (
        <ShareProjectModal
          projectId={sharing.id}
          projectName={sharing.name}
          seatLimit={shareSeatLimit(forge)}
          onClose={() => setSharing(null)}
        />
      ) : null}
    </>
  );

  return { actions, dialogs, favorites: favorites.ids, notify };
}
