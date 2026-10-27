"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "./cx";
import { Glyph } from "./glyph";

/** 44px text input (12px radius, orange focus ring). */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { inputSize?: "sm" | "md" }>(
  function Input({ className, inputSize = "md", ...rest }, ref) {
    return <input ref={ref} {...rest} className={cx("f-input", inputSize === "sm" && "f-input-sm", className)} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} {...rest} className={cx("f-textarea", className)} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} {...rest} className={cx("f-select", className)}>
      {children}
    </select>
  );
});

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** One input element; Field wires its id, aria-describedby and aria-invalid. */
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  className?: string;
};

/** Label + control + hint or error, correctly associated. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const autoId = useId();
  const id = (isValidElement(children) && children.props.id) || autoId;
  const hintId = `${id}-hint`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": hint || error ? hintId : undefined,
        "aria-invalid": error ? true : undefined,
      })
    : children;
  return (
    <div className={cx("f-field", className)}>
      <label htmlFor={id}>{label}</label>
      {control}
      {error ? (
        <span id={hintId} className="f-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <small id={hintId}>{hint}</small>
      ) : null}
    </div>
  );
}

/** Rounded search field with a magnifier (galleries, toolbars). */
export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; wrapClassName?: string }
>(function SearchInput({ label, wrapClassName, className, ...rest }, ref) {
  return (
    <label className={cx("f-search", wrapClassName)}>
      <Glyph name="search" size="sm" />
      <span className="f-sr-only">{label}</span>
      <input ref={ref} type="search" autoComplete="off" {...rest} className={className} />
    </label>
  );
});
