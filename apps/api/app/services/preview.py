from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.services.filesystem import project_dir

logger = logging.getLogger("preview")

_CORE_DEPS: dict[str, str] = {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0",
}

_IMPORT_RE = re.compile(
    r"""(?:from|import)\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)"""
)
_BUILTIN_OR_REL = re.compile(r"^(?:\.\.?/|/|node:)")
_NODE_BUILTINS = {
    "assert",
    "buffer",
    "child_process",
    "crypto",
    "dns",
    "events",
    "fs",
    "http",
    "https",
    "module",
    "net",
    "os",
    "path",
    "process",
    "querystring",
    "readline",
    "stream",
    "tls",
    "tty",
    "url",
    "util",
    "vm",
    "worker_threads",
    "zlib",
}


@dataclass
class PreviewProcess:
    project_id: str
    port: int
    process: subprocess.Popen


_previews: dict[str, PreviewProcess] = {}


def _npm_executable() -> str:
    candidates = ("npm.cmd", "npm.exe", "npm") if sys.platform == "win32" else ("npm",)
    for name in candidates:
        path = shutil.which(name)
        if path:
            return path
    raise RuntimeError("npm not found in PATH")


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def allocate_port(preferred: int | None = None) -> int:
    settings = get_settings()
    if preferred and _port_free(preferred):
        return preferred
    for port in range(settings.preview_port_start, settings.preview_port_end + 1):
        if _port_free(port):
            return port
    raise RuntimeError("No free preview ports")


async def _run_npm(args: list[str], cwd: str) -> None:
    npm = _npm_executable()
    proc = await asyncio.create_subprocess_exec(
        npm,
        *args,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        tail = stdout.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"npm {' '.join(args)} failed: {tail}")


def _pkg_name(spec: str) -> str | None:
    if not spec or _BUILTIN_OR_REL.match(spec):
        return None
    if spec.startswith("@"):
        parts = spec.split("/")
        if len(parts) < 2:
            return None
        return f"{parts[0]}/{parts[1]}"
    name = spec.split("/")[0]
    if name in _NODE_BUILTINS:
        return None
    return name


def _collect_bare_imports(root: Path) -> set[str]:
    found: set[str] = set()
    skip = {"node_modules", ".git", "dist", ".vite"}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in skip for part in path.parts):
            continue
        if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for match in _IMPORT_RE.finditer(text):
            spec = match.group(1) or match.group(2) or ""
            name = _pkg_name(spec)
            if name:
                found.add(name)
    return found


def _module_installed(root: Path, name: str) -> bool:
    return (root / "node_modules" / name).exists()


def invalidate_deps_stamp(project_id: str) -> None:
    stamp = project_dir(project_id) / "node_modules" / ".forge-deps-stamp"
    if stamp.is_file():
        stamp.unlink(missing_ok=True)


def sync_package_json_deps(project_id: str) -> bool:
    """
    Ensure package.json declares core deps + any bare imports found in source.
    Returns True if package.json was modified.
    """
    root = project_dir(project_id)
    pkg_path = root / "package.json"
    if not pkg_path.is_file():
        return False
    try:
        data = json.loads(pkg_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    if not isinstance(data, dict):
        return False

    deps = data.get("dependencies")
    if not isinstance(deps, dict):
        deps = {}
        data["dependencies"] = deps
    dev = data.get("devDependencies")
    if not isinstance(dev, dict):
        dev = {}

    changed = False
    for name, version in _CORE_DEPS.items():
        if name not in deps and name not in dev:
            deps[name] = version
            changed = True

    for name in _collect_bare_imports(root):
        if name in deps or name in dev:
            continue
        deps[name] = "latest"
        changed = True

    if changed:
        pkg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        invalidate_deps_stamp(project_id)
        logger.info("Synced package.json deps for project=%s", project_id)
    return changed


async def ensure_dependencies(
    project_id: str,
    *,
    force: bool = False,
    sync_imports: bool = True,
) -> bool:
    """
    Install npm deps when missing, package.json changed, or modules absent.
    Returns True if npm install ran.
    """
    root = project_dir(project_id)
    pkg_path = root / "package.json"
    if not pkg_path.is_file():
        return False

    if sync_imports:
        sync_package_json_deps(project_id)
    pkg_text = pkg_path.read_text(encoding="utf-8")
    try:
        data = json.loads(pkg_text)
    except Exception:
        data = {}
    declared: dict[str, str] = {}
    if isinstance(data, dict):
        for key in ("dependencies", "devDependencies"):
            block = data.get(key)
            if isinstance(block, dict):
                declared.update({str(k): str(v) for k, v in block.items()})

    nm = root / "node_modules"
    stamp = nm / ".forge-deps-stamp"
    missing = [name for name in declared if not _module_installed(root, name)]
    stamp_ok = stamp.is_file() and stamp.read_text(encoding="utf-8") == pkg_text

    if not force and nm.is_dir() and stamp_ok and not missing:
        return False

    await _run_npm(["install"], str(root))
    nm.mkdir(parents=True, exist_ok=True)
    stamp.write_text(pkg_text, encoding="utf-8")
    logger.info("npm install completed project=%s missing=%s", project_id, missing[:8])
    return True


def _write_preview_vite_config(project_id: str, port: int) -> None:
    """Vite must use the API path prefix so /@vite/client resolves under /preview/{id}/."""
    settings = get_settings()
    base = f"/preview/{project_id}/"
    origin = settings.api_base_url.rstrip("/")
    root = project_dir(project_id)
    (root / "vite.config.ts").write_text(
        f"""import {{ defineConfig }} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({{
  plugins: [react()],
  base: "{base}",
  server: {{
    host: "127.0.0.1",
    port: {port},
    strictPort: true,
    origin: "{origin}",
    hmr: false,
  }},
}});
""",
        encoding="utf-8",
    )


async def start_preview(project_id: str, preferred_port: int | None = None) -> PreviewProcess:
    existing = _previews.get(project_id)
    if existing and existing.process.poll() is None:
        # Restart so vite.config base/port stay aligned with the proxy prefix.
        stop_preview(project_id)

    await ensure_dependencies(project_id)
    port = allocate_port(preferred_port)
    root = project_dir(project_id)
    _write_preview_vite_config(project_id, port)
    npm = _npm_executable()

    env = os.environ.copy()
    env["BROWSER"] = "none"
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]

    process = subprocess.Popen(
        [npm, "run", "dev", "--", "--port", str(port), "--host", "127.0.0.1", "--strictPort"],
        cwd=str(root),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
    )

    output_chunks: list[str] = []
    for _ in range(60):
        await asyncio.sleep(0.25)
        if process.poll() is not None:
            if process.stdout:
                rest = process.stdout.read().decode("utf-8", errors="replace")
                if rest:
                    output_chunks.append(rest)
            tail = "".join(output_chunks)[-2000:]
            raise RuntimeError(f"Preview process exited early: {tail or 'no output'}")
        if not _port_free(port):
            break
    else:
        process.kill()
        raise RuntimeError("Preview did not become ready in time")

    preview = PreviewProcess(project_id=project_id, port=port, process=process)
    _previews[project_id] = preview
    logger.info("Preview started project=%s port=%s", project_id, port)
    return preview


def stop_preview(project_id: str) -> None:
    preview = _previews.pop(project_id, None)
    if not preview:
        return
    proc = preview.process
    if proc.poll() is None:
        try:
            if sys.platform == "win32":
                proc.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore[attr-defined]
            else:
                proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
    logger.info("Preview stopped project=%s", project_id)


def get_preview(project_id: str) -> PreviewProcess | None:
    preview = _previews.get(project_id)
    if preview and preview.process.poll() is not None:
        _previews.pop(project_id, None)
        return None
    return preview


async def refresh_preview_after_deps(project_id: str) -> bool:
    """Re-install deps if needed and bounce Vite so new modules resolve."""
    installed = await ensure_dependencies(project_id)
    if not installed:
        return False
    existing = get_preview(project_id)
    preferred = existing.port if existing else None
    await start_preview(project_id, preferred_port=preferred)
    return True
