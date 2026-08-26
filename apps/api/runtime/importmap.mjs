/**
 * Build import map from the closed package manifest (local CDN via esm.sh).
 */

/** @type {Record<string, string>} */
export const DEFAULT_CDN_IMPORTS = {
  react: "https://esm.sh/react@18.3.1",
  "react-dom": "https://esm.sh/react-dom@18.3.1",
  "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
  "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
  "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
  "lucide-react": "https://esm.sh/lucide-react@0.468.0",
  "react-router-dom": "https://esm.sh/react-router-dom@7.1.1?deps=react@18.3.1,react-dom@18.3.1",
  "@tanstack/react-query":
    "https://esm.sh/@tanstack/react-query@5.62.0?deps=react@18.3.1,react-dom@18.3.1",
  zod: "https://esm.sh/zod@3.24.1",
  clsx: "https://esm.sh/clsx@2.1.1",
  "date-fns": "https://esm.sh/date-fns@4.1.0",
};

/**
 * @param {Record<string, string>} [extra]
 */
export function buildImportMap(extra = {}) {
  return {
    imports: {
      ...DEFAULT_CDN_IMPORTS,
      ...extra,
    },
  };
}

export function importMapScriptTag(extra = {}) {
  const map = buildImportMap(extra);
  return `<script type="importmap">${JSON.stringify(map)}</script>`;
}
