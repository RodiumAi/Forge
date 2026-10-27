"use client";

/**
 * Password input with a show/hide toggle.
 *
 * Typing a password blind is where most sign-in failures actually come from,
 * and the cost of revealing it is bounded: the person is looking at their own
 * screen, and the field goes back to masked on the next page.
 *
 * The toggle is `tabIndex={-1}` so tabbing runs email, password, submit
 * without a detour, and `aria-pressed` tells a screen reader which state it is
 * in rather than just announcing "button".
 *
 * New passwords show the length rule as a live hint that turns green once it
 * is met; Caps Lock is flagged while the field has focus.
 */

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { AuthFieldMessage } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  required = true,
  minLength,
  disabled,
  error,
  aside,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  /** Inline error, already translated. */
  error?: string | null;
  /** Right side of the label row ("Forgot password?"). */
  aside?: ReactNode;
}) {
  const { t } = useI18n();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const msgId = `${fieldId}-msg`;
  const capsId = `${fieldId}-caps`;
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);

  const rule = minLength ? (value.length >= minLength ? "ok" : "todo") : null;
  const success = !error && rule === "ok" ? t("lndAuthPassRuleOk") : null;
  const hint = !error && rule === "todo" && value ? t("lndAuthPassRule") : null;
  const describedBy = [error || success || hint ? msgId : null, caps ? capsId : null].filter(Boolean).join(" ");

  function readCaps(event: React.KeyboardEvent<HTMLInputElement>) {
    try {
      setCaps(event.getModifierState("CapsLock"));
    } catch {
      /* old browsers */
    }
  }

  return (
    <div className={cx("f-auth-field", error && "has-error", success && "has-success")}>
      <div className="f-auth-label-row">
        <label htmlFor={fieldId}>{label}</label>
        {aside}
      </div>
      <div className="f-auth-pass">
        <Input
          id={fieldId}
          className={cx(success && "is-valid")}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => {
            setCaps(false);
            onBlur?.();
          }}
        />
        <button
          type="button"
          className="f-auth-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("authHidePassword") : t("authShowPassword")}
          aria-pressed={visible}
          aria-controls={fieldId}
          tabIndex={-1}
          disabled={disabled}
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {caps ? (
        <span id={capsId} className="f-auth-msg is-warn">
          <Glyph name="alert" size="sm" />
          {t("lndAuthCapsLock")}
        </span>
      ) : null}
      <AuthFieldMessage id={msgId} error={error} success={success} hint={hint} />
    </div>
  );
}
