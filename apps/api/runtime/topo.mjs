/**
 * Topological sort of the import graph. Throws CIRCULAR_DEPENDENCY with cycle path.
 */

import { resolveSpecifier } from "./resolve.mjs";

/**
 * @param {Map<string, { imports: { specifier: string, kind: string }[] }>} transformed
 * @param {Set<string>|Map<string, string>|Record<string, string>} files
 * @returns {string[]}
 */
export function topoSort(transformed, files) {
  /** @type {Map<string, string[]>} */
  const graph = new Map();
  for (const [path, info] of transformed) {
    /** @type {string[]} */
    const deps = [];
    for (const imp of info.imports || []) {
      if (imp.kind === "bare") continue;
      const resolved = resolveSpecifier(path, imp.specifier, files);
      if (resolved && transformed.has(resolved)) deps.push(resolved);
    }
    graph.set(path, deps);
  }

  /** @type {string[]} */
  const order = [];
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {Set<string>} */
  const stack = new Set();
  /** @type {string[]} */
  const trail = [];

  /**
   * @param {string} node
   */
  function visit(node) {
    if (visited.has(node)) return;
    if (stack.has(node)) {
      const idx = trail.indexOf(node);
      const cycle = [...trail.slice(idx), node].join(" -> ");
      const err = new Error(`CIRCULAR_DEPENDENCY: ${cycle}`);
      err.name = "CIRCULAR_DEPENDENCY";
      throw err;
    }
    stack.add(node);
    trail.push(node);
    for (const dep of graph.get(node) || []) visit(dep);
    trail.pop();
    stack.delete(node);
    visited.add(node);
    order.push(node);
  }

  for (const node of graph.keys()) visit(node);
  return order;
}
