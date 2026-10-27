"""Read the one JSON object a model answer is supposed to be."""

from __future__ import annotations

import json
import re
from typing import Any

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.I)


class ModelJsonError(ValueError):
    """The answer holds no usable JSON object."""


def parse_json_object(text: str) -> dict[str, Any]:
    """The JSON object in ``text``: bare, fenced, or wrapped in a sentence."""
    raw = (text or "").strip()
    candidates = [raw]
    candidates += [m.group(1).strip() for m in _FENCE_RE.finditer(raw)]
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        candidates.append(raw[start : end + 1])
    for candidate in candidates:
        if not candidate:
            continue
        try:
            value = json.loads(candidate)
        except ValueError:
            continue
        if isinstance(value, dict):
            return value
    raise ModelJsonError("the answer is not a JSON object")
