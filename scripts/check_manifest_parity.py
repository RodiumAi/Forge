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


def python_side() -> tuple[set[str], set[str]]:
    sys.path.insert(0, str(API))
    from app.runtime_manifest import allowed_packages, browser_packages

    return set(allowed_packages()), set(browser_packages())


def package_of(specifier: str) -> str:
    """`react-dom/client` -> `react-dom`, `@hookform/resolvers/zod` -> `@hookform/resolvers`."""
    parts = specifier.split("/")
    if specifier.startswith("@"):
        return "/".join(parts[:2])
    return parts[0]


def js_side() -> set[str]:
    script = (
        "import('./importmap.mjs')"
        ".then(m => console.log(JSON.stringify(Object.keys(m.DEFAULT_CDN_IMPORTS))))"
    )
    out = subprocess.run(
        ["node", "-e", script],
        cwd=RUNTIME,
        capture_output=True,
        text=True,
        check=True,
    )
    keys = json.loads(out.stdout.strip())
    return {package_of(k) for k in keys}


def main() -> int:
    allowed, browser = python_side()
    js_keys = js_side()

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
            "In the import map but not in the AST allowlist: "
            + ", ".join(sorted(unknown_in_map))
        )

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1

    print(f"OK: {len(allowed)} packages allowed, {len(browser)} resolvable in the browser.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
