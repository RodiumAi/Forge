#!/usr/bin/env python3
"""Fail if the AST allowlist and the browser import map disagree.

Both derive from `apps/api/runtime/packages.json`, but they are consumed by two
different runtimes (Python validator, JS import map builder). This check runs
both sides for real and compares the results, so a regression cannot silently
reintroduce the drift where a package passed write-time validation and then
failed at runtime with IMPORT_NOT_IN_MANIFEST.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "apps" / "api"
RUNTIME = API / "runtime"


def python_side() -> tuple[set[str], set[str], dict[str, str]]:
    sys.path.insert(0, str(API))
    from app.runtime_manifest import allowed_packages, browser_import_map, browser_packages

    return set(allowed_packages()), set(browser_packages()), browser_import_map()


def package_of(specifier: str) -> str:
    """`react-dom/client` -> `react-dom`, `@hookform/resolvers/zod` -> `@hookform/resolvers`."""
    parts = specifier.split("/")
    if specifier.startswith("@"):
        return "/".join(parts[:2])
    return parts[0]


def js_map() -> dict[str, str]:
    script = (
        "import('./importmap.mjs')"
        ".then(m => console.log(JSON.stringify(m.DEFAULT_CDN_IMPORTS)))"
    )
    out = subprocess.run(
        ["node", "-e", script],
        cwd=RUNTIME,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout.strip())


def main() -> int:
    allowed, browser, py_map = python_side()
    js = js_map()
    js_keys = {package_of(k) for k in js}

    errors: list[str] = []

    missing_in_map = browser - js_keys
    if missing_in_map:
        errors.append(
            "Declared browser:true but absent from the import map: "
            + ", ".join(sorted(missing_in_map))
        )

    unknown_in_map = {k for k in js_keys if k not in allowed}
    if unknown_in_map:
        errors.append(
            "In the import map but not in the AST allowlist: " + ", ".join(sorted(unknown_in_map))
        )

    # The Python shell (served to the browser) and the JS builder (used by the
    # publish CLI) must emit byte-identical maps, or preview and published site
    # resolve packages differently.
    if py_map != js:
        only_py = sorted(set(py_map) - set(js))
        only_js = sorted(set(js) - set(py_map))
        differing = sorted(k for k in set(py_map) & set(js) if py_map[k] != js[k])
        detail = []
        if only_py:
            detail.append(f"only in Python: {', '.join(only_py)}")
        if only_js:
            detail.append(f"only in JS: {', '.join(only_js)}")
        if differing:
            detail.append(f"different URL: {', '.join(differing)}")
        errors.append("Python and JS import maps diverge — " + "; ".join(detail))

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1

    print(
        f"OK: {len(allowed)} packages allowed, {len(browser)} resolvable in the browser, "
        f"{len(js)} identical import-map entries on both sides."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
