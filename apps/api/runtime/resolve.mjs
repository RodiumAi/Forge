/**
 * Case-sensitive module resolution (preview Blob URLs + publish .js paths).
 */

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/**
 * @param {string} fromPath e.g. src/pages/Shop.tsx
 * @param {string} specifier e.g. ../components/Hero or @/components/Hero
 * @param {Record<string, string>|Map<string, string>|Set<string>} files
 * @returns {string|null} normalized project-relative path
 */
export function resolveSpecifier(fromPath, specifier, files) {
  const has = (p) => {
    if (files instanceof Map || files instanceof Set) return files.has(p);
    return Object.prototype.hasOwnProperty.call(files, p);
  };

  let base;
  if (specifier.startsWith("@/")) {
    base = "src/" + specifier.slice(2);
  } else if (specifier.startsWith("/")) {
    base = specifier.replace(/^\//, "");
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const fromDir = fromPath.includes("/")
      ? fromPath.slice(0, fromPath.lastIndexOf("/"))
      : "";
    base = normalizeJoin(fromDir, specifier);
  } else {
    return null; // bare — import map
  }

  // Exact path first (already has extension)
  if (has(base)) return base;

  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (has(candidate)) return candidate;
  }
  for (const ext of EXTENSIONS) {
    const candidate = base.replace(/\/$/, "") + "/index" + ext;
    if (has(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {string} dir
 * @param {string} rel
 */
function normalizeJoin(dir, rel) {
  const parts = (dir ? dir.split("/") : []).concat(rel.split("/"));
  /** @type {string[]} */
  const stack = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

/**
 * @param {string} path
 * @returns {string} path with .js extension for publish
 */
export function toPublishJsPath(path) {
  return path.replace(/\.(tsx|ts|jsx)$/i, ".js");
}
