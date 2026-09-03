#!/usr/bin/env python3
"""Delete a Forge project via the internal admin API.

Usage (prod):
  set ADMIN_SECRET=...
  set FORGE_API_BASE=https://api-forge.rodiumai.io
  python scripts/admin_delete_project.py <project-uuid>
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from uuid import UUID


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: admin_delete_project.py <project-uuid>", file=sys.stderr)
        return 2

    try:
        project_id = str(UUID(sys.argv[1]))
    except ValueError:
        print("Invalid project UUID.", file=sys.stderr)
        return 2

    secret = (os.environ.get("ADMIN_SECRET") or "").strip()
    if not secret:
        print("ADMIN_SECRET is required.", file=sys.stderr)
        return 2

    base = (os.environ.get("FORGE_API_BASE") or "http://127.0.0.1:8100").rstrip("/")
    url = f"{base}/internal/admin/projects/{project_id}"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={"X-Forge-Admin-Secret": secret},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Deleted project {project_id} (HTTP {resp.status}).")
            return 0
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        print(f"HTTP {err.code}: {body}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
