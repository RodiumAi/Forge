/**
 * Blocking snippet for <head>, injected before anything paints so the correct
 * theme is rendered once instead of flashing.
 *
 * Only an explicit "light"/"dark" choice is stored; any other value — including
 * no value at all — means "follow the OS", which is the default.
 *
 * On failure it deliberately does NOTHING: leaving `data-theme` unset lets the
 * `@media (prefers-color-scheme: dark)` block in globals.css decide, which is
 * already the right answer. The previous version forced "dark" here, which is
 * what pinned light-mode users to a dark shell.
 *
 * Kept in one place because two documents need it: the root layout and
 * app/global-error.tsx, which renders its own <html> when the layout itself
 * fails. lib/theme/ThemeProvider.tsx re-reads the same key on hydration.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("forge_theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;
