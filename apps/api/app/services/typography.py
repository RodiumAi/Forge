"""House typography: no long dashes (em dash — and en dash –) in anything Forge
writes, whether plans, questions, briefs, SEO copy or the generated site itself.

The prompts ask the models not to use them; this is the deterministic safety net
applied where the text is stored, because a model instruction is never a
guarantee. Replacements are chosen to read naturally:

* between two numbers (``10–20``)          → a hyphen (``10-20``)
* an en dash glued between words (a range) → a hyphen (``lundi-vendredi``)
* opening or closing a text (``— Marie``)  → dropped
* the first dash of a short label          → a colon (``Home page: hero``)
* anywhere else (``a — b``)                → a comma (``a, b``)

In source files a long dash can only live inside a string, JSX text or a comment,
never in syntax, so rewriting it is always safe for the code.
"""

from __future__ import annotations

import re

_DASHES = "—–"  # em dash, en dash
_HAS_DASH_RE = re.compile(f"[{_DASHES}]")
_RANGE_RE = re.compile(rf"(\d)\s*[{_DASHES}]\s*(\d)")
# An en dash glued between two words is a range too ("lundi–vendredi", "Paris–Lomé").
_WORD_RANGE_RE = re.compile(r"(?<=\w)–(?=\w)")
# Dash that opens a text: start of string/line or right after an opening
# delimiter (tag end, quote, bracket), e.g. `<p>— Marie</p>`, `"— Marie"`.
_LEADING_RE = re.compile(rf"(^|[\n>\"'`(\[{{])([ \t]*)[{_DASHES}][ \t]*", re.M)
# Dash that closes a text: before end of string/line or a closing delimiter.
_TRAILING_RE = re.compile(rf"[ \t]*[{_DASHES}][ \t]*(?=$|[\n<\"'`)\]}}])", re.M)
_INNER_RE = re.compile(rf"[ \t]*[{_DASHES}][ \t]*")
_COMMA_BEFORE_PUNCT_RE = re.compile(r",\s*([.,;:!?])")

#: Extensions of files whose long dashes are rewritten on write.
TEXT_EXTS = (
    ".tsx",
    ".ts",
    ".jsx",
    ".js",
    ".mjs",
    ".cjs",
    ".html",
    ".htm",
    ".md",
    ".mdx",
    ".txt",
    ".json",
    ".webmanifest",
    ".xml",
    ".css",
    ".yml",
    ".yaml",
)

_LABEL_MAX = 90


def strip_long_dashes(text: str, *, label: bool = False) -> str:
    """Rewrite em/en dashes in human text.

    ``label=True`` is for short titles ("Home page — hero, CTA"): the first
    dash becomes a colon, which keeps the "topic: details" reading.
    """
    if not text or not _HAS_DASH_RE.search(text):
        return text
    out = _RANGE_RE.sub(r"\1-\2", text)
    out = _WORD_RANGE_RE.sub("-", out)
    out = _LEADING_RE.sub(r"\1\2", out)
    out = _TRAILING_RE.sub("", out)
    if label and len(out) <= _LABEL_MAX and _HAS_DASH_RE.search(out):
        out = _INNER_RE.sub(": ", out, count=1)
    out = _INNER_RE.sub(", ", out)
    return _COMMA_BEFORE_PUNCT_RE.sub(r"\1", out)


def strip_long_dashes_in_file(path: str, content: str) -> str:
    """Apply :func:`strip_long_dashes` to a generated text file."""
    if not content or not str(path or "").lower().endswith(TEXT_EXTS):
        return content
    return strip_long_dashes(content)


#: Line to drop into model instructions (the filter is the backstop).
NO_LONG_DASH_RULE = (
    "Typography: NEVER use long dashes (the em dash — or the en dash –) anywhere, "
    "not in titles, text, SEO, alt text, labels or comments. Use a comma, a colon, a period "
    "or parentheses instead, and a plain hyphen for ranges (10-20)."
)
