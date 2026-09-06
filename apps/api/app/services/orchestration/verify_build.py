"""Deterministic post-plan checks to catch black-preview failure modes."""

from __future__ import annotations

import logging
import posixpath
import re
import uuid
from dataclasses import asdict, dataclass
from typing import Any, Literal

from app.services.filesystem import list_files, rename_path

Severity = Literal["critical", "warning"]

logger = logging.getLogger(__name__)


@dataclass
class VerifyFinding:
    code: str
    severity: Severity
    path: str
    message: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_USE_HOOK_RE = re.compile(
    r"const\s*\{([^}]+)\}\s*=\s*use([A-Z][A-Za-z0-9_]*)\s*\(",
    re.M,
)
_VALUE_BLOCK_RE = re.compile(
    r"value\s*=\s*\{\s*\{([\s\S]*?)\}\s*\}",
    re.M,
)
_VALUE_OBJ_RE = re.compile(
    r"(?:const|let)\s+value\s*[:=][^=]*=\s*\{([\s\S]*?)\}\s*;",
    re.M,
)
_CLASS_ATTR_RE = re.compile(
    r"""className\s*=\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)""",
    re.M,
)
_CSS_CLASS_RE = re.compile(r"(?:^|[,{\s])\.([A-Za-z_][\w-]*)", re.M)
_DEFAULT_IMPORT_DOM_RE = re.compile(
    r"""import\s+\w+\s+from\s+["']react-dom/client["']""",
)
_NAMED_CREATE_ROOT_RE = re.compile(
    r"""import\s*\{[^}]*\bcreateRoot\b[^}]*\}\s*from\s*["']react-dom/client["']""",
)
_IDENT_FILTER_RE = re.compile(
    r"\b(products|cart|wishlist|favorites|orders|items|filteredProducts)\s*\.\s*(filter|map|find)\s*\(",
)
_OVERFLOW_HIDDEN_RE = re.compile(
    r"(?:^|[,{\s])(html|body)\s*[,{][^}]*overflow\s*:\s*hidden\b",
    re.I | re.M,
)
_OVERFLOW_HIDDEN_SIMPLE_RE = re.compile(
    r"(html|body)\s*\{[^}]*overflow\s*:\s*hidden\b",
    re.I | re.S,
)
_HERO_LAYOUT_CLASS_RE = re.compile(
    r"^(hero|navbar|header|footer|site-|app-|layout-|main-|page-|dh-|home)",
    re.I,
)
_LOCAL_IMPORT_RE = re.compile(
    r"""(?:import|export)\s+[^;]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)""",
)
_IMPORT_SPEC_FROM_MSG_RE = re.compile(
    r"""imports\s+"([^"]+)"|MODULE_NOT_FOUND:\s*([^\s(]+)""",
)
_SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js")
_RESOLVE_EXTS = (".tsx", ".ts", ".jsx", ".js", ".css", ".json")


def _normalize_import_base(spec: str, importer: str) -> str | None:
    """Return the path base the runner would resolve (no extension yet)."""
    if spec.startswith("@/"):
        return "src/" + spec[2:]
    if spec.startswith("."):
        return posixpath.normpath(posixpath.join(posixpath.dirname(importer), spec))
    return None


def _resolved_path_exact(base: str, files: dict[str, str]) -> str | None:
    if base in files:
        return base
    for ext in _RESOLVE_EXTS:
        if base + ext in files:
            return base + ext
    for ext in _SOURCE_EXTS:
        index = f"{base}/index{ext}"
        if index in files:
            return index
    return None


def _local_import_exists(spec: str, importer: str, files: dict[str, str]) -> bool:
    """Mirror the runner's case-sensitive module resolution for local imports."""
    base = _normalize_import_base(spec, importer)
    if base is None:
        return True  # bare specifier — validated by the AST allowlist
    return _resolved_path_exact(base, files) is not None


def expected_module_path(spec: str, importer: str) -> str | None:
    """Canonical path the import should resolve to (prefer .tsx when absent)."""
    base = _normalize_import_base(spec, importer)
    if base is None:
        return None
    if base.endswith(_RESOLVE_EXTS):
        return base
    return base + ".tsx"


def _casefold_file_match(base: str, files: dict[str, str]) -> str | None:
    """Unique existing file that matches base (+ext/index) case-insensitively."""
    if _resolved_path_exact(base, files) is not None:
        return None
    wanted_cf = {base.casefold()}
    for ext in _RESOLVE_EXTS:
        wanted_cf.add((base + ext).casefold())
    for ext in _SOURCE_EXTS:
        wanted_cf.add(f"{base}/index{ext}".casefold())
    matches = [path for path in files if path.casefold() in wanted_cf]
    if len(matches) == 1:
        return matches[0]
    return None


def _canonical_target(base: str, actual: str) -> str:
    """Rewrite `actual` to the casing implied by `base`, keeping the same pattern."""
    actual_cf = actual.casefold()
    if actual_cf == base.casefold():
        return base
    for ext in _RESOLVE_EXTS:
        if actual_cf == (base + ext).casefold():
            return base + ext
    for ext in _SOURCE_EXTS:
        index = f"{base}/index{ext}"
        if actual_cf == index.casefold():
            return index
    return actual


def _rename_case_safe(project_id: str, src: str, dst: str) -> None:
    """Rename including case-only changes (Windows needs a two-step move)."""
    if src == dst:
        return
    if src.casefold() == dst.casefold():
        parent = posixpath.dirname(src)
        suffix = posixpath.splitext(src)[1]
        tmp = f"{parent}/.forge-case-{uuid.uuid4().hex[:8]}{suffix}"
        rename_path(project_id, src, tmp)
        try:
            rename_path(project_id, tmp, dst)
        except Exception:
            # Best effort restore so we do not leave a temp name on disk.
            try:
                rename_path(project_id, tmp, src)
            except Exception:
                logger.exception("failed to restore %s after case rename abort", src)
            raise
        return
    rename_path(project_id, src, dst)


def fix_import_path_casing(project_id: str) -> list[tuple[str, str]]:
    """Deterministically rename files whose casing alone breaks imports.

    Prefer renaming the file to match the import (bindings / JSX stay valid).
    Returns ``(from, to)`` pairs actually applied.
    """
    files = list_files(project_id)
    planned: dict[str, str] = {}
    for path, content in files.items():
        if not path.endswith(_SOURCE_EXTS):
            continue
        for match in _LOCAL_IMPORT_RE.finditer(content):
            spec = match.group(1) or match.group(2) or ""
            if not spec or _local_import_exists(spec, path, files):
                continue
            base = _normalize_import_base(spec, path)
            if not base:
                continue
            near = _casefold_file_match(base, files)
            if not near:
                continue
            target = _canonical_target(base, near)
            if near == target:
                continue
            previous = planned.get(near)
            if previous and previous != target:
                logger.warning(
                    "skipping case rename %s: conflicting targets %s vs %s",
                    near,
                    previous,
                    target,
                )
                continue
            planned[near] = target

    applied: list[tuple[str, str]] = []
    targets = set(planned.values())
    for src, dst in planned.items():
        # Refuse to clobber a distinct existing file (different casefold path).
        if dst in files and src.casefold() != dst.casefold():
            continue
        if dst in targets and sum(1 for t in planned.values() if t == dst) > 1:
            continue
        try:
            _rename_case_safe(project_id, src, dst)
            applied.append((src, dst))
            logger.info("fixed import casing: %s → %s", src, dst)
        except Exception:
            logger.exception("failed case rename %s → %s", src, dst)
    return applied


def _missing_import_findings(files: dict[str, str]) -> list[VerifyFinding]:
    """Imports of files that do not exist mount as MODULE_NOT_FOUND in the
    preview (case-sensitive). The agent sometimes imports a component it never
    wrote, or gets the casing wrong; catching it here routes it into the same
    repair pass as the other criticals instead of a dead preview."""
    findings: list[VerifyFinding] = []
    for path, content in files.items():
        if not path.endswith(_SOURCE_EXTS):
            continue
        for match in _LOCAL_IMPORT_RE.finditer(content):
            spec = match.group(1) or match.group(2) or ""
            if not spec or _local_import_exists(spec, path, files):
                continue
            base = _normalize_import_base(spec, path) or ""
            near = _casefold_file_match(base, files) if base else None
            if near:
                expected = _canonical_target(base, near)
                detail = (
                    f'Did you mean "{near}"? Prefer renaming that file to "{expected}" '
                    "to match the import casing (do not invent a second module)."
                )
            else:
                expected = expected_module_path(spec, path)
                detail = (
                    "Create that module with a matching default/named export, "
                    "or fix the import path/casing."
                    + (f' Expected path: "{expected}".' if expected else "")
                )
            findings.append(
                VerifyFinding(
                    code="import.module_not_found",
                    severity="critical",
                    path=path,
                    message=(
                        f'imports "{spec}" but no matching file exists (resolution is '
                        f"case-sensitive). {detail}"
                    ),
                )
            )
            if len(findings) >= 20:
                return findings
    return findings


def _split_keys(blob: str) -> set[str]:
    keys: set[str] = set()
    for part in blob.split(","):
        token = part.strip()
        if not token or token.startswith("..."):
            continue
        token = token.split("=")[0].strip()
        if ":" in token:
            left, right = token.split(":", 1)
            left, right = left.strip(), right.strip()
            if left:
                keys.add(re.sub(r"[^\w]", "", left))
            right_id = re.sub(r"[^\w]", "", right.split("(")[0].strip())
            if right_id and right_id[0].islower():
                keys.add(right_id)
        else:
            ident = re.sub(r"[^\w]", "", token.split("(")[0].strip())
            if ident:
                keys.add(ident)
    return {k for k in keys if k and k[0].isalpha()}


def _provider_keys(content: str) -> set[str]:
    keys: set[str] = set()
    for match in _VALUE_BLOCK_RE.finditer(content):
        keys |= _split_keys(match.group(1))
    for match in _VALUE_OBJ_RE.finditer(content):
        keys |= _split_keys(match.group(1))
    return keys


def _consumer_keys(files: dict[str, str]) -> dict[str, set[str]]:
    by_hook: dict[str, set[str]] = {}
    for path, content in files.items():
        if not path.endswith((".tsx", ".ts", ".jsx", ".js")):
            continue
        for match in _USE_HOOK_RE.finditer(content):
            hook = "use" + match.group(2)
            if hook in {
                "useState",
                "useEffect",
                "useMemo",
                "useCallback",
                "useRef",
                "useContext",
            }:
                continue
            keys = _split_keys(match.group(1))
            by_hook.setdefault(hook, set()).update(keys)
    return by_hook


def _css_classes(css: str) -> set[str]:
    return set(_CSS_CLASS_RE.findall(css or ""))


def _tsx_class_tokens(content: str) -> set[str]:
    tokens: set[str] = set()
    for match in _CLASS_ATTR_RE.finditer(content):
        raw = match.group(1) or match.group(2) or match.group(3) or ""
        raw = re.sub(r"\$\{[^}]+\}", " ", raw)
        for part in re.split(r"\s+", raw.strip()):
            if not part or part.startswith("${"):
                continue
            part = re.sub(r"[^\w-]", "", part)
            if part and re.match(r"^[A-Za-z_]", part):
                tokens.add(part)
    return tokens


def verify_project_build(project_id: str) -> list[VerifyFinding]:
    files = list_files(project_id)
    findings: list[VerifyFinding] = []

    findings.extend(_missing_import_findings(files))

    main = files.get("src/main.tsx") or files.get("src/main.jsx") or ""
    if main:
        if _DEFAULT_IMPORT_DOM_RE.search(main) and not _NAMED_CREATE_ROOT_RE.search(main):
            findings.append(
                VerifyFinding(
                    code="entry.createRoot",
                    severity="critical",
                    path="src/main.tsx",
                    message=(
                        "Use named import { createRoot } from 'react-dom/client' "
                        "(default import breaks Vite interop → black preview)."
                    ),
                )
            )
        elif "createRoot" not in main:
            findings.append(
                VerifyFinding(
                    code="entry.createRoot",
                    severity="critical",
                    path="src/main.tsx",
                    message="Missing createRoot mount in src/main.tsx.",
                )
            )
    else:
        findings.append(
            VerifyFinding(
                code="entry.missing",
                severity="critical",
                path="src/main.tsx",
                message="src/main.tsx is missing.",
            )
        )

    provider_keys: set[str] = set()
    context_paths: list[str] = []
    for path, content in files.items():
        norm = path.replace("\\", "/")
        if not (norm.startswith("src/context/") and norm.endswith((".tsx", ".ts"))):
            continue
        context_paths.append(path)
        provider_keys |= _provider_keys(content)

    if context_paths and provider_keys:
        consumers = _consumer_keys(files)
        for hook, used in consumers.items():
            missing = sorted(k for k in used if k not in provider_keys and k != "children")
            if missing:
                findings.append(
                    VerifyFinding(
                        code="context.api_mismatch",
                        severity="critical",
                        path=context_paths[0],
                        message=(
                            f"{hook}() consumers need keys missing from Provider value: "
                            + ", ".join(missing[:20])
                            + ". Add aliases on the Provider (do not rename consumers blindly)."
                        ),
                    )
                )

    css = files.get("src/index.css") or ""
    if css and (_OVERFLOW_HIDDEN_SIMPLE_RE.search(css) or _OVERFLOW_HIDDEN_RE.search(css)):
        findings.append(
            VerifyFinding(
                code="css.overflow_hidden_root",
                severity="critical",
                path="src/index.css",
                message=(
                    "html/body uses overflow:hidden — breaks vertical scroll. "
                    "Use overflow:auto/visible (never copy preview.html shells)."
                ),
            )
        )

    # Class lookup must span EVERY stylesheet the project ships, not just
    # index.css: rules written to src/styles/*.css were reported as orphans and
    # the agent was told to duplicate them.
    css_classes: set[str] = set()
    for path, content in files.items():
        if path.endswith((".css", ".scss")):
            css_classes |= _css_classes(content)

    orphan_samples: list[str] = []
    hero_layout_orphans = 0
    all_orphan_count = 0
    for path, content in files.items():
        if not path.endswith((".tsx", ".jsx")):
            continue
        for token in _tsx_class_tokens(content):
            if css_classes and token in css_classes:
                continue
            if not css_classes:
                # No CSS selectors at all while TSX has classes → always critical.
                orphan_samples.append(f"{path}:{token}")
                all_orphan_count += 1
                if _HERO_LAYOUT_CLASS_RE.search(token):
                    hero_layout_orphans += 1
            elif token not in css_classes:
                if len(token) < 2:
                    continue
                orphan_samples.append(f"{path}:{token}")
                all_orphan_count += 1
                if _HERO_LAYOUT_CLASS_RE.search(token):
                    hero_layout_orphans += 1
            if len(orphan_samples) >= 60:
                break
        if len(orphan_samples) >= 60:
            break
    if orphan_samples or (
        not css_classes
        and any(
            path.endswith((".tsx", ".jsx")) and _tsx_class_tokens(content) for path, content in files.items()
        )
    ):
        total_tsx_classes = 0
        for path, content in files.items():
            if path.endswith((".tsx", ".jsx")):
                total_tsx_classes += len(_tsx_class_tokens(content))
        # Count real orphans even beyond the sample cap for ratio.
        if all_orphan_count < len(orphan_samples):
            all_orphan_count = len(orphan_samples)
        ratio = all_orphan_count / max(total_tsx_classes, 1)
        # Stricter: any hero/layout orphan, ≥15% orphans, or ≥5 samples → critical.
        critical = not css_classes or hero_layout_orphans >= 1 or ratio >= 0.15 or len(orphan_samples) >= 5
        findings.append(
            VerifyFinding(
                code="css.orphan_classes",
                severity="critical" if critical else "warning",
                path="src/index.css",
                message=(
                    "TSX classNames not found in src/index.css (sample): "
                    + "; ".join(orphan_samples[:12])
                    + (
                        " — REQUIRED: append matching CSS rules using the SAME class "
                        "names (do not invent a parallel prefix)."
                        if critical
                        else ""
                    )
                ),
            )
        )

    soft = 0
    for path, content in files.items():
        if not path.endswith((".tsx", ".jsx")):
            continue
        if "/context/" in path.replace("\\", "/"):
            continue
        if _IDENT_FILTER_RE.search(content):
            soft += 1
    if soft >= 3 and any(f.code == "context.api_mismatch" for f in findings):
        findings.append(
            VerifyFinding(
                code="runtime.filter_risk",
                severity="warning",
                path="src/",
                message=(
                    "Multiple .filter/.map on shop/cart collections while context API "
                    "mismatches exist — high risk of black preview."
                ),
            )
        )

    findings.extend(responsive_findings(files))

    return findings


# ── Responsive ─────────────────────────────────────────────────────────────
#
# Prototypes get reviewed in the builder's phone frame, so a layout that only
# holds together at 1440px is a defect the user sees immediately. These are
# warnings rather than criticals: a fixed width is ugly, not a black preview,
# and promoting them would spend a repair pass on cosmetics ahead of a crash.

_VIEWPORT_META_RE = re.compile(
    r"""<meta[^>]+name\s*=\s*["']viewport["']""",
    re.I,
)
# `width: 1200px` on a container, but not on things where a pixel width is
# right: borders, icons, and anything already inside a max-width.
_FIXED_WIDTH_RE = re.compile(
    r"(?:^|[;{\s])(?:min-)?width\s*:\s*(\d{3,4})px\s*[;}]",
    re.I | re.M,
)
_FIXED_WIDTH_MIN_PX = 480
_STYLE_FILE_SUFFIXES = (".css",)


def _selector_before(content: str, index: int) -> str:
    """The rule a match sits in, for a message the model can act on."""
    head = content[:index]
    brace = head.rfind("{")
    if brace == -1:
        return ""
    start = max(head.rfind("}", 0, brace), head.rfind("*/", 0, brace))
    return head[start + 1 : brace].strip().splitlines()[-1][:80] if brace > start else ""


def responsive_findings(files: dict[str, str]) -> list[VerifyFinding]:
    findings: list[VerifyFinding] = []

    index_html = files.get("index.html") or ""
    if index_html and not _VIEWPORT_META_RE.search(index_html):
        findings.append(
            VerifyFinding(
                code="responsive.missing_viewport_meta",
                severity="warning",
                path="index.html",
                message=(
                    "index.html has no <meta name=\"viewport\">. Without it a phone "
                    "renders the desktop layout scaled down. Add "
                    '<meta name="viewport" content="width=device-width, initial-scale=1" />.'
                ),
            )
        )

    for path, content in files.items():
        if not path.endswith(_STYLE_FILE_SUFFIXES):
            continue
        offenders: list[str] = []
        for match in _FIXED_WIDTH_RE.finditer(content):
            if int(match.group(1)) < _FIXED_WIDTH_MIN_PX:
                continue
            selector = _selector_before(content, match.start())
            offenders.append(f"{selector or '?'} → {match.group(0).strip().rstrip(';{}')}")
        if offenders:
            findings.append(
                VerifyFinding(
                    code="responsive.fixed_width_container",
                    severity="warning",
                    path=path,
                    message=(
                        "Fixed pixel widths overflow a phone viewport. Replace with "
                        "max-width + width:100% (or min()/clamp()): "
                        + "; ".join(offenders[:6])
                    ),
                )
            )

    return findings


def findings_have_critical(findings: list[VerifyFinding]) -> bool:
    return any(f.severity == "critical" for f in findings)


def css_critical_findings(findings: list[VerifyFinding]) -> list[VerifyFinding]:
    return [f for f in findings if f.severity == "critical" and f.code.startswith("css.")]


def repair_focus_paths(findings: list[VerifyFinding]) -> list[str] | None:
    """Paths to inject into LLM context for a focused verify repair pass."""
    focus: list[str] = []
    if any(f.code.startswith("css.") for f in findings):
        focus.extend(["src/index.css", "src/App.tsx"])
    if any(f.code == "entry.createRoot" for f in findings):
        focus.append("src/main.tsx")
    if any(f.code == "context.api_mismatch" for f in findings):
        focus.extend(["src/App.tsx", "src/context"])
    for finding in findings:
        # Responsive findings name the exact file that holds the offending rule.
        if finding.code.startswith("responsive.") and finding.path:
            focus.append(finding.path)
        if finding.code in ("import.module_not_found", "transform.error") and finding.path:
            focus.append(finding.path)
            if finding.code == "transform.error" and "MODULE_NOT_FOUND" not in finding.message:
                continue
            match = _IMPORT_SPEC_FROM_MSG_RE.search(finding.message)
            if not match:
                continue
            spec = match.group(1) or match.group(2) or ""
            expected = expected_module_path(spec, finding.path)
            if expected:
                focus.append(expected)
    seen: set[str] = set()
    out: list[str] = []
    for path in focus:
        if path not in seen:
            seen.add(path)
            out.append(path)
    return out or None


def format_findings_for_prompt(findings: list[VerifyFinding]) -> str:
    if not findings:
        return "No findings."
    lines = ["Deterministic verify findings (fix these with forge-write):"]
    for f in findings:
        lines.append(f"- [{f.severity}] {f.code} @ {f.path}: {f.message}")
    lines.append(
        "Rules: keep Provider key names stable; add aliases for consumers; "
        "sync orphan classNames with src/index.css using the EXACT same tokens "
        "(never rename to a parallel prefix mid-plan); fix createRoot named import; "
        "remove overflow:hidden from html/body so the page can scroll; "
        "replace fixed pixel widths with max-width + width:100% so nothing "
        "overflows a phone viewport; "
        "APPEND CSS only — do not drop existing navbar/hero rules."
    )
    if any(f.code == "export.named_missing" for f in findings):
        lines.append(
            "For export.named_missing on lucide-react: replace invented icon names with "
            "icons that exist in lucide-react@0.468.0 (e.g. MessageSquare instead of "
            "MessageSquareCheck). Never guess icon names."
        )
    if any(f.code.startswith("route.") for f in findings):
        lines.append(
            "For route findings: ensure every <Route path=... element={<Page />} /> points "
            "to an existing src/pages/Page.tsx (or equivalent) module."
        )
    if any(
        f.code == "import.module_not_found"
        or (f.code == "transform.error" and "MODULE_NOT_FOUND" in f.message)
        for f in findings
    ):
        lines.append(
            "For MODULE_NOT_FOUND / import.module_not_found: prefer renaming the existing "
            "file so its path casing matches the import exactly (case-sensitive). Do not "
            "invent a second module with a parallel name. If the module is truly missing, "
            "create it at the expected path with a matching default export."
        )
    return "\n".join(lines)


def format_css_second_pass_prompt(findings: list[VerifyFinding]) -> str:
    css = css_critical_findings(findings)
    if not css:
        return ""
    return (
        "SECOND CSS REPAIR PASS (mandatory):\n"
        "The first repair did not fix all CSS issues. Read src/index.css from disk "
        "in full. APPEND missing rules for EVERY orphan className below — use the "
        "EXACT same spelling as in TSX. Never replace index.css with a shorter file. "
        "Never drop navbar/hero/layout selectors.\n\n" + format_findings_for_prompt(css)
    )
