"use client";

/**
 * Password input with a show/hide toggle.
 *
 * Typing a password blind is where most sign-in failures actually come from,
 * and the cost of revealing it is bounded — the person is looking at their own
 * screen, and the field goes back to masked on the next render of a new page.
 *
 * The button is `tabIndex={-1}` so tabbing runs email → password → submit
 * without a detour, and `aria-pressed` tells a screen reader which state it is
 * in rather than just announcing "button".
 */

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { AuthField } from "@/components/auth/AuthCard";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
  minLength,
  disabled,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <AuthField id={fieldId} label={label}>
      <div className="auth-password">
        <input
          id={fieldId}
          className="input auth-password-input"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("authHidePassword") : t("authShowPassword")}
          aria-pressed={visible}
          aria-controls={fieldId}
          tabIndex={-1}
          disabled={disabled}
        >
          {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </AuthField>
  );
}
