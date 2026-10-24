"use client";

import { ArrowUp, Plus, X } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";

import { DesignSystemPicker, type DesignSystemOption } from "@/components/home/DesignSystemPicker";
import type { HomeTile } from "@/components/home/home-kinds";
import { ModelPicker } from "@/components/home/ModelPicker";
import { PromptFileChips } from "@/components/PromptFileChips";
import { Icon } from "@/components/ui/icon";
import { PROMPT_MAX_CHARS } from "@/lib/constants/prompt";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectKindId } from "@/lib/kinds";
import { PROMPT_FILE_ACCEPT, type PromptAttachment } from "@/lib/prompt-attachments";

const PLACEHOLDERS: Record<ProjectKindId, MessageKey> = {
  web: "promptPlaceholder",
  mobile: "promptPlaceholderMobile",
  slides: "homePromptPlaceholderSlides",
  codelab: "homePromptPlaceholderCodelab",
  design_system: "homePromptPlaceholderDesignSystem",
};

export type CreatePromptHandle = { focus: () => void };

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  files: PromptAttachment[];
  onAddFiles: (list: FileList) => void;
  onRemoveFile: (id: string) => void;
  /** Selected tile, shown as a removable chip; `null` or Blank shows nothing. */
  tile: HomeTile | null;
  onClearTile: () => void;
  designSystems: readonly DesignSystemOption[];
  designSystemId: string | null;
  onDesignSystemChange: (id: string | null) => void;
  /** Off while the design_system kind is switched off. */
  showDesignSystems: boolean;
  busy: boolean;
  suggestions?: readonly string[];
  /** Alerts above the text (file errors, credit gates). */
  alerts?: ReactNode;
};

/** The "Que créons-nous ?" box: text, files, design system, model, send. */
export const CreatePrompt = forwardRef<CreatePromptHandle, Props>(function CreatePrompt(
  {
    value,
    onChange,
    onSubmit,
    files,
    onAddFiles,
    onRemoveFile,
    tile,
    onClearTile,
    designSystems,
    designSystemId,
    onDesignSystemChange,
    showDesignSystems,
    busy,
    suggestions = [],
    alerts,
  },
  ref,
) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 220)}px`;
  }, [value]);

  const canSubmit = Boolean(value.trim() || files.length) && !busy;
  const placeholderKind = tile?.kind ?? null;
  const placeholder = placeholderKind ? t(PLACEHOLDERS[placeholderKind]) : t("homePromptPlaceholder");

  return (
    <form
      className="fdh-prompt"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!busy && event.dataTransfer.files?.length) onAddFiles(event.dataTransfer.files);
      }}
    >
      <PromptFileChips items={files} onRemove={onRemoveFile} />
      {alerts}
      {value.length > PROMPT_MAX_CHARS - 1000 ? (
        <p className={`prompt-char-count${value.length >= PROMPT_MAX_CHARS ? " at-limit" : ""}`} aria-live="polite">
          {value.length.toLocaleString()} / {PROMPT_MAX_CHARS.toLocaleString()}
        </p>
      ) : null}
      <textarea
        ref={textareaRef}
        value={value}
        maxLength={PROMPT_MAX_CHARS}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        placeholder={placeholder}
        aria-label={t("promptAria")}
        rows={3}
        disabled={busy}
      />
      <div className="fdh-prompt-bar">
        <input
          ref={fileInputRef}
          type="file"
          className="landing-import-input"
          multiple
          accept={PROMPT_FILE_ACCEPT}
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            if (event.target.files?.length) onAddFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="fdh-icon-btn fdh-plus"
          aria-label={t("importAria")}
          title={t("importAria")}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          <Icon icon={Plus} />
        </button>
        {tile && tile.kind ? (
          <span className={`fdh-pill fdh-type-chip fdh-tone-${tile.kind}`}>
            <Icon icon={tile.icon} className="ui-icon-sm" />
            <span>{t("homeSelectedType").replace("{type}", t(tile.labelKey))}</span>
            <button
              type="button"
              className="fdh-chip-clear"
              aria-label={t("homeClearType")}
              onClick={onClearTile}
              disabled={busy}
            >
              <Icon icon={X} className="ui-icon-sm" />
            </button>
          </span>
        ) : null}
        {showDesignSystems ? (
          <DesignSystemPicker
            options={designSystems}
            value={designSystemId}
            onChange={onDesignSystemChange}
            disabled={busy}
          />
        ) : null}
        <ModelPicker disabled={busy} />
        <button
          type="submit"
          className="lp-send fdh-send"
          disabled={!canSubmit}
          aria-label={t("homeSend")}
          title={!canSubmit ? t("createNeedPrompt") : undefined}
        >
          {busy ? (
            t("loading")
          ) : (
            <>
              <span className="lp-send-label">{t("homeSend")}</span>
              <Icon icon={ArrowUp} />
            </>
          )}
        </button>
      </div>
      {suggestions.length ? (
        <div className="home-prompt-suggestions fdh-suggestions" aria-label={t("promptSuggestLabel")}>
          {suggestions.map((full) => (
            <button
              key={full}
              type="button"
              className="home-prompt-suggest"
              title={full}
              disabled={busy}
              onClick={() => {
                onChange(full);
                textareaRef.current?.focus();
              }}
            >
              <span>{full}</span>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
});
