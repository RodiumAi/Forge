"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Dialog } from "@/components/ui/Dialog";
import { Glyph } from "@/components/ui/glyph";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Tabs";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";

import {
  LOGO_ACCEPT,
  MAX_BRAND_COLORS,
  TONE_IDS,
  checkLogoFile,
  hasErrors,
  intakeFromText,
  normalizeHex,
  validateIntake,
  type IntakeErrorCode,
  type IntakeErrors,
  type IntakeFields,
  type IntakeLocale,
  type LogoSlot,
} from "./brand-intake";
import "./brand-intake.css";

const ERROR_KEYS: Record<IntakeErrorCode, MessageKey> = {
  name_required: "apDsiNameRequired",
  website_https: "apDsiWebsiteHttps",
  website_invalid: "apDsiWebsiteInvalid",
  color_invalid: "apDsiColorInvalid",
  logo_type: "apDsiLogoType",
  logo_size: "apDsiLogoSize",
  dark_needs_logo: "apDsiDarkNeedsLogo",
};

const SLOT_LABELS: Record<LogoSlot, MessageKey> = { logo: "apDsiLogo", logoDark: "apDsiLogoDark", icon: "apDsiIcon" };

export type BrandIntakeDialogProps = {
  open: boolean;
  onClose: () => void;
  /** What the composer held: a name prefills the name, a brief the details. */
  initialText?: string;
  /** An image already attached in the composer, offered as the main logo. */
  initialLogo?: File | null;
  busy?: boolean;
  /** Shown under the form (create failure, credit gate). */
  error?: string | null;
  onSubmit: (fields: IntakeFields) => void;
};

function startFields(text: string, logo: File | null, language: IntakeLocale): IntakeFields {
  const fields = intakeFromText(text, language);
  return logo && !checkLogoFile(logo) ? { ...fields, logo } : fields;
}

/** "Créer une charte graphique": the brand details asked before a design system is generated. */
export function BrandIntakeDialog({
  open,
  onClose,
  initialText = "",
  initialLogo = null,
  busy,
  error,
  onSubmit,
}: BrandIntakeDialogProps) {
  const { t, locale } = useI18n();
  const [fields, setFields] = useState<IntakeFields>(() => startFields(initialText, initialLogo, locale as IntakeLocale));
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [tried, setTried] = useState(false);

  // Each opening starts from what the composer holds now.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setFields(startFields(initialText, initialLogo, locale as IntakeLocale));
      setErrors({});
      setTried(false);
    }
    wasOpen.current = open;
  }, [open, initialText, initialLogo, locale]);

  function patch(next: Partial<IntakeFields>) {
    setFields((prev) => {
      const merged = { ...prev, ...next };
      if (tried) setErrors(validateIntake(merged));
      return merged;
    });
  }

  function pickFile(slot: LogoSlot, file: File | null) {
    const code = file ? checkLogoFile(file) : null;
    if (code) {
      setErrors((prev) => ({ ...prev, [slot]: code }));
      return;
    }
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[slot];
      if (slot === "logo" && !file) delete rest.logoDark;
      return rest;
    });
    // Without a main logo there is no dark version (the logo endpoint needs the main one).
    if (slot === "logo" && !file) patch({ logo: null, logoDark: null });
    else patch({ [slot]: file } as Partial<IntakeFields>);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateIntake(fields);
    setTried(true);
    setErrors(found);
    if (hasErrors(found)) return;
    onSubmit({ ...fields, colors: fields.colors.map((c) => normalizeHex(c) ?? c) });
  }

  const err = (code: IntakeErrorCode | undefined) => (code ? t(ERROR_KEYS[code]) : undefined);
  const customColors = fields.colors.length > 0;

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={t("apDsiTitle")}
      description={t("apDsiLead")}
      size="wide"
      closeLabel={t("uiClose")}
      className="dsi"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("apDsiCancel")}
          </Button>
          <Button type="submit" form="dsi-form" icon="sparkles" loading={busy}>
            {t("apDsiSubmit")}
          </Button>
        </>
      }
    >
      <form id="dsi-form" className="dsi-form" noValidate onSubmit={submit}>
        <section className="dsi-section" aria-labelledby="dsi-brand">
          <h3 id="dsi-brand">{t("apDsiSectionBrand")}</h3>
          <Field label={`${t("apDsiName")} *`} error={err(errors.name)}>
            <Input
              data-autofocus
              value={fields.name}
              maxLength={120}
              required
              placeholder={t("apDsiNamePh")}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Field>
          <div className="dsi-grid">
            <Field label={t("apDsiActivity")}>
              <Input
                value={fields.activity}
                maxLength={200}
                placeholder={t("apDsiActivityPh")}
                onChange={(event) => patch({ activity: event.target.value })}
              />
            </Field>
            <Field label={t("apDsiAudience")}>
              <Input
                value={fields.audience}
                maxLength={200}
                placeholder={t("apDsiAudiencePh")}
                onChange={(event) => patch({ audience: event.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="dsi-section" aria-labelledby="dsi-logo">
          <h3 id="dsi-logo">
            {t("apDsiSectionLogo")} <small>{t("apDsiLogoHint")}</small>
          </h3>
          <div className="dsi-logos">
            {(["logo", "logoDark", "icon"] as const).map((slot) => (
              <LogoPicker
                key={slot}
                slot={slot}
                label={t(SLOT_LABELS[slot])}
                file={fields[slot]}
                disabled={busy || (slot === "logoDark" && !fields.logo)}
                error={err(errors[slot])}
                onPick={(file) => pickFile(slot, file)}
              />
            ))}
          </div>
        </section>

        <section className="dsi-section">
          <Field label={t("apDsiWebsite")} hint={t("apDsiWebsiteHint")} error={err(errors.website)}>
            <Input
              type="url"
              inputMode="url"
              autoComplete="url"
              value={fields.website}
              maxLength={300}
              placeholder={t("apDsiWebsitePh")}
              onChange={(event) => patch({ website: event.target.value })}
            />
          </Field>
        </section>

        <section className="dsi-section" aria-labelledby="dsi-style">
          <h3 id="dsi-style">{t("apDsiSectionStyle")}</h3>
          <div className="f-field">
            <span className="f-field-label">{t("apDsiColors")}</span>
            <div className="dsi-colors">
              <button
                type="button"
                className={cx("f-chip", !customColors && "is-on")}
                aria-pressed={!customColors}
                onClick={() => patch({ colors: [] })}
              >
                <Glyph name="sparkles" size="xs" />
                {t("apDsiForgeChooses")}
              </button>
              {fields.colors.map((value, index) => (
                <ColorInput
                  key={index}
                  index={index}
                  value={value}
                  onChange={(next) => patch({ colors: fields.colors.map((c, i) => (i === index ? next : c)) })}
                  onRemove={() => patch({ colors: fields.colors.filter((_, i) => i !== index) })}
                />
              ))}
              {fields.colors.length < MAX_BRAND_COLORS ? (
                <Button
                  variant="subtle"
                  size="sm"
                  icon="plus"
                  onClick={() => patch({ colors: [...fields.colors, fields.colors.length ? "#1c1f26" : "#eb6118"] })}
                >
                  {t("apDsiAddColor")}
                </Button>
              ) : null}
            </div>
            {errors.colors ? (
              <span className="f-field-error" role="alert">
                {err(errors.colors)}
              </span>
            ) : null}
          </div>
          <Field label={t("apDsiFonts")} hint={t("apDsiFontsHint")}>
            <Input
              value={fields.fonts}
              maxLength={160}
              placeholder={t("apDsiFontsPh")}
              onChange={(event) => patch({ fonts: event.target.value })}
            />
          </Field>
        </section>

        <section className="dsi-section" aria-labelledby="dsi-voice">
          <h3 id="dsi-voice">{t("apDsiSectionVoice")}</h3>
          <div className="f-field">
            <span className="f-field-label" id="dsi-tone-label">
              {t("apDsiTone")}
            </span>
            <div className="f-chip-row" role="group" aria-labelledby="dsi-tone-label">
              {TONE_IDS.map((id) => {
                const on = fields.tones.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={cx("f-chip", on && "is-on")}
                    aria-pressed={on}
                    onClick={() =>
                      patch({ tones: on ? fields.tones.filter((x) => x !== id) : [...fields.tones, id] })
                    }
                  >
                    {on ? <Glyph name="check" size="xs" /> : null}
                    {t(`apDsiTone_${id}` as MessageKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="dsi-grid">
            <Field label={t("apDsiToneNotes")}>
              <Input
                value={fields.toneNotes}
                maxLength={300}
                placeholder={t("apDsiToneNotesPh")}
                onChange={(event) => patch({ toneNotes: event.target.value })}
              />
            </Field>
            <Field label={t("apDsiAvoid")}>
              <Input
                value={fields.avoid}
                maxLength={300}
                placeholder={t("apDsiAvoidPh")}
                onChange={(event) => patch({ avoid: event.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="dsi-section dsi-last" aria-label={t("apDsiLanguage")}>
          <div className="f-field">
            <span className="f-field-label">{t("apDsiLanguage")}</span>
            <Segmented<IntakeLocale>
              label={t("apDsiLanguage")}
              value={fields.language}
              onChange={(language) => patch({ language })}
              items={[
                { id: "fr", label: "Français" },
                { id: "en", label: "English" },
              ]}
            />
          </div>
          {fields.notes ? (
            <Field label={t("apDsiNotes")}>
              <Textarea rows={3} value={fields.notes} maxLength={2000} onChange={(event) => patch({ notes: event.target.value })} />
            </Field>
          ) : null}
        </section>

        {tried && hasErrors(errors) ? (
          <p className="f-error" role="alert">
            {t("apDsiFixErrors")}
          </p>
        ) : null}
        {error ? (
          <p className="f-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function LogoPicker({
  slot,
  label,
  file,
  disabled,
  error,
  onPick,
}: {
  slot: LogoSlot;
  label: string;
  file: File | null;
  disabled?: boolean;
  error?: string;
  onPick: (file: File | null) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={cx("dsi-logo", slot === "logoDark" && "is-dark", disabled && "is-disabled")}>
      <label htmlFor={inputId} className="dsi-logo-label">
        {label}
        {slot === "logo" ? null : <small>{t("apDsiOptional")}</small>}
      </label>
      <div className="dsi-logo-box">
        {preview ? <img src={preview} alt="" /> : <Glyph name={slot === "icon" ? "square" : "image"} />}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={LOGO_ACCEPT}
        className="f-sr-only"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          onPick(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <div className="dsi-logo-acts">
        <Button variant="subtle" size="xs" icon="upload" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {file ? file.name : t("apDsiLogoPick")}
        </Button>
        {file ? (
          <IconButton
            icon="x"
            size="sm"
            plain
            label={t("apDsiLogoRemove").replace("{name}", file.name)}
            onClick={() => onPick(null)}
          />
        ) : null}
      </div>
      {error ? (
        <span className="f-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function ColorInput({
  index,
  value,
  onChange,
  onRemove,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const n = String(index + 1);
  const hex = normalizeHex(value);
  return (
    <span className={cx("dsi-color", !hex && "is-invalid")}>
      <input
        type="color"
        aria-label={t("apDsiColorN").replace("{n}", n)}
        value={hex ?? "#000000"}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        className="dsi-hex"
        aria-label={t("apDsiColorHex").replace("{n}", n)}
        aria-invalid={hex ? undefined : true}
        value={value}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      <IconButton icon="x" size="sm" plain label={t("apDsiRemoveColor").replace("{n}", n)} onClick={onRemove} />
    </span>
  );
}
