"use client";

import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cx } from "./cx";
import { Glyph, type GlyphName } from "./glyph";

export type ButtonVariant = "primary" | "ghost" | "subtle" | "dark" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Glyph before the label. */
  icon?: GlyphName;
  /** Glyph after the label. */
  iconEnd?: GlyphName;
  block?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  children?: ReactNode;
};

type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    /** External links open in a new tab with rel="noopener". */
    external?: boolean;
  };

export type ButtonProps = AsButton | AsLink;

function classes(variant: ButtonVariant, size: ButtonSize, block?: boolean, extra?: string) {
  return cx("f-btn", `f-btn-${variant}`, size !== "md" && `f-btn-${size}`, block && "f-btn-block", extra);
}

function Inner({ icon, iconEnd, loading, children, size }: Common) {
  const glyph = size === "lg" ? "md" : "sm";
  return (
    <>
      {loading ? <Glyph name="refresh" size={glyph} className="f-spin" /> : icon ? <Glyph name={icon} size={glyph} /> : null}
      {children}
      {iconEnd ? <Glyph name={iconEnd} size={glyph} /> : null}
    </>
  );
}

/** Pill button: primary (flat orange), ghost, subtle, dark, danger, link. Renders a Link when `href` is set. */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const { variant = "primary", size = "md", icon, iconEnd, block, loading, children, className } = props;
  const cls = classes(variant, size, block, className);
  if (props.href !== undefined) {
    const { href, external, variant: _v, size: _s, icon: _i, iconEnd: _e, block: _b, loading: _l, ...rest } = props as AsLink;
    if (external) {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} target="_blank" rel="noopener noreferrer" {...rest} className={cls}>
          <Inner icon={icon} iconEnd={iconEnd} loading={loading} size={size}>{children}</Inner>
        </a>
      );
    }
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} {...rest} className={cls}>
        <Inner icon={icon} iconEnd={iconEnd} loading={loading} size={size}>{children}</Inner>
      </Link>
    );
  }
  const { variant: _v, size: _s, icon: _i, iconEnd: _e, block: _b, loading: _l, type = "button", disabled, ...rest } = props as AsButton;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
      className={cls}
    >
      <Inner icon={icon} iconEnd={iconEnd} loading={loading} size={size}>{children}</Inner>
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: GlyphName;
  /** Required: the accessible name (also the native tooltip unless `title` is given). */
  label: string;
  size?: "sm" | "md" | "lg";
  /** `plain` has no border until hovered. */
  plain?: boolean;
  square?: boolean;
  href?: undefined;
};

type IconLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  icon: GlyphName;
  label: string;
  size?: "sm" | "md" | "lg";
  plain?: boolean;
  square?: boolean;
  href: string;
  external?: boolean;
};

/** Round icon-only button (40px). Always pass `label`. */
export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps | IconLinkProps>(
  function IconButton(props, ref) {
    const { icon, label, size = "md", plain, square, className } = props;
    const cls = cx("f-icon-btn", size !== "md" && `f-icon-btn-${size}`, plain && "f-icon-btn-plain", square && "f-icon-btn-square", className);
    const glyph = size === "lg" ? "md" : size === "sm" ? "sm" : "md";
    if (props.href !== undefined) {
      const { icon: _i, label: _l, size: _s, plain: _p, square: _q, external, href, ...rest } = props as IconLinkProps;
      const extra = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
      return (
        <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} aria-label={label} title={rest.title ?? label} {...extra} {...rest} className={cls}>
          <Glyph name={icon} size={glyph} />
        </Link>
      );
    }
    const { icon: _i, label: _l, size: _s, plain: _p, square: _q, type = "button", ...rest } = props as IconButtonProps;
    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} type={type} aria-label={label} title={rest.title ?? label} {...rest} className={cls}>
        <Glyph name={icon} size={glyph} />
      </button>
    );
  },
);
