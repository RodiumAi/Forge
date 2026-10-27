import { FLAG_PATHS } from "./flag-paths";

/**
 * Inline SVG flag (30 x 20 drawing, rounded plate) for the payment countries.
 * No network request, so the picker paints at once and works offline.
 */
export function Flag({ iso2, width = 22, className }: { iso2: string; width?: number; className?: string }) {
  const code = iso2.toUpperCase();
  const clip = `f-flag-${code}`;
  const art = FLAG_PATHS[code] ?? '<rect width="30" height="20" fill="#9AA0AD"/>';
  return (
    <svg
      className={className ? `f-flag ${className}` : "f-flag"}
      width={width}
      height={(width * 2) / 3}
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      // Static flag markup from flag-paths.ts, never user input.
      // nosemgrep: rodiumai-dangerous-innerhtml-without-sanitize-import, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      dangerouslySetInnerHTML={{
        __html: `<clipPath id="${clip}"><rect width="30" height="20" rx="3"/></clipPath><g clip-path="url(#${clip})">${art}</g><rect width="30" height="20" rx="3" fill="none" stroke="rgba(0,0,0,.18)"/>`,
      }}
    />
  );
}
