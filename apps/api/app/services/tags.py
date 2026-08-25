from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class WriteOp:
    path: str
    content: str


@dataclass
class DeleteOp:
    path: str


TAG_WRITE = re.compile(
    r"<forge-write\s+path=[\"']([^\"']+)[\"']\s*>(.*?)</forge-write>",
    re.DOTALL | re.IGNORECASE,
)
TAG_DELETE = re.compile(
    r"<forge-delete\s+path=[\"']([^\"']+)[\"']\s*/?>",
    re.DOTALL | re.IGNORECASE,
)


def parse_forge_tags(text: str) -> tuple[list[WriteOp], list[DeleteOp]]:
    writes: list[WriteOp] = []
    deletes: list[DeleteOp] = []

    for match in TAG_WRITE.finditer(text):
        path = match.group(1).strip().lstrip("./")
        content = match.group(2)
        # Strip accidental markdown fences
        content = re.sub(r"^```[a-zA-Z0-9]*\n?", "", content.strip())
        content = re.sub(r"\n?```$", "", content)
        if path and ".." not in path.split("/"):
            writes.append(WriteOp(path=path, content=content))

    for match in TAG_DELETE.finditer(text):
        path = match.group(1).strip().lstrip("./")
        if path and ".." not in path.split("/"):
            deletes.append(DeleteOp(path=path))

    return writes, deletes
