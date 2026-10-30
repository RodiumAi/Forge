"""PowerPoint slides to Forge slides (``contracts/forge-design/slide.schema.json``).

Positions and sizes are scaled from EMU to the deck canvas (fitted and
centred when the ratios differ). Text keeps its runs (bold, italic, underline,
colour, links), alignment, bullets and size; shapes keep their fill and
outline; pictures are stored as project images; tables, groups, charts with
readable data, backgrounds and speaker notes come along. Placeholders inherit
their position and text style from the layout and the master, colours are
resolved through the theme. What a Forge slide cannot express is approximated
and reported as a warning code (see ``WARNING_CODES``).
"""

from __future__ import annotations

import io
import math
import posixpath
import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from xml.etree import ElementTree as ET

from pydantic import ValidationError

from app.contracts.forge_design import MAX_GROUP_DEPTH, dump_document, validate_slide

from .archive import (
    MAX_MEDIA_BYTES,
    R_EMBED,
    R_ID,
    R_LINK,
    Package,
    PptxError,
    descendants,
    kid,
    kids,
    local,
    path,
)
from .colors import Palette, color_of, raw_hex, read_map, read_theme

#: Codes the web client translates. Each slide reports ``{code: count}``.
WARNING_CODES = (
    "shape_approximated",
    "gradient_simplified",
    "connector_straightened",
    "picture_unsupported",
    "picture_linked",
    "picture_too_large",
    "chart_placeholder",
    "smartart_placeholder",
    "object_skipped",
    "media_poster",
    "table_merged_cells",
    "table_truncated",
    "text_truncated",
    "text_split",
    "group_flattened",
    "too_many_elements",
    "element_invalid",
    "too_many_slides",
)

EMU_PER_PT = 12700
MAX_SLIDES = 300
MAX_IMAGES = 300
MAX_PIXELS = 50_000_000
MAX_ELEMENTS = 200
MAX_CHILDREN = 100
MAX_NOTES = 20_000

_MONO = re.compile(r"mono|courier|consolas|menlo|monaco|code|inconsolata", re.I)
_RECT_LIKE = {
    "rect",
    "flowChartProcess",
    "snip1Rect",
    "snip2SameRect",
    "snip2DiagRect",
    "snipRoundRect",
    "frame",
    "plaque",
}
_ROUND_LIKE = {"roundRect", "flowChartAlternateProcess", "round1Rect", "round2SameRect", "round2DiagRect"}
_ELLIPSE_LIKE = {"ellipse", "flowChartConnector", "donut", "pie", "chord", "blockArc", "arc"}
_LINES = {"line", "straightConnector1"}
_BENT_LINES = {f"{kind}Connector{n}" for kind in ("bent", "curved") for n in range(2, 6)}
_TITLES = {"title", "ctrTitle"}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp"}
_CHART_KINDS = {
    "barChart": "bar",
    "bar3DChart": "bar",
    "lineChart": "line",
    "line3DChart": "line",
    "areaChart": "line",
    "area3DChart": "line",
    "scatterChart": "line",
    "radarChart": "line",
    "stockChart": "line",
    "pieChart": "pie",
    "pie3DChart": "pie",
    "doughnutChart": "pie",
    "ofPieChart": "pie",
}

#: ``save_image(bytes, stem) -> {"path", "width", "height"}`` or None.
ImageSaver = Callable[[bytes, str], dict[str, Any] | None]


# ── geometry ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Xform:
    """EMU of one coordinate space to canvas pixels."""

    sx: float
    sy: float
    ox: float
    oy: float

    def point(self, x: float, y: float) -> tuple[float, float]:
        return self.ox + x * self.sx, self.oy + y * self.sy

    def child(
        self, off: tuple[int, int], ext: tuple[int, int], ch_off: tuple[int, int], ch_ext: tuple[int, int]
    ) -> Xform:
        kx = ext[0] / ch_ext[0] if ch_ext[0] else 1.0
        ky = ext[1] / ch_ext[1] if ch_ext[1] else 1.0
        return Xform(
            sx=self.sx * kx,
            sy=self.sy * ky,
            ox=self.ox + self.sx * (off[0] - ch_off[0] * kx),
            oy=self.oy + self.sy * (off[1] - ch_off[1] * ky),
        )


def _int(value: str | None, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except ValueError:
        try:
            return int(float(value))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return default


def _pair(el: ET.Element | None, a: str, b: str) -> tuple[int, int] | None:
    if el is None:
        return None
    return _int(el.get(a)), _int(el.get(b))


def _num(value: float, digits: int = 1) -> float:
    return round(value, digits)


@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float
    rotation: float = 0.0
    flip_h: bool = False
    flip_v: bool = False


def _box(xfrm: ET.Element | None, xf: Xform) -> Box | None:
    off = _pair(kid(xfrm, "off"), "x", "y")
    ext = _pair(kid(xfrm, "ext"), "cx", "cy")
    if off is None or ext is None:
        return None
    x, y = xf.point(*off)
    return Box(
        x=x,
        y=y,
        w=ext[0] * xf.sx,
        h=ext[1] * xf.sy,
        rotation=_int(xfrm.get("rot")) / 60000 if xfrm is not None else 0.0,
        flip_h=xfrm is not None and xfrm.get("flipH") in ("1", "true"),
        flip_v=xfrm is not None and xfrm.get("flipV") in ("1", "true"),
    )


def _rotation(deg: float) -> float | None:
    deg = deg % 360
    if deg > 180:
        deg -= 360
    return _num(deg, 2) if abs(deg) >= 0.01 else None


def _place(element: dict[str, Any], box: Box, origin: tuple[float, float]) -> dict[str, Any]:
    element["x"] = _num(max(-10000.0, min(10000.0, box.x - origin[0])))
    element["y"] = _num(max(-10000.0, min(10000.0, box.y - origin[1])))
    element["w"] = _num(max(1.0, min(10000.0, box.w)))
    element["h"] = _num(max(1.0, min(10000.0, box.h)))
    rotation = _rotation(box.rotation)
    if rotation is not None:
        element["rotation"] = rotation
    return element


# ── context ─────────────────────────────────────────────────────────────────


@dataclass
class Master:
    part: str
    root: ET.Element
    palette: Palette
    title_style: ET.Element | None
    body_style: ET.Element | None
    other_style: ET.Element | None


@dataclass
class Layout:
    part: str
    root: ET.Element
    master: Master


@dataclass
class Scope:
    """The part being read (relationships and colours differ per part)."""

    part: str
    palette: Palette
    layout: Layout | None
    master: Master | None
    #: Shapes of this part are placeholders resolved against the layout.
    inherits: bool = True


@dataclass
class SlideState:
    warnings: Counter = field(default_factory=Counter)
    counter: int = 0

    def warn(self, code: str, count: int = 1) -> None:
        self.warnings[code] += count

    def new_id(self, prefix: str) -> str:
        self.counter += 1
        return f"{prefix}-{self.counter}"


class Converter:
    def __init__(self, pkg: Package, canvas: tuple[int, int], save_image: ImageSaver):
        self.pkg = pkg
        self.canvas = canvas
        self.save_image = save_image
        self.images: dict[str, dict[str, Any] | None] = {}
        self.image_count = 0
        self.masters: dict[str, Master] = {}
        self.layouts: dict[str, Layout] = {}
        pres = pkg.xml("ppt/presentation.xml")
        size = kid(pres, "sldSz")
        self.cx = max(1, _int(size.get("cx") if size is not None else None, 9144000))
        self.cy = max(1, _int(size.get("cy") if size is not None else None, 6858000))
        scale = min(canvas[0] / self.cx, canvas[1] / self.cy)
        self.root_xf = Xform(
            scale, scale, (canvas[0] - self.cx * scale) / 2, (canvas[1] - self.cy * scale) / 2
        )
        self.default_text = kid(pres, "defaultTextStyle")
        self.pres = pres

    # ── parts ──

    def slide_parts(self) -> list[str]:
        rels = self.pkg.rels("ppt/presentation.xml")
        out: list[str] = []
        for sld in kids(kid(self.pres, "sldIdLst"), "sldId"):
            rel = rels.get(sld.get(R_ID) or "")
            if rel and not rel[2] and self.pkg.has(rel[1]):
                out.append(rel[1])
        return out

    def master(self, part: str) -> Master:
        if part not in self.masters:
            root = self.pkg.xml(part)
            if root is None:
                raise PptxError("PPTX_INVALID", "A slide master is missing.")
            theme = read_theme(self.pkg.xml(self.pkg.related(part, "theme")))
            styles = kid(root, "txStyles")
            self.masters[part] = Master(
                part=part,
                root=root,
                palette=Palette(theme, read_map(kid(root, "clrMap"))),
                title_style=kid(styles, "titleStyle"),
                body_style=kid(styles, "bodyStyle"),
                other_style=kid(styles, "otherStyle"),
            )
        return self.masters[part]

    def layout(self, part: str | None) -> Layout | None:
        if not part:
            return None
        if part not in self.layouts:
            root = self.pkg.xml(part)
            master_part = self.pkg.related(part, "slideMaster")
            if root is None or not master_part:
                return None
            self.layouts[part] = Layout(part, root, self.master(master_part))
        return self.layouts[part]

    # ── slides ──

    def convert(self) -> dict[str, Any]:
        parts = self.slide_parts()
        if not parts:
            raise PptxError("PPTX_EMPTY", "The presentation has no slides.")
        deck_warnings: Counter = Counter()
        if len(parts) > MAX_SLIDES:
            deck_warnings["too_many_slides"] = len(parts) - MAX_SLIDES
            parts = parts[:MAX_SLIDES]
        slides = [self.convert_slide(part, index + 1) for index, part in enumerate(parts)]
        return {
            "source": {"width": self.cx, "height": self.cy},
            "canvas": {"width": self.canvas[0], "height": self.canvas[1]},
            "slides": slides,
            "warnings": dict(deck_warnings),
        }

    def convert_slide(self, part: str, index: int) -> dict[str, Any]:
        root = self.pkg.xml(part)
        layout = self.layout(self.pkg.related(part, "slideLayout"))
        master = layout.master if layout else None
        state = SlideState()
        base = master.palette if master else Palette(read_theme(None), read_map(None))
        override = path(root, "clrMapOvr", "overrideClrMapping")
        palette = Palette(base.theme, read_map(override)) if override is not None else base
        scope = Scope(part, palette, layout, master)

        elements: list[dict[str, Any]] = []
        show_master = (kid(root, "cSld") is not None) and (root.get("showMasterSp") not in ("0", "false"))
        if layout and show_master:
            if master and layout.root.get("showMasterSp") not in ("0", "false"):
                master_scope = Scope(master.part, master.palette, None, master, inherits=False)
                elements += self.walk(
                    self._tree(master.root), self.root_xf, (0.0, 0.0), 0, master_scope, state, skip_ph=True
                )
            layout_scope = Scope(
                layout.part, master.palette if master else palette, None, master, inherits=False
            )
            elements += self.walk(
                self._tree(layout.root), self.root_xf, (0.0, 0.0), 0, layout_scope, state, skip_ph=True
            )
        elements += self.walk(self._tree(root), self.root_xf, (0.0, 0.0), 0, scope, state, skip_ph=False)
        if len(elements) > MAX_ELEMENTS:
            state.warn("too_many_elements", len(elements) - MAX_ELEMENTS)
            elements = elements[:MAX_ELEMENTS]
        for z, element in enumerate(elements, start=1):
            element["z"] = z

        slide_id = f"imported-{index}"
        slide: dict[str, Any] = {
            "id": slide_id,
            "background": self.background(root, layout, scope, state),
            "elements": elements,
        }
        slide = self._validated(slide, state)
        return {
            "index": index,
            "title": self.title(root) or _largest_text(slide["elements"]),
            "hidden": root.get("show") in ("0", "false"),
            "slide": slide,
            "notes": self.notes(part),
            "warnings": dict(state.warnings),
        }

    @staticmethod
    def _tree(root: ET.Element | None) -> list[ET.Element]:
        tree = path(root, "cSld", "spTree")
        return list(tree) if tree is not None else []

    def _validated(self, slide: dict[str, Any], state: SlideState) -> dict[str, Any]:
        try:
            return dump_document(validate_slide(slide))
        except ValidationError:
            pass
        # Keep every element that validates on its own; report the others.
        kept: list[dict[str, Any]] = []
        for element in slide["elements"]:
            try:
                validate_slide({"id": slide["id"], "elements": [element]})
                kept.append(element)
            except ValidationError:
                state.warn("element_invalid")
        slide = {**slide, "elements": kept}
        try:
            return dump_document(validate_slide(slide))
        except ValidationError:
            state.warn("element_invalid")
            return dump_document(validate_slide({"id": slide["id"], "elements": kept}))

    def title(self, root: ET.Element | None) -> str:
        for sp in descendants(path(root, "cSld", "spTree"), "sp"):
            ph = _ph(sp)
            if ph and ph[0] in _TITLES:
                text = " ".join(t.text or "" for t in descendants(kid(sp, "txBody"), "t")).strip()
                if text:
                    return text[:120]
        return ""

    def notes(self, part: str) -> str:
        notes_part = self.pkg.related(part, "notesSlide")
        root = self.pkg.xml(notes_part) if notes_part else None
        lines: list[str] = []
        for sp in descendants(path(root, "cSld", "spTree"), "sp"):
            ph = _ph(sp)
            if not ph or ph[0] != "body":
                continue
            for p in kids(kid(sp, "txBody"), "p"):
                text = "".join(_run_text(child) for child in p).replace("\v", "\n")
                lvl = _int((kid(p, "pPr") if kid(p, "pPr") is not None else ET.Element("x")).get("lvl"))
                lines.append(
                    ("  " * lvl + "- " + text) if kid(kid(p, "pPr"), "buChar") is not None and text else text
                )
        return "\n".join(lines).strip()[:MAX_NOTES]

    # ── background ──

    def background(
        self, root: ET.Element | None, layout: Layout | None, scope: Scope, state: SlideState
    ) -> dict[str, Any]:
        sources = [(root, scope.part, scope.palette)]
        if layout:
            sources.append((layout.root, layout.part, layout.master.palette))
            sources.append((layout.master.root, layout.master.part, layout.master.palette))
        for owner, part, palette in sources:
            bg = path(owner, "cSld", "bg")
            if bg is None:
                continue
            props = kid(bg, "bgPr")
            if props is not None:
                found = self._bg_fill(props, part, palette, state)
                if found:
                    return found
            ref = kid(bg, "bgRef")
            if ref is not None:
                color = raw_hex(next(iter(ref), None), palette)
                if color:
                    return {"type": "color", "token": color}
        white = scope.palette.theme.colors.get(scope.palette.color_map.get("bg1", "lt1"), "FFFFFF")
        return {"type": "color", "token": f"#{white}"}

    def _bg_fill(
        self, props: ET.Element, part: str, palette: Palette, state: SlideState
    ) -> dict[str, Any] | None:
        for child in props:
            name = local(child.tag)
            if name == "solidFill":
                color = color_of(child, palette)
                if color:
                    return {"type": "color", "token": color}
            elif name == "gradFill":
                stops = []
                for gs in kids(kid(child, "gsLst"), "gs"):
                    color = color_of(gs, palette)
                    if color:
                        stops.append(
                            {"color": color, "at": _num(max(0, min(100000, _int(gs.get("pos")))) / 100000, 4)}
                        )
                stops.sort(key=lambda s: s["at"])
                if len(stops) >= 2:
                    lin = kid(child, "lin")
                    angle = ((_int(lin.get("ang")) / 60000 if lin is not None else 90) + 90) % 360
                    return {"type": "gradient", "angle": _num(angle, 2), "stops": stops[:8]}
                if stops:
                    return {"type": "color", "token": stops[0]["color"]}
            elif name == "blipFill":
                image = self.image(part, kid(child, "blip"), state)
                if image:
                    return {"type": "image", "src": image["path"], "fit": "cover"}
            elif name == "pattFill":
                color = color_of(kid(child, "fgClr"), palette)
                if color:
                    return {"type": "color", "token": color}
        return None

    # ── pictures ──

    def image(self, part: str, blip: ET.Element | None, state: SlideState) -> dict[str, Any] | None:
        if blip is None:
            return None
        if blip.get(R_EMBED) is None and blip.get(R_LINK):
            state.warn("picture_linked")
            return None
        rel = self.pkg.rels(part).get(blip.get(R_EMBED) or "")
        if not rel or rel[2] or not self.pkg.has(rel[1]):
            state.warn("picture_unsupported")
            return None
        target = rel[1]
        if target in self.images:
            if self.images[target] is None:
                state.warn("picture_unsupported")
            return self.images[target]
        ext = posixpath.splitext(target)[1].lower()
        stored: dict[str, Any] | None = None
        if ext in _IMAGE_EXTS and self.image_count < MAX_IMAGES:
            try:
                data = self.pkg.read(target, MAX_MEDIA_BYTES)
                stored = self._store(data, target, state)
            except PptxError as exc:
                if exc.code != "PPTX_TOO_COMPLEX":
                    raise
                state.warn("picture_too_large")
                self.images[target] = None
                return None
        if stored is None:
            state.warn("picture_unsupported")
        self.images[target] = stored
        return stored

    def _store(self, data: bytes, target: str, state: SlideState) -> dict[str, Any] | None:
        from PIL import Image

        try:
            with Image.open(io.BytesIO(data)) as img:
                if img.width * img.height > MAX_PIXELS:
                    state.warn("picture_too_large")
                    return None
        except Exception:
            return None
        self.image_count += 1
        stem = (
            re.sub(r"[^A-Za-z0-9_-]+", "-", posixpath.splitext(posixpath.basename(target))[0]).strip("-")[:40]
            or "image"
        )
        try:
            return self.save_image(data, f"{self.image_count:03d}-{stem}")
        except Exception:
            return None

    # ── tree ──

    def walk(
        self,
        nodes: list[ET.Element],
        xf: Xform,
        origin: tuple[float, float],
        depth: int,
        scope: Scope,
        state: SlideState,
        *,
        skip_ph: bool,
        group_fill: str | None = None,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for node in nodes:
            tag = local(node.tag)
            if tag == "AlternateContent":
                branch = kid(node, "Fallback")
                if branch is None:
                    branch = kid(node, "Choice")
                if branch is not None:
                    out += self.walk(
                        list(branch), xf, origin, depth, scope, state, skip_ph=skip_ph, group_fill=group_fill
                    )
            elif tag in ("sp", "cxnSp"):
                if skip_ph and _ph(node):
                    continue
                out += self.shape(node, xf, origin, scope, state, group_fill)
            elif tag == "pic":
                if skip_ph and _ph(node):
                    continue
                out += self.picture(node, xf, origin, scope, state)
            elif tag == "grpSp":
                out += self.group(node, xf, origin, depth, scope, state, skip_ph=skip_ph)
            elif tag == "graphicFrame":
                out += self.frame(node, xf, origin, depth, scope, state)
            elif tag == "contentPart":
                state.warn("object_skipped")
        return out

    def group(
        self,
        node: ET.Element,
        xf: Xform,
        origin,
        depth: int,
        scope: Scope,
        state: SlideState,
        *,
        skip_ph: bool,
    ) -> list[dict[str, Any]]:
        props = kid(node, "grpSpPr")
        xfrm = kid(props, "xfrm")
        off = _pair(kid(xfrm, "off"), "x", "y") or (0, 0)
        ext = _pair(kid(xfrm, "ext"), "cx", "cy") or (0, 0)
        ch_off = _pair(kid(xfrm, "chOff"), "x", "y") or off
        ch_ext = _pair(kid(xfrm, "chExt"), "cx", "cy") or ext
        child_xf = xf.child(off, ext, ch_off, ch_ext)
        fill = None
        solid = kid(props, "solidFill")
        if solid is not None:
            fill = color_of(solid, scope.palette)
        box = _box(xfrm, xf)
        children_nodes = [child for child in node if local(child.tag) not in ("nvGrpSpPr", "grpSpPr")]
        if box is None or box.w <= 0 or box.h <= 0 or depth + 1 > MAX_GROUP_DEPTH:
            if box is not None and box.rotation and depth + 1 > MAX_GROUP_DEPTH:
                state.warn("group_flattened")
            return self.walk(
                children_nodes, child_xf, origin, depth, scope, state, skip_ph=skip_ph, group_fill=fill
            )
        children = self.walk(
            children_nodes,
            child_xf,
            (box.x, box.y),
            depth + 1,
            scope,
            state,
            skip_ph=skip_ph,
            group_fill=fill,
        )
        if not children:
            return []
        if len(children) > MAX_CHILDREN:
            state.warn("too_many_elements", len(children) - MAX_CHILDREN)
            children = children[:MAX_CHILDREN]
        for z, child in enumerate(children, start=1):
            child["z"] = z
        element: dict[str, Any] = {"id": state.new_id("group"), "type": "group", "children": children}
        _common(element, node, scope, self.pkg)
        return [_place(element, box, origin)]

    # ── shapes ──

    def chain(self, node: ET.Element, scope: Scope) -> tuple[list[ET.Element], tuple[str, str | None] | None]:
        """The shape and the layout / master placeholders it inherits from."""
        ph = _ph(node)
        if not ph or not scope.inherits or scope.layout is None:
            return [node], ph
        chain = [node]
        layout_ph = _find_ph(scope.layout.root, ph, by_idx=True)
        if layout_ph is not None:
            chain.append(layout_ph)
        master_ph = _find_ph(scope.layout.master.root, ph, by_idx=False)
        if master_ph is not None:
            chain.append(master_ph)
        return chain, ph

    def shape(
        self, node: ET.Element, xf: Xform, origin, scope: Scope, state: SlideState, group_fill: str | None
    ) -> list[dict[str, Any]]:
        chain, ph = self.chain(node, scope)
        xfrm = _first(chain, "spPr", "xfrm")
        box = _box(xfrm, xf)
        if box is None:
            return []
        props = [kid(sp, "spPr") for sp in chain]
        geom = _first(chain, "spPr", "prstGeom")
        prst = (
            geom.get("prst", "rect")
            if geom is not None
            else ("custom" if _first(chain, "spPr", "custGeom") is not None else "rect")
        )
        style = kid(node, "style")
        out: list[dict[str, Any]] = []

        stroke, stroke_w = self.line(props, style, xf, scope.palette)
        if local(node.tag) == "cxnSp" or prst in _LINES or prst in _BENT_LINES:
            if prst in _BENT_LINES:
                state.warn("connector_straightened")
            element = self.line_element(node, box, prst, props, stroke, stroke_w, origin, scope, state)
            return [element] if element else []

        fill = self.fill(props, style, scope, state, group_fill)
        image_fill = None
        if fill and fill[0] == "image":
            image_fill = fill[1]
            fill = None
        kind = "rect"
        radius = None
        if prst in _ELLIPSE_LIKE:
            kind = "ellipse"
        elif prst in _ROUND_LIKE:
            adj = _adj(geom, 16667)
            radius = _num(min(box.w, box.h) * min(adj, 50000) / 100000)
        elif prst not in _RECT_LIKE and (fill or stroke or image_fill):
            state.warn("shape_approximated")

        if image_fill:
            image: dict[str, Any] = {
                "id": state.new_id("image"),
                "type": "image",
                "src": image_fill["path"],
                "fit": "cover",
            }
            if radius:
                image["radius"] = radius
            elif kind == "ellipse":
                image["radius"] = _num(min(box.w, box.h) / 2)
            _common(image, node, scope, self.pkg)
            out.append(_place(image, box, origin))
        if (fill and fill[1]) or stroke:
            element: dict[str, Any] = {"id": state.new_id("shape"), "type": "shape", "shape": kind}
            element["fill"] = fill[1] if fill and fill[1] else "#00000000"
            if stroke:
                element["stroke"] = stroke
                element["strokeWidth"] = stroke_w
            if radius:
                element["radius"] = radius
            _common(element, node, scope, self.pkg)
            out.append(_place(element, box, origin))
        out += self.text(node, chain, ph, box, xf, origin, scope, state)
        return out

    def fill(
        self,
        props: list[ET.Element | None],
        style: ET.Element | None,
        scope: Scope,
        state: SlideState,
        group_fill: str | None,
    ):
        """``("color", hex)``, ``("none", None)``, ``("image", stored)`` or None."""
        for sp_pr in props:
            if sp_pr is None:
                continue
            for child in sp_pr:
                name = local(child.tag)
                if name == "noFill":
                    return ("none", None)
                if name == "solidFill":
                    return ("color", color_of(child, scope.palette))
                if name == "gradFill":
                    stops = kids(kid(child, "gsLst"), "gs")
                    if stops:
                        state.warn("gradient_simplified")
                        return ("color", color_of(stops[0], scope.palette))
                if name == "pattFill":
                    return ("color", color_of(kid(child, "fgClr"), scope.palette))
                if name == "grpFill":
                    return ("color", group_fill) if group_fill else ("none", None)
                if name == "blipFill":
                    stored = self.image(scope.part, kid(child, "blip"), state)
                    return ("image", stored) if stored else ("none", None)
        ref = kid(style, "fillRef")
        if ref is not None and _int(ref.get("idx")) > 0:
            return ("color", raw_hex(next(iter(ref), None), scope.palette))
        return None

    def line(
        self, props: list[ET.Element | None], style: ET.Element | None, xf: Xform, palette: Palette
    ) -> tuple[str | None, float]:
        scale = (abs(xf.sx) + abs(xf.sy)) / 2
        for sp_pr in props:
            ln = kid(sp_pr, "ln")
            if ln is None:
                continue
            width = _num(max(0.5, min(200.0, _int(ln.get("w"), 12700) * scale)), 2)
            if kid(ln, "noFill") is not None:
                return None, 0.0
            solid = kid(ln, "solidFill")
            if solid is not None:
                return color_of(solid, palette), width
            grad = kid(ln, "gradFill")
            if grad is not None:
                stops = kids(kid(grad, "gsLst"), "gs")
                return (color_of(stops[0], palette) if stops else None), width
            # A width alone keeps the style's colour.
            ref = kid(style, "lnRef")
            if ref is not None and _int(ref.get("idx")) > 0:
                return raw_hex(next(iter(ref), None), palette), width
            return None, 0.0
        ref = kid(style, "lnRef")
        if ref is not None and _int(ref.get("idx")) > 0:
            widths = palette.theme.line_widths
            idx = _int(ref.get("idx"))
            emu = widths[idx - 1] if 0 < idx <= len(widths) else 12700
            return raw_hex(next(iter(ref), None), palette), _num(max(0.5, min(200.0, emu * scale)), 2)
        return None, 0.0

    def line_element(
        self, node, box: Box, prst: str, props, stroke, stroke_w, origin, scope: Scope, state: SlideState
    ) -> dict[str, Any] | None:
        if not stroke:
            return None
        # Ends in the unrotated box, flipped, then turned about the centre.
        x1, y1, x2, y2 = 0.0, 0.0, box.w, box.h
        if box.flip_h:
            x1, x2 = x2, x1
        if box.flip_v:
            y1, y2 = y2, y1
        cx, cy = box.w / 2, box.h / 2
        angle = math.radians(box.rotation)

        def turn(x: float, y: float) -> tuple[float, float]:
            dx, dy = x - cx, y - cy
            return cx + dx * math.cos(angle) - dy * math.sin(angle), cy + dx * math.sin(
                angle
            ) + dy * math.cos(angle)

        (ax, ay), (bx, by) = turn(x1, y1), turn(x2, y2)
        ln = next((kid(p, "ln") for p in props if kid(p, "ln") is not None), None)
        head = kid(ln, "headEnd")
        tail = kid(ln, "tailEnd")
        has_head = head is not None and head.get("type", "none") != "none"
        has_tail = tail is not None and tail.get("type", "none") != "none"
        if has_head and not has_tail:
            (ax, ay), (bx, by) = (bx, by), (ax, ay)
        length = math.hypot(bx - ax, by - ay)
        thickness = max(2.0, stroke_w * 2)
        mid_x, mid_y = box.x + (ax + bx) / 2, box.y + (ay + by) / 2
        line_box = Box(
            mid_x - length / 2,
            mid_y - thickness / 2,
            max(1.0, length),
            thickness,
            math.degrees(math.atan2(by - ay, bx - ax)),
        )
        element: dict[str, Any] = {
            "id": state.new_id("line"),
            "type": "shape",
            "shape": "arrow" if (has_head or has_tail) else "line",
            "stroke": stroke,
            "strokeWidth": stroke_w,
        }
        _common(element, node, scope, self.pkg)
        return _place(element, line_box, origin)

    def picture(
        self, node: ET.Element, xf: Xform, origin, scope: Scope, state: SlideState
    ) -> list[dict[str, Any]]:
        chain, _ph_info = self.chain(node, scope)
        box = _box(_first(chain, "spPr", "xfrm"), xf)
        fill = kid(node, "blipFill")
        if box is None or fill is None:
            return []
        if descendants(kid(node, "nvPicPr"), "videoFile") or descendants(kid(node, "nvPicPr"), "audioFile"):
            state.warn("media_poster")
        stored = self.image(scope.part, kid(fill, "blip"), state)
        if not stored:
            return []
        element: dict[str, Any] = {
            "id": state.new_id("image"),
            "type": "image",
            "src": stored["path"],
            "fit": "fill",
        }
        rect = kid(fill, "srcRect")
        if rect is not None:
            left, top = _int(rect.get("l")) / 100000, _int(rect.get("t")) / 100000
            right, bottom = _int(rect.get("r")) / 100000, _int(rect.get("b")) / 100000
            w, h = 1 - left - right, 1 - top - bottom
            if (
                0 <= left < 1
                and 0 <= top < 1
                and 0 < w <= 1
                and 0 < h <= 1
                and (left or top or right or bottom)
            ):
                element["crop"] = {"x": _num(left, 4), "y": _num(top, 4), "w": _num(w, 4), "h": _num(h, 4)}
        geom = path(node, "spPr", "prstGeom")
        prst = geom.get("prst") if geom is not None else "rect"
        if prst in _ROUND_LIKE:
            element["radius"] = _num(min(box.w, box.h) * min(_adj(geom, 16667), 50000) / 100000)
        elif prst in _ELLIPSE_LIKE:
            element["radius"] = _num(min(box.w, box.h) / 2)
        alpha = kid(kid(fill, "blip"), "alphaModFix")
        if alpha is not None:
            element["opacity"] = _num(max(0.0, min(1.0, _int(alpha.get("amt"), 100000) / 100000)), 3)
        cnv = path(node, "nvPicPr", "cNvPr")
        if cnv is not None and cnv.get("descr"):
            element["alt"] = cnv.get("descr", "")[:300]
        _common(element, node, scope, self.pkg)
        return [_place(element, box, origin)]

    # ── graphic frames: tables, charts, SmartArt ──

    def frame(
        self, node: ET.Element, xf: Xform, origin, depth: int, scope: Scope, state: SlideState
    ) -> list[dict[str, Any]]:
        box = _box(kid(node, "xfrm"), xf)
        data = path(node, "graphic", "graphicData")
        if box is None or data is None:
            return []
        uri = data.get("uri", "")
        if uri.endswith("/table"):
            element = self.table(kid(data, "tbl"), box, xf, scope, state)
        elif uri.endswith("/chart"):
            chart = kid(data, "chart")
            rel = self.pkg.rels(scope.part).get(chart.get(R_ID) or "") if chart is not None else None
            element = self.chart(rel[1] if rel and not rel[2] else None, scope)
            if element is None:
                state.warn("chart_placeholder")
                element = _placeholder("Chart")
        elif uri.endswith("/diagram"):
            group = self.smartart(kid(data, "relIds"), box, xf, origin, depth, scope, state)
            if group is not None:
                return [group]
            state.warn("smartart_placeholder")
            element = _placeholder("SmartArt")
        else:
            # OLE objects and the like: their picture fallback, when there is one.
            pics = descendants(data, "pic")
            if pics:
                return (
                    self.picture(pics[0], xf, origin, scope, state)
                    if _box(path(pics[0], "spPr", "xfrm"), xf)
                    else []
                )
            state.warn("object_skipped")
            return []
        if element is None:
            return []
        element["id"] = state.new_id(element["type"])
        _common(element, node, scope, self.pkg)
        return [_place(element, box, origin)]

    def table(
        self, tbl: ET.Element | None, box: Box, xf: Xform, scope: Scope, state: SlideState
    ) -> dict[str, Any] | None:
        if tbl is None:
            return None
        rows_xml = kids(tbl, "tr")
        if not rows_xml:
            return None
        if len(rows_xml) > 50:
            state.warn("table_truncated")
            rows_xml = rows_xml[:50]
        defaults = scope.master.other_style if scope.master else None
        sources = _level_sources([], None, defaults, self.default_text, 1)
        rows: list[list[list[dict[str, Any]] | None]] = []
        size = header_fill = border = None
        colors: Counter = Counter()
        merged = False
        for r, tr in enumerate(rows_xml):
            cells_xml = kids(tr, "tc")
            if len(cells_xml) > 20:
                state.warn("table_truncated")
                cells_xml = cells_xml[:20]
            row: list[dict[str, Any]] = []
            for c, tc in enumerate(cells_xml):
                if tc.get("hMerge") or tc.get("vMerge"):
                    merged = True
                    row.append(None)
                    continue
                if tc.get("gridSpan") or tc.get("rowSpan"):
                    merged = True
                runs: list[dict[str, Any]] = []
                for i, p in enumerate(kids(kid(tc, "txBody"), "p")):
                    para = self.paragraph(p, sources, scope, state, 1.0)
                    if i and runs:
                        runs[-1]["text"] += "\n"
                    runs += para["runs"]
                    if size is None:
                        size = next((run["size"] for run in para["runs"] if run["text"].strip()), None)
                    for run in para["runs"]:
                        if run["text"].strip():
                            colors[run["color"]] += len(run["text"])
                tc_pr = kid(tc, "tcPr")
                if r == 0 and c == 0 and tc_pr is not None:
                    header_fill = color_of(kid(tc_pr, "solidFill"), scope.palette)
                    for side in ("lnB", "lnT", "lnL", "lnR"):
                        border = border or color_of(kid(kid(tc_pr, side), "solidFill"), scope.palette)
                row.append(runs)
            rows.append(row)
        color = colors.most_common(1)[0][0] if colors else None
        cells = [
            [_inline(runs, {"color": color}, state) if runs else {"text": ""} for runs in row]
            or [{"text": ""}]
            for row in rows
        ]
        if merged:
            state.warn("table_merged_cells")
        element: dict[str, Any] = {"type": "table", "rows": cells}
        first_row = kid(tbl, "tblPr")
        if first_row is not None and first_row.get("firstRow") in ("1", "true"):
            element["headerRow"] = True
        widths = [_int(col.get("w")) * xf.sx for col in kids(kid(tbl, "tblGrid"), "gridCol")][:20]
        if widths and all(w > 0 for w in widths):
            element["columnWidths"] = [_num(w) for w in widths]
        style: dict[str, Any] = {}
        if size:
            style["size"] = _num(max(6.0, min(200.0, size * EMU_PER_PT * xf.sy)))
        if color:
            style["color"] = color
        if header_fill:
            style["headerFill"] = header_fill
        if border:
            style["border"] = border
        if style:
            element["style"] = style
        return element

    def chart(self, part: str | None, scope: Scope) -> dict[str, Any] | None:
        root = self.pkg.xml(part) if part else None
        chart = kid(root, "chart")
        plot = kid(chart, "plotArea")
        if plot is None:
            return None
        palette = scope.palette
        for node in plot:
            kind = _CHART_KINDS.get(local(node.tag))
            if not kind:
                continue
            series = []
            labels: list[str] = []
            for ser in kids(node, "ser")[:12]:
                name = (
                    " ".join(v.text or "" for v in descendants(kid(ser, "tx"), "v")).strip()
                    or f"Series {len(series) + 1}"
                )
                cat = kid(ser, "cat") if kid(ser, "cat") is not None else kid(ser, "xVal")
                val = kid(ser, "val") if kid(ser, "val") is not None else kid(ser, "yVal")
                points = _points(val)
                if not points:
                    continue
                if not labels:
                    labels = [str(v)[:120] for v in _points(cat, numeric=False).values()] or [
                        str(i + 1) for i in range(len(points))
                    ]
                values = [float(points.get(i, 0.0)) for i in range(max(len(labels), max(points) + 1))][:100]
                entry: dict[str, Any] = {"name": name[:120], "values": values}
                solid = path(ser, "spPr", "solidFill")
                if solid is not None:
                    color = color_of(solid, palette)
                    if color:
                        entry["color"] = color
                series.append(entry)
            if not series:
                return None
            length = max(len(s["values"]) for s in series)
            labels = (labels + [str(i + 1) for i in range(len(labels), length)])[:100]
            for s in series:
                s["values"] = (s["values"] + [0.0] * (len(labels) - len(s["values"])))[: len(labels)]
            options: dict[str, Any] = {}
            grouping = kid(node, "grouping")
            if grouping is not None and grouping.get("val") in ("stacked", "percentStacked"):
                options["stacked"] = True
            options["legend"] = kid(chart, "legend") is not None
            if any(v.get("val") in ("1", "true") for v in descendants(node, "showVal")):
                options["values"] = True
            return {
                "type": "chart",
                "chart": kind,
                "data": {"labels": labels, "series": series},
                "options": options,
            }
        return None

    def smartart(
        self,
        rel_ids: ET.Element | None,
        box: Box,
        xf: Xform,
        origin,
        depth: int,
        scope: Scope,
        state: SlideState,
    ) -> dict[str, Any] | None:
        """The pre-drawn shapes of a SmartArt (``dsp:drawing``), as a group."""
        if rel_ids is None or depth + 1 > MAX_GROUP_DEPTH:
            return None
        rels = self.pkg.rels(scope.part)
        data_rel = rels.get(rel_ids.get(R_DM) or "")
        drawing_part = None
        if data_rel and not data_rel[2]:
            ext = next(
                (e for e in descendants(self.pkg.xml(data_rel[1]), "dataModelExt") if e.get("relId")), None
            )
            if ext is not None:
                found = rels.get(ext.get("relId") or "")
                drawing_part = found[1] if found and not found[2] else None
        tree = path(self.pkg.xml(drawing_part), "spTree") if drawing_part else None
        if tree is None:
            return None
        # Drawing coordinates start at the frame's corner.
        inner = Xform(xf.sx, xf.sy, box.x, box.y)
        drawing_scope = Scope(drawing_part, scope.palette, None, scope.master, inherits=False)
        children = self.walk(
            list(tree), inner, (box.x, box.y), depth + 1, drawing_scope, state, skip_ph=False
        )
        if not children:
            return None
        children = children[:MAX_CHILDREN]
        for z, child in enumerate(children, start=1):
            child["z"] = z
        group = {"id": state.new_id("group"), "type": "group", "name": "SmartArt", "children": children}
        return _place(group, Box(box.x, box.y, box.w, box.h, box.rotation), origin)

    # ── text ──

    def text(
        self,
        node: ET.Element,
        chain: list[ET.Element],
        ph,
        box: Box,
        xf: Xform,
        origin,
        scope: Scope,
        state: SlideState,
    ) -> list[dict[str, Any]]:
        body = kid(node, "txBody")
        if body is None:
            return []
        paragraphs_xml = kids(body, "p")
        if not any((t.text or "").strip() for p in paragraphs_xml for t in descendants(p, "t")):
            return []
        body_pr = _merged_attrs([kid(kid(sp, "txBody"), "bodyPr") for sp in chain])
        autofit = descendants(kid(body, "bodyPr"), "normAutofit")
        font_scale = _int(autofit[0].get("fontScale"), 100000) / 100000 if autofit else 1.0
        spacing_cut = _int(autofit[0].get("lnSpcReduction"), 0) / 100000 if autofit else 0.0

        ph_type = ph[0] if ph else None
        if ph_type in _TITLES:
            kind_style = scope.master.title_style if scope.master else None
        elif ph:
            kind_style = scope.master.body_style if scope.master else None
        else:
            kind_style = scope.master.other_style if scope.master else None
        lst_styles = [kid(kid(sp, "txBody"), "lstStyle") for sp in chain]
        # The shape style's text colour sits between the shape's own list
        # styles and the master's: a synthetic level carries it.
        font_ref = path(node, "style", "fontRef")
        ref_color = raw_hex(next(iter(font_ref), None), scope.palette) if font_ref is not None else None
        ref_level = None
        if ref_color:
            ref_level = ET.Element("lvl")
            fill = ET.SubElement(ET.SubElement(ref_level, "defRPr"), "solidFill")
            ET.SubElement(fill, "srgbClr", {"val": ref_color[1:7]})

        paragraphs = []
        for p in paragraphs_xml:
            lvl = _int((kid(p, "pPr") if kid(p, "pPr") is not None else ET.Element("x")).get("lvl"))
            own = _level_sources(lst_styles, None, None, None, lvl + 1)
            rest = _level_sources(
                [], kind_style if ph else None, None if ph else kind_style, self.default_text, lvl + 1
            )
            sources = [kid(p, "pPr"), *own, *([ref_level] if ref_level is not None else []), *rest]
            para = self.paragraph(p, sources, scope, state, font_scale, None, spacing_cut)
            para["level"] = min(4, lvl)
            paragraphs.append(para)
        while paragraphs and not paragraphs[-1]["text"].strip():
            paragraphs.pop()
        while paragraphs and not paragraphs[0]["text"].strip():
            paragraphs.pop(0)

        scale = xf.sx
        insets = {
            "l": _int(body_pr.get("lIns"), 91440) * scale,
            "t": _int(body_pr.get("tIns"), 45720) * xf.sy,
            "r": _int(body_pr.get("rIns"), 91440) * scale,
            "b": _int(body_pr.get("bIns"), 45720) * xf.sy,
        }
        inner = Box(
            box.x + insets["l"],
            box.y + insets["t"],
            max(1.0, box.w - insets["l"] - insets["r"]),
            max(1.0, box.h - insets["t"] - insets["b"]),
            box.rotation,
        )
        role = "title" if ph_type in _TITLES else "subtitle" if ph_type == "subTitle" else "body"
        anchor = {"t": "top", "ctr": "middle", "b": "bottom"}.get(body_pr.get("anchor", "t"), "top")
        theme = scope.palette.theme

        segments = _segments(paragraphs)
        if len(segments) == 1:
            element = self.text_element(segments[0], role, ph_type, theme, scale, state)
            element["style"]["valign"] = anchor
            _common(element, node, scope, self.pkg)
            return [_place(element, inner, origin)]

        # Sizes too far apart for one element: stack one element per size.
        state.warn("text_split")
        heights = [_estimate_height(seg, inner.w, scale) for seg in segments]
        total = sum(heights)
        top = inner.y
        if anchor == "middle":
            top += max(0.0, (inner.h - total) / 2)
        elif anchor == "bottom":
            top += max(0.0, inner.h - total)
        out = []
        for seg, height in zip(segments, heights, strict=True):
            element = self.text_element(seg, role, ph_type, theme, scale, state)
            _common(element, node, scope, self.pkg)
            out.append(_place(element, Box(inner.x, top, inner.w, max(1.0, height), box.rotation), origin))
            top += height
        return out

    def paragraph(
        self,
        p: ET.Element,
        sources: list[ET.Element | None],
        scope: Scope,
        state: SlideState,
        font_scale: float,
        fallback_color: str | None = None,
        spacing_cut: float = 0.0,
    ) -> dict[str, Any]:
        algn = _first_attr(sources, "algn") or "l"
        bullet = "none"
        for src in sources:
            if src is None:
                continue
            if kid(src, "buNone") is not None:
                break
            if kid(src, "buAutoNum") is not None:
                bullet = "ordered"
                break
            if kid(src, "buChar") is not None or kid(src, "buBlip") is not None:
                bullet = "bullet"
                break
        line_mult = None
        for src in sources:
            spacing = kid(kid(src, "lnSpc"), "spcPct")
            if spacing is not None:
                line_mult = max(0.1, _int(spacing.get("val"), 100000) / 100000 - spacing_cut)
                break
        defaults = [kid(src, "defRPr") for src in sources]
        runs: list[dict[str, Any]] = []
        for child in p:
            name = local(child.tag)
            if name == "br":
                if runs:
                    runs[-1]["text"] += "\n"
                else:
                    runs.append(
                        self.run("\n", [kid(child, "rPr"), *defaults], scope, font_scale, fallback_color)
                    )
            elif name in ("r", "fld"):
                text = _run_text(child).replace("\v", "\n")
                runs.append(self.run(text, [kid(child, "rPr"), *defaults], scope, font_scale, fallback_color))
        runs = [run for run in runs if run["text"]]
        return {
            "align": {"l": "left", "ctr": "center", "r": "right", "just": "justify", "dist": "justify"}.get(
                algn, "left"
            ),
            "bullet": bullet,
            "line": line_mult,
            "runs": runs,
            "text": "".join(run["text"] for run in runs),
        }

    def run(
        self,
        text: str,
        props: list[ET.Element | None],
        scope: Scope,
        font_scale: float,
        fallback_color: str | None,
    ) -> dict[str, Any]:
        size = (_int(_first_attr(props, "sz"), 1800) / 100) * font_scale
        color = None
        for prop in props:
            if prop is None:
                continue
            solid = kid(prop, "solidFill")
            if solid is not None:
                color = color_of(solid, scope.palette)
                break
            grad = kid(prop, "gradFill")
            if grad is not None:
                stops = kids(kid(grad, "gsLst"), "gs")
                color = color_of(stops[0], scope.palette) if stops else None
                break
        if color is None:
            color = fallback_color
        if color is None:
            tx1 = scope.palette.color_map.get("tx1", "dk1")
            color = f"#{scope.palette.theme.colors.get(tx1, '000000')}"
        typeface = ""
        for prop in props:
            latin = kid(prop, "latin")
            if latin is not None and latin.get("typeface"):
                typeface = latin.get("typeface", "")
                break
        link = None
        rpr = props[0]
        click = kid(rpr, "hlinkClick")
        if click is not None:
            rel = self.pkg.rels(scope.part).get(click.get(R_ID) or "")
            if rel and rel[2] and rel[1].startswith("https://") and len(rel[1]) <= 2000:
                link = rel[1]
        underline = _first_attr(props, "u")
        return {
            "text": text,
            "size": size,
            "bold": _flag(_first_attr(props, "b")),
            "italic": _flag(_first_attr(props, "i")),
            "underline": bool(underline and underline != "none"),
            "upper": _first_attr(props, "cap") == "all",
            "spacing": _int(_first_attr(props, "spc"), 0) / 100,
            "color": color,
            "font": typeface,
            "link": link,
        }

    def text_element(
        self, paragraphs: list[dict[str, Any]], role: str, ph_type, theme, scale: float, state: SlideState
    ) -> dict[str, Any]:
        runs = [run for para in paragraphs for run in para["runs"] if run["text"].strip()] or [
            run for para in paragraphs for run in para["runs"]
        ]
        weights: Counter = Counter()
        colors: Counter = Counter()
        fonts: Counter = Counter()
        for run in runs:
            weights[run["size"]] += len(run["text"])
            colors[run["color"]] += len(run["text"])
            fonts[run["font"]] += len(run["text"])
        size_pt = weights.most_common(1)[0][0] if weights else 18.0
        color = colors.most_common(1)[0][0] if colors else None
        font = fonts.most_common(1)[0][0] if fonts else ""
        if font == "+mj-lt":
            family = theme.major_font
        elif font in ("+mn-lt", ""):
            family = theme.minor_font
        else:
            family = font
        if _MONO.search(family or ""):
            font_role = "mono"
        elif (
            ph_type in _TITLES
            or font == "+mj-lt"
            or (family and family == theme.major_font and theme.major_font != theme.minor_font)
        ):
            font_role = "display"
        else:
            font_role = "body"
        all_bold = bool(runs) and all(run["bold"] for run in runs)
        style: dict[str, Any] = {
            "font": font_role,
            "size": _num(max(6.0, min(400.0, size_pt * EMU_PER_PT * scale))),
            "weight": 700 if all_bold else 400,
            "align": next((para["align"] for para in paragraphs if para["text"].strip()), "left"),
        }
        if color:
            style["color"] = color
        if runs and all(run["italic"] for run in runs):
            style["italic"] = True
        if runs and all(run["underline"] for run in runs):
            style["underline"] = True
        if runs and all(run["upper"] for run in runs):
            style["uppercase"] = True
        spacing = next((run["spacing"] for run in runs if run["spacing"]), 0)
        if spacing:
            style["letterSpacing"] = _num(max(-20.0, min(100.0, spacing * EMU_PER_PT * scale)), 2)
        line = next((para["line"] for para in paragraphs if para["line"]), None)
        if line:
            style["lineHeight"] = _num(max(0.5, min(4.0, line * 1.2)), 3)

        base = {
            "bold": all_bold,
            "italic": style.get("italic", False),
            "underline": style.get("underline", False),
            "color": color,
        }
        blocks: list[dict[str, Any]] = []
        for para in paragraphs:
            inline = _inline(para["runs"], base, state)
            if para["bullet"] == "none" or not para["text"].strip():
                blocks.append({"type": "paragraph", **inline})
                continue
            kind = "bullet-list" if para["bullet"] == "bullet" else "ordered-list"
            item = {**inline}
            if para["level"]:
                item["level"] = para["level"]
            if blocks and blocks[-1]["type"] == kind and len(blocks[-1]["items"]) < 50:
                blocks[-1]["items"].append(item)
            else:
                blocks.append({"type": kind, "items": [item]})
        if len(blocks) > 50:
            state.warn("text_truncated")
            blocks = blocks[:50]
        if not blocks:
            blocks = [{"type": "paragraph", "text": " "}]
        return {"id": state.new_id("text"), "type": "text", "role": role, "content": blocks, "style": style}


# ── helpers ─────────────────────────────────────────────────────────────────

R_DM = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}dm"


def _flag(value: str | None) -> bool:
    return value in ("1", "true")


def _run_text(child: ET.Element) -> str:
    t = kid(child, "t")
    return (t.text or "") if t is not None else ""


def _ph(node: ET.Element) -> tuple[str, str | None] | None:
    nv = next((child for child in node if local(child.tag).startswith("nv")), None)
    ph = kid(kid(nv, "nvPr"), "ph")
    if ph is None:
        return None
    return ph.get("type", "obj"), ph.get("idx")


def _family(ph_type: str) -> str:
    if ph_type in _TITLES:
        return "title"
    if ph_type in ("dt", "ftr", "sldNum", "hdr"):
        return ph_type
    return "body"


def _find_ph(root: ET.Element, ph: tuple[str, str | None], *, by_idx: bool) -> ET.Element | None:
    shapes = [
        node
        for node in descendants(path(root, "cSld", "spTree"), "sp")
        + descendants(path(root, "cSld", "spTree"), "pic")
        if _ph(node)
    ]
    ph_type, idx = ph
    if by_idx and idx is not None:
        for node in shapes:
            if _ph(node)[1] == idx:  # type: ignore[index]
                return node
    for node in shapes:
        if _ph(node)[0] == ph_type:  # type: ignore[index]
            return node
    family = _family(ph_type)
    for node in shapes:
        if _family(_ph(node)[0]) == family:  # type: ignore[index]
            return node
    return None


def _first(chain: list[ET.Element], *names: str) -> ET.Element | None:
    for node in chain:
        found = path(node, *names)
        if found is not None:
            return found
    return None


def _merged_attrs(elements: list[ET.Element | None]) -> dict[str, str]:
    out: dict[str, str] = {}
    for el in reversed(elements):
        if el is not None:
            out.update(el.attrib)
    return out


def _first_attr(sources: list[ET.Element | None], attr: str) -> str | None:
    for src in sources:
        if src is not None and src.get(attr) is not None:
            return src.get(attr)
    return None


def _level_sources(
    lst_styles: list[ET.Element | None],
    master_style: ET.Element | None,
    other_style: ET.Element | None,
    default_text: ET.Element | None,
    level: int,
) -> list[ET.Element | None]:
    name = f"lvl{max(1, min(9, level))}pPr"
    out = [kid(style, name) for style in lst_styles]
    if master_style is not None:
        out.append(kid(master_style, name))
    out.append(kid(default_text, name))
    if other_style is not None:
        out.append(kid(other_style, name))
    return [src for src in out if src is not None]


def _adj(geom: ET.Element | None, default: int) -> int:
    for gd in descendants(geom, "gd"):
        fmla = gd.get("fmla", "")
        if fmla.startswith("val "):
            return _int(fmla[4:], default)
    return default


def _common(element: dict[str, Any], node: ET.Element, scope: Scope, pkg: Package) -> None:
    nv = next((child for child in node if local(child.tag).startswith("nv")), None)
    cnv = kid(nv, "cNvPr")
    if cnv is None:
        return
    name = (cnv.get("name") or "").strip()
    if name:
        element["name"] = name[:120]
    if cnv.get("hidden") in ("1", "true"):
        element["hidden"] = True
    click = kid(cnv, "hlinkClick")
    if click is not None:
        rel = pkg.rels(scope.part).get(click.get(R_ID) or "")
        if rel and rel[2] and rel[1].startswith("https://") and len(rel[1]) <= 2000:
            element["link"] = rel[1]


def _placeholder(name: str) -> dict[str, Any]:
    return {
        "type": "shape",
        "shape": "rect",
        "name": f"{name} (not imported)",
        "fill": "#8080801A",
        "stroke": "#80808080",
        "strokeWidth": 2,
    }


def _points(el: ET.Element | None, numeric: bool = True) -> dict[int, Any]:
    cache = None
    for name in ("numCache", "strCache", "numLit", "strLit"):
        found = descendants(el, name)
        if found:
            cache = found[0]
            break
    out: dict[int, Any] = {}
    for pt in kids(cache, "pt"):
        v = kid(pt, "v")
        raw = (v.text or "") if v is not None else ""
        idx = _int(pt.get("idx"))
        if idx < 0 or idx >= 100:
            continue
        if numeric:
            try:
                value = float(raw)
            except ValueError:
                continue
            if math.isfinite(value):
                out[idx] = value
        else:
            out[idx] = raw
    if not numeric:
        return {i: out.get(i, "") for i in range(max(out) + 1)} if out else {}
    return out


def _inline(runs: list[dict[str, Any]], base: dict[str, Any], state: SlideState) -> dict[str, Any]:
    """Runs as an Inline: plain ``text`` when nothing differs from the element style."""
    out_runs = []
    for run in runs:
        text = run["text"]
        if len(text) > 5000:
            state.warn("text_truncated")
            text = text[:5000]
        item: dict[str, Any] = {"text": text}
        if run["bold"] and not base.get("bold"):
            item["bold"] = True
        if run["italic"] and not base.get("italic"):
            item["italic"] = True
        if run["underline"] and not base.get("underline"):
            item["underline"] = True
        if run.get("link"):
            item["link"] = run["link"]
        if run["color"] and run["color"] != base.get("color"):
            item["color"] = run["color"]
        # Neighbours with the same marks merge into one run.
        if out_runs and {k: v for k, v in out_runs[-1].items() if k != "text"} == {
            k: v for k, v in item.items() if k != "text"
        }:
            out_runs[-1]["text"] = (out_runs[-1]["text"] + text)[:5000]
        else:
            out_runs.append(item)
    if len(out_runs) > 100:
        state.warn("text_truncated")
        out_runs = out_runs[:100]
    if not out_runs:
        return {"text": " "}
    if len(out_runs) == 1 and set(out_runs[0]) == {"text"}:
        return {"text": out_runs[0]["text"]}
    return {"runs": out_runs}


def _para_size(para: dict[str, Any]) -> float | None:
    sizes: Counter = Counter()
    for run in para["runs"]:
        if run["text"].strip():
            sizes[run["size"]] += len(run["text"])
    return sizes.most_common(1)[0][0] if sizes else None


def _segments(paragraphs: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Consecutive paragraphs whose text sizes stay within 25% of each other."""
    segments: list[list[dict[str, Any]]] = []
    current_size = None
    for para in paragraphs:
        size = _para_size(para)
        if segments and (
            size is None or current_size is None or max(size, current_size) / min(size, current_size) <= 1.25
        ):
            segments[-1].append(para)
            if current_size is None:
                current_size = size
            continue
        segments.append([para])
        current_size = size
    return segments or [
        [{"align": "left", "bullet": "none", "line": None, "runs": [], "text": "", "level": 0}]
    ]


def _estimate_height(paragraphs: list[dict[str, Any]], width: float, scale: float) -> float:
    total = 0.0
    for para in paragraphs:
        size = (_para_size(para) or 18.0) * EMU_PER_PT * scale
        line = size * 1.2 * (para["line"] or 1.0)
        chars_per_line = max(1.0, width / (size * 0.52))
        lines = sum(
            max(1, math.ceil(len(chunk) / chars_per_line)) for chunk in (para["text"] or " ").split("\n")
        )
        total += lines * line
    return total


def _largest_text(elements: list[dict[str, Any]]) -> str:
    """Text of the biggest text element: the title of a slide without placeholders."""
    best = None
    stack = list(elements)
    while stack:
        el = stack.pop()
        if el["type"] == "group":
            stack += el["children"]
        elif (
            el["type"] == "text"
            and any(c.isalpha() for c in _plain(el))
            and (best is None or el.get("style", {}).get("size", 0) > best.get("style", {}).get("size", 0))
        ):
            best = el
    if best is None:
        return ""
    return _plain(best)


def _plain(el: dict[str, Any]) -> str:
    parts = []
    for block in el["content"]:
        for inline in block.get("items") or [block]:
            parts.append(inline.get("text") or "".join(run["text"] for run in inline.get("runs") or []))
    return " ".join(" ".join(parts).split())[:120]


def convert_pptx(raw: bytes, *, canvas: tuple[int, int], save_image: ImageSaver) -> dict[str, Any]:
    """Convert a .pptx into Forge slides (not saved anywhere); see the module doc."""
    return Converter(Package(raw), canvas, save_image).convert()
