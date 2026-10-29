"""Reading an untrusted .pptx: zip limits, part paths, relationships, XML.

A .pptx is a zip of XML parts. Everything here assumes the file is hostile:
the declared sizes in the zip directory are not trusted (each entry is read
with a byte budget), the whole archive has an uncompressed budget, encrypted
entries and password-protected files are refused, and the XML parser never
sees a DTD, so no entity can expand or reach outside the archive.
"""

from __future__ import annotations

import io
import posixpath
import re
import zipfile
from xml.etree import ElementTree as ET

#: Largest upload accepted (the API body limit is 16 MB, multipart included).
MAX_PPTX_BYTES = 15 * 1024 * 1024
#: Entries in the zip directory.
MAX_ENTRIES = 4000
#: Bytes inflated over the whole import, all parts together.
MAX_TOTAL_UNCOMPRESSED = 300 * 1024 * 1024
#: One XML part.
MAX_XML_BYTES = 25 * 1024 * 1024
#: One media part (picture).
MAX_MEDIA_BYTES = 40 * 1024 * 1024
#: Inflation ratio refused for an entry, past the first megabyte.
MAX_RATIO = 250

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "dgm": "http://schemas.openxmlformats.org/drawingml/2006/diagram",
    "dsp": "http://schemas.microsoft.com/office/drawing/2008/diagram",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
R_ID = f"{{{NS['r']}}}id"
R_EMBED = f"{{{NS['r']}}}embed"
R_LINK = f"{{{NS['r']}}}link"

_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_XML_DECL = re.compile(r"^\s*<\?xml[^>]*\?>", re.S)


class PptxError(Exception):
    """A file the import refuses, with an error code for the client."""

    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def local(tag: str) -> str:
    """Tag without its namespace: ``{ns}sp`` -> ``sp``."""
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def kid(el: ET.Element | None, name: str) -> ET.Element | None:
    """First child with this local name (any namespace)."""
    if el is None:
        return None
    for child in el:
        if local(child.tag) == name:
            return child
    return None


def kids(el: ET.Element | None, name: str) -> list[ET.Element]:
    if el is None:
        return []
    return [child for child in el if local(child.tag) == name]


def path(el: ET.Element | None, *names: str) -> ET.Element | None:
    for name in names:
        el = kid(el, name)
        if el is None:
            return None
    return el


def descendants(el: ET.Element | None, name: str) -> list[ET.Element]:
    if el is None:
        return []
    return [node for node in el.iter() if local(node.tag) == name]


def parse_xml(data: bytes) -> ET.Element:
    """Parse one part with no DTD allowed (no entity, internal or external)."""
    if data.startswith(b"\xef\xbb\xbf"):
        data = data[3:]
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = data.decode("utf-16")
    else:
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise PptxError("PPTX_INVALID", "A part of the file is not valid XML.") from exc
    # Checked on the decoded text, so another encoding cannot hide it.
    upper = text.upper()
    if "<!DOCTYPE" in upper or "<!ENTITY" in upper:
        raise PptxError("PPTX_INVALID", "The file declares a DTD, which is not allowed.")
    text = _XML_DECL.sub("", text, count=1)
    try:
        return ET.fromstring(text)
    except ET.ParseError as exc:
        raise PptxError("PPTX_INVALID", "A part of the file is not valid XML.") from exc


class Package:
    """The zip of one presentation, read with byte budgets."""

    def __init__(self, raw: bytes):
        if len(raw) > MAX_PPTX_BYTES:
            raise PptxError("PPTX_TOO_LARGE", "The file is too large.", 413)
        if raw.startswith(_OLE_MAGIC):
            # Password-protected Office files are an encrypted OLE container, not a zip.
            raise PptxError("PPTX_ENCRYPTED", "The presentation is protected by a password.")
        try:
            self.zip = zipfile.ZipFile(io.BytesIO(raw))
        except (zipfile.BadZipFile, ValueError, OSError) as exc:
            raise PptxError("PPTX_INVALID", "This file is not a PowerPoint presentation (.pptx).") from exc
        infos = self.zip.infolist()
        if len(infos) > MAX_ENTRIES:
            raise PptxError("PPTX_TOO_COMPLEX", "The file holds too many parts.")
        self.infos: dict[str, zipfile.ZipInfo] = {}
        declared = 0
        for info in infos:
            if info.flag_bits & 0x1:
                raise PptxError("PPTX_ENCRYPTED", "The presentation is protected by a password.")
            name = info.filename.replace("\\", "/").lstrip("/")
            declared += info.file_size
            self.infos[name] = info
        if declared > MAX_TOTAL_UNCOMPRESSED:
            raise PptxError("PPTX_TOO_COMPLEX", "The file is too large once uncompressed.")
        if "[Content_Types].xml" not in self.infos or "ppt/presentation.xml" not in self.infos:
            raise PptxError("PPTX_INVALID", "This file is not a PowerPoint presentation (.pptx).")
        self.inflated = 0
        self._xml: dict[str, ET.Element | None] = {}
        self._rels: dict[str, dict[str, tuple[str, str, bool]]] = {}

    def has(self, name: str) -> bool:
        return name in self.infos

    def read(self, name: str, limit: int) -> bytes:
        """Bytes of one part; the real inflated size is checked, not the declared one."""
        info = self.infos.get(name)
        if info is None:
            raise KeyError(name)
        if info.file_size > limit:
            raise PptxError("PPTX_TOO_COMPLEX", "A part of the file is too large.")
        if (
            info.file_size > 1024 * 1024
            and info.compress_size
            and info.file_size / info.compress_size > MAX_RATIO
        ):
            raise PptxError("PPTX_TOO_COMPLEX", "A part of the file is compressed suspiciously.")
        try:
            with self.zip.open(info) as handle:
                data = handle.read(limit + 1)
        except (zipfile.BadZipFile, RuntimeError, NotImplementedError, OSError, EOFError) as exc:
            raise PptxError("PPTX_INVALID", "A part of the file cannot be read.") from exc
        if len(data) > limit:
            raise PptxError("PPTX_TOO_COMPLEX", "A part of the file is too large.")
        self.inflated += len(data)
        if self.inflated > MAX_TOTAL_UNCOMPRESSED:
            raise PptxError("PPTX_TOO_COMPLEX", "The file is too large once uncompressed.")
        return data

    def xml(self, name: str | None) -> ET.Element | None:
        """Parsed part, cached; None when the part does not exist."""
        if not name or name not in self.infos:
            return None
        if name not in self._xml:
            self._xml[name] = parse_xml(self.read(name, MAX_XML_BYTES))
        return self._xml[name]

    def rels(self, part: str | None) -> dict[str, tuple[str, str, bool]]:
        """``rId -> (type suffix, target, external)`` of one part; targets resolved."""
        if not part:
            return {}
        if part in self._rels:
            return self._rels[part]
        folder, base = posixpath.split(part)
        root = self.xml(posixpath.join(folder, "_rels", base + ".rels"))
        out: dict[str, tuple[str, str, bool]] = {}
        for rel in kids(root, "Relationship"):
            rid, target = rel.get("Id") or "", rel.get("Target") or ""
            kind = (rel.get("Type") or "").rsplit("/", 1)[-1]
            external = (rel.get("TargetMode") or "") == "External"
            if not external:
                target = resolve(folder, target)
            out[rid] = (kind, target, external)
        self._rels[part] = out
        return out

    def related(self, part: str | None, kind: str) -> str | None:
        """Target of the first relationship of this type."""
        for rel_kind, target, external in self.rels(part).values():
            if rel_kind == kind and not external:
                return target
        return None


def resolve(folder: str, target: str) -> str:
    """Part name of a relative target; never above the package root."""
    joined = target.lstrip("/") if target.startswith("/") else posixpath.join(folder, target)
    normal = posixpath.normpath(joined)
    return "" if normal.startswith("..") else normal
