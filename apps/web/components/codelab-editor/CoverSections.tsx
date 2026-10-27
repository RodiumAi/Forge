"use client";

/**
 * "Infos" tab sections for the cover, the presenter page and the setup page.
 * Each section edits a draft (empty rows and half-typed links are fine) and
 * writes only its schema-valid cleaned form into codelab.json, through the
 * editor's usual debounced save.
 */

import { useEffect, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import type { Codelab } from "@/lib/contracts/forge-design";
import { introPages, presenterOf } from "../codelab-player";
import { listFiles, uploadFile } from "./api";
import { isImage } from "./FilesPanel";
import {
  cleanCover,
  cleanPresenter,
  cleanSetup,
  withPageFlag,
  withSection,
  type CodelabCover,
  type CodelabPresenter,
  type CodelabSetup,
} from "./model";
import type { Translate } from "./strings";

/** Draft of a section, reset when codelab.json changes from elsewhere (AI, import). */
function useSectionDraft<T>(
  value: T | undefined,
  clean: (draft: T | undefined) => T | undefined,
  empty: () => T,
): [T, (next: T) => T | undefined] {
  const [draft, setDraft] = useState<T>(() => value ?? empty());
  const incoming = JSON.stringify(value ?? null);
  const [seen, setSeen] = useState(incoming);
  if (incoming !== seen) {
    setSeen(incoming);
    if (incoming !== JSON.stringify(clean(draft) ?? null)) setDraft(value ?? empty());
  }
  const update = (next: T) => {
    setDraft(next);
    const cleaned = clean(next);
    setSeen(JSON.stringify(cleaned ?? null));
    return cleaned;
  };
  return [draft, update];
}

function Section({ title, help, children, open }: { title: string; help: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="cle-section" open={open}>
      <summary>{title}</summary>
      <p className="cle-hint">{help}</p>
      {children}
    </details>
  );
}

function RowButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="cle-row-remove" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <X size={13} />
    </button>
  );
}

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="cle-row-add" onClick={onClick} disabled={disabled}>
      <Plus size={13} /> {label}
    </button>
  );
}

export type CoverSectionsProps = {
  projectId: string;
  codelab: Codelab;
  onChange: (codelab: Codelab) => void;
  assetUrl?: (path: string) => string;
  readOnly?: boolean;
  t: Translate;
  onError: (message: string) => void;
};

export function CoverSections(props: CoverSectionsProps) {
  return (
    <>
      <CoverSection {...props} />
      <PresenterSection {...props} />
      <SetupSection {...props} />
    </>
  );
}

function CoverSection({ codelab, onChange, readOnly, t }: CoverSectionsProps) {
  const [draft, update] = useSectionDraft<CodelabCover>(codelab.cover, cleanCover, () => ({}));
  const [highlights, setHighlights] = useState((draft.highlights ?? []).join("\n"));
  const joined = (codelab.cover?.highlights ?? []).join("\n");
  const [seenLines, setSeenLines] = useState(joined);
  if (joined !== seenLines) {
    setSeenLines(joined);
    if (joined !== highlights.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")) setHighlights(joined);
  }
  const commit = (next: CodelabCover) => onChange(withSection(codelab, "cover", update(next)));
  return (
    <Section title={t("coverSection")} help={t("coverHelp")}>
      <label>
        {t("eyebrow")}
        <input value={draft.eyebrow ?? ""} maxLength={160} disabled={readOnly} onChange={(e) => commit({ ...draft, eyebrow: e.target.value })} />
      </label>
      <label>
        {t("highlights")}
        <textarea
          rows={3}
          value={highlights}
          disabled={readOnly}
          onChange={(e) => {
            setHighlights(e.target.value);
            const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
            setSeenLines(lines.slice(0, 8).join("\n"));
            commit({ ...draft, highlights: lines });
          }}
        />
      </label>
      <label className="cle-check-row">
        <input
          type="checkbox"
          checked={draft.showQr !== false}
          disabled={readOnly}
          onChange={(e) => commit({ ...draft, showQr: e.target.checked ? undefined : false })}
        />
        {t("showQr")}
      </label>
    </Section>
  );
}

function PageToggle({
  codelab,
  page,
  label,
  onChange,
  readOnly,
}: {
  codelab: Codelab;
  page: "presenter" | "setup";
  label: string;
  onChange: (codelab: Codelab) => void;
  readOnly?: boolean;
}) {
  const shown = introPages(codelab).includes(page);
  const byDefault = introPages(withPageFlag(codelab, page, undefined)).includes(page);
  return (
    <label className="cle-check-row">
      <input
        type="checkbox"
        checked={codelab.pages?.[page] ?? shown}
        disabled={readOnly}
        onChange={(e) => {
          // Back to "shown when filled" when that already gives the wanted state.
          const wanted = e.target.checked;
          onChange(withPageFlag(codelab, page, wanted === byDefault ? undefined : wanted));
        }}
      />
      {label}
    </label>
  );
}

function PhotoPicker({
  projectId,
  value,
  onChange,
  assetUrl,
  readOnly,
  t,
  onError,
}: {
  projectId: string;
  value: string | undefined;
  onChange: (path: string | undefined) => void;
  assetUrl?: (path: string) => string;
  readOnly?: boolean;
  t: Translate;
  onError: (message: string) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    let alive = true;
    listFiles(projectId)
      .then((files) => alive && setImages(files.map((f) => f.path).filter(isImage)))
      .catch(() => alive && setImages([]));
    return () => {
      alive = false;
    };
  }, [projectId]);
  const options = value && !images.includes(value) ? [value, ...images] : images;
  return (
    <div className="cle-photo">
      {value && assetUrl ? (
        <img src={assetUrl(value)} alt="" className="cle-photo-preview" />
      ) : (
        <span className="cle-photo-preview" aria-hidden />
      )}
      <div className="cle-photo-tools">
        <label>
          {t("presenterPhoto")}
          <select value={value ?? ""} disabled={readOnly} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">{t("photoNone")}</option>
            {options.map((path) => (
              <option key={path} value={path}>
                {path.replace(/^public\/images\//, "")}
              </option>
            ))}
          </select>
        </label>
        {!readOnly ? (
          <span className="cle-photo-actions">
            <label className="cle-upload-btn">
              {uploading ? <Loader2 size={13} className="cle-spin" /> : <ImagePlus size={13} />} {t("photoUpload")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                hidden
                data-testid="presenter-photo-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  uploadFile(projectId, file, "public/images")
                    .then((saved) => {
                      setImages((list) => (list.includes(saved.path) ? list : [...list, saved.path]));
                      onChange(saved.path);
                    })
                    .catch((error) => onError(error instanceof Error ? error.message : String(error)))
                    .finally(() => setUploading(false));
                }}
              />
            </label>
            {value ? (
              <button type="button" className="cle-row-add" onClick={() => onChange(undefined)}>
                <Trash2 size={13} /> {t("photoRemove")}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PresenterSection({ projectId, codelab, onChange, assetUrl, readOnly, t, onError }: CoverSectionsProps) {
  const [draft, update] = useSectionDraft<CodelabPresenter>(codelab.presenter, cleanPresenter, () => ({}));
  const commit = (next: CodelabPresenter) => onChange(withSection(codelab, "presenter", update(next)));
  const links = draft.links ?? [];
  const field = (key: "name" | "role" | "company", label: string) => (
    <label>
      {label}
      <input
        value={draft[key] ?? ""}
        maxLength={120}
        disabled={readOnly}
        placeholder={key === "name" ? codelab.author?.name ?? "" : undefined}
        onChange={(e) => commit({ ...draft, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <Section title={t("presenterSection")} help={t("presenterHelp")}>
      <PageToggle codelab={codelab} page="presenter" label={t("showPresenterPage")} onChange={onChange} readOnly={readOnly || !presenterOf(codelab)} />
      {field("name", t("presenterName"))}
      {field("role", t("presenterRole"))}
      {field("company", t("presenterCompany"))}
      <PhotoPicker
        projectId={projectId}
        value={draft.photo}
        onChange={(photo) => commit({ ...draft, photo })}
        assetUrl={assetUrl}
        readOnly={readOnly}
        t={t}
        onError={onError}
      />
      <label>
        {t("presenterBio")}
        <textarea rows={4} maxLength={1500} value={draft.bio ?? ""} disabled={readOnly} onChange={(e) => commit({ ...draft, bio: e.target.value })} />
      </label>
      <p className="cle-sub">{t("links")}</p>
      {links.map((link, i) => (
        <div key={i} className="cle-row">
          <input
            aria-label={t("linkLabel")}
            placeholder={t("linkLabel")}
            value={link.label}
            maxLength={60}
            disabled={readOnly}
            onChange={(e) => commit({ ...draft, links: links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)) })}
          />
          <input
            aria-label="URL"
            placeholder="https://"
            value={link.url}
            disabled={readOnly}
            onChange={(e) => commit({ ...draft, links: links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) })}
          />
          {!readOnly ? <RowButton label={t("remove")} onClick={() => commit({ ...draft, links: links.filter((_, j) => j !== i) })} /> : null}
        </div>
      ))}
      {!readOnly ? (
        <AddButton label={t("addLink")} disabled={links.length >= 6} onClick={() => commit({ ...draft, links: [...links, { label: "", url: "" }] })} />
      ) : null}
    </Section>
  );
}

function SetupSection({ codelab, onChange, readOnly, t }: CoverSectionsProps) {
  const [draft, update] = useSectionDraft<CodelabSetup>(codelab.setup, cleanSetup, () => ({}));
  const commit = (next: CodelabSetup) => onChange(withSection(codelab, "setup", update(next)));
  const tools = draft.tools ?? [];
  const groups = draft.groups ?? [];
  const commands = draft.commands ?? [];
  const promo = draft.promo ?? { code: "" };
  const setGroup = (index: number, group: (typeof groups)[number]) =>
    commit({ ...draft, groups: groups.map((g, j) => (j === index ? group : g)) });
  return (
    <Section title={t("setupSection")} help={t("setupHelp")}>
      <PageToggle codelab={codelab} page="setup" label={t("showSetupPage")} onChange={onChange} readOnly={readOnly} />
      <label>
        {t("setupIntro")}
        <textarea rows={2} maxLength={1000} value={draft.intro ?? ""} disabled={readOnly} onChange={(e) => commit({ ...draft, intro: e.target.value })} />
      </label>

      <p className="cle-sub">{t("tools")}</p>
      {tools.map((tool, i) => (
        <div key={i} className="cle-row">
          <input
            aria-label={t("toolName")}
            placeholder={t("toolName")}
            value={tool.name}
            maxLength={80}
            disabled={readOnly}
            onChange={(e) => commit({ ...draft, tools: tools.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
          />
          <input
            aria-label={t("toolVersion")}
            placeholder={t("toolVersion")}
            className="cle-narrow"
            value={tool.version ?? ""}
            maxLength={40}
            disabled={readOnly}
            onChange={(e) => commit({ ...draft, tools: tools.map((x, j) => (j === i ? { ...x, version: e.target.value } : x)) })}
          />
          <input
            aria-label={t("urlOptional")}
            placeholder="https://"
            value={tool.url ?? ""}
            disabled={readOnly}
            onChange={(e) => commit({ ...draft, tools: tools.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
          />
          {!readOnly ? <RowButton label={t("remove")} onClick={() => commit({ ...draft, tools: tools.filter((_, j) => j !== i) })} /> : null}
        </div>
      ))}
      {!readOnly ? (
        <AddButton label={t("addTool")} disabled={tools.length >= 20} onClick={() => commit({ ...draft, tools: [...tools, { name: "" }] })} />
      ) : null}

      <p className="cle-sub">{t("setupGroups")}</p>
      {groups.map((group, g) => (
        <div key={g} className="cle-group">
          <div className="cle-row">
            <input
              aria-label={t("groupTitle")}
              placeholder={t("groupTitle")}
              value={group.title}
              maxLength={120}
              disabled={readOnly}
              onChange={(e) => setGroup(g, { ...group, title: e.target.value })}
            />
            {!readOnly ? <RowButton label={t("remove")} onClick={() => commit({ ...draft, groups: groups.filter((_, j) => j !== g) })} /> : null}
          </div>
          <ol>
            {group.items.map((item, i) => (
              <li key={i} className="cle-row cle-row-wrap">
                <input
                  aria-label={t("itemText")}
                  placeholder={t("itemText")}
                  value={item.text}
                  maxLength={300}
                  disabled={readOnly}
                  onChange={(e) => setGroup(g, { ...group, items: group.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                />
                <input
                  aria-label={t("urlOptional")}
                  placeholder="https://"
                  value={item.url ?? ""}
                  disabled={readOnly}
                  onChange={(e) => setGroup(g, { ...group, items: group.items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                />
                <input
                  aria-label={t("itemCode")}
                  placeholder={t("itemCode")}
                  className="cle-narrow"
                  value={item.code ?? ""}
                  maxLength={200}
                  disabled={readOnly}
                  onChange={(e) => setGroup(g, { ...group, items: group.items.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })}
                />
                {!readOnly ? (
                  <RowButton label={t("remove")} onClick={() => setGroup(g, { ...group, items: group.items.filter((_, j) => j !== i) })} />
                ) : null}
              </li>
            ))}
          </ol>
          {!readOnly ? (
            <AddButton
              label={t("addItem")}
              disabled={group.items.length >= 12}
              onClick={() => setGroup(g, { ...group, items: [...group.items, { text: "" }] })}
            />
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <AddButton label={t("addGroup")} disabled={groups.length >= 6} onClick={() => commit({ ...draft, groups: [...groups, { title: "", items: [{ text: "" }] }] })} />
      ) : null}

      <p className="cle-sub">{t("promo")}</p>
      <div className="cle-row cle-row-wrap">
        <input
          aria-label={t("promoCode")}
          placeholder={t("promoCode")}
          className="cle-narrow"
          value={promo.code}
          maxLength={64}
          disabled={readOnly}
          onChange={(e) => commit({ ...draft, promo: { ...promo, code: e.target.value } })}
        />
        <input
          aria-label={t("promoLabel")}
          placeholder={t("promoLabel")}
          value={promo.label ?? ""}
          maxLength={200}
          disabled={readOnly}
          onChange={(e) => commit({ ...draft, promo: { ...promo, label: e.target.value } })}
        />
        <input
          aria-label={t("urlOptional")}
          placeholder="https://"
          value={promo.url ?? ""}
          disabled={readOnly}
          onChange={(e) => commit({ ...draft, promo: { ...promo, url: e.target.value } })}
        />
      </div>

      <p className="cle-sub">{t("commands")}</p>
      {commands.map((command, i) => (
        <div key={i} className="cle-group">
          <div className="cle-row">
            <input
              aria-label={t("commandLabel")}
              placeholder={t("commandLabel")}
              value={command.label ?? ""}
              maxLength={120}
              disabled={readOnly}
              onChange={(e) => commit({ ...draft, commands: commands.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
            />
            <input
              aria-label={t("commandLanguage")}
              placeholder="bash"
              className="cle-narrow"
              value={command.language ?? ""}
              maxLength={32}
              disabled={readOnly}
              onChange={(e) => commit({ ...draft, commands: commands.map((x, j) => (j === i ? { ...x, language: e.target.value } : x)) })}
            />
            {!readOnly ? (
              <RowButton label={t("remove")} onClick={() => commit({ ...draft, commands: commands.filter((_, j) => j !== i) })} />
            ) : null}
          </div>
          <textarea
            aria-label={t("commandCode")}
            className="cle-mono"
            rows={3}
            maxLength={4000}
            value={command.code}
            disabled={readOnly}
            spellCheck={false}
            onChange={(e) => commit({ ...draft, commands: commands.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })}
          />
        </div>
      ))}
      {!readOnly ? (
        <AddButton label={t("addCommand")} disabled={commands.length >= 12} onClick={() => commit({ ...draft, commands: [...commands, { language: "bash", code: "" }] })} />
      ) : null}
    </Section>
  );
}
