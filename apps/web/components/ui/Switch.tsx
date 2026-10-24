"use client";

import { useId, type ReactNode } from "react";

import { cx } from "./cx";

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name when there is no visible label wired with `labelledBy`. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** Orange on/off switch (role="switch"). */
export function Switch({ checked, onChange, label, labelledBy, describedBy, disabled, size = "md", className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      className={cx("f-switch", size === "sm" && "f-switch-sm", className)}
      onClick={() => onChange(!checked)}
    />
  );
}

/** Settings row: title and description on the left, the switch on the right. */
export function SwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="f-switch-row">
      <div style={{ minWidth: 0 }}>
        <b id={`${id}-t`}>{title}</b>
        {description ? <small id={`${id}-d`}>{description}</small> : null}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        labelledBy={`${id}-t`}
        describedBy={description ? `${id}-d` : undefined}
      />
    </div>
  );
}
