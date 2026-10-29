"""PowerPoint import: conversion to Forge slides, archive guards, the route.

The presentations are built here with ``zipfile`` and minimal XML, so no
binary file lives in the repository.
"""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.auth import get_current_user
from app.config import clear_settings_cache, get_settings
from app.contracts.forge_design import validate_slide
from app.db import get_db
from app.models import Project, ProjectCollaborator
from app.routers import documents as documents_mod
from app.services.document_scaffold import scaffold_slides
from app.services.pptx_import import PptxError, archive, convert_pptx

NS = (
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
    'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"'
)
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
WIDE = (12192000, 6858000)  # 16:9
EMU = 12700  # one point


def _rels(*items: tuple[str, str, str]) -> str:
    body = "".join(
        f'<Relationship Id="{rid}" Type="{REL}/{kind}" Target="{target}"'
        + (' TargetMode="External"' if target.startswith("http") else "")
        + "/>"
        for rid, kind, target in items
    )
    return f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{body}</Relationships>'


def _png(color=(10, 120, 200), size=(64, 32)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def _xfrm(x: int, y: int, cx: int, cy: int, extra: str = "") -> str:
    return f'<a:xfrm{extra}><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'


THEME = f"""<a:theme {NS} name="T"><a:themeElements>
<a:clrScheme name="c">
<a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FAFAFA"/></a:lt1>
<a:dk2><a:srgbClr val="222244"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>
<a:accent1><a:srgbClr val="FF0000"/></a:accent1><a:accent2><a:srgbClr val="00AA00"/></a:accent2>
<a:accent3><a:srgbClr val="0000FF"/></a:accent3><a:accent4><a:srgbClr val="FFFF00"/></a:accent4>
<a:accent5><a:srgbClr val="00FFFF"/></a:accent5><a:accent6><a:srgbClr val="FF00FF"/></a:accent6>
<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="f"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>
<a:fmtScheme name="s"><a:lnStyleLst><a:ln w="12700"/><a:ln w="25400"/><a:ln w="38100"/></a:lnStyleLst></a:fmtScheme>
</a:themeElements></a:theme>"""

MASTER = f"""<p:sldMaster {NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill></p:bgPr></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title Placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
<p:spPr>{_xfrm(600000, 300000, 10000000, 1000000)}</p:spPr><p:txBody><a:bodyPr anchor="b"/><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body Placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
<p:spPr>{_xfrm(600000, 1500000, 10000000, 4000000)}</p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Body</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="4" name="Brand bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr>{_xfrm(0, 6604000, 12192000, 254000)}<a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr></p:sp>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:txStyles>
<p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>
<p:bodyStyle><a:lvl1pPr><a:buChar char="&#8226;"/><a:defRPr sz="2800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr>
<a:lvl2pPr><a:buChar char="-"/><a:defRPr sz="2400"/></a:lvl2pPr></p:bodyStyle>
<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>
</p:txStyles></p:sldMaster>"""

LAYOUT = f"""<p:sldLayout {NS}><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
<p:spPr>{_xfrm(1219200, 685800, 9753600, 1371600)}</p:spPr><p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/><a:p/></p:txBody></p:sp>
</p:spTree></p:cSld></p:sldLayout>"""


def _shape(sid: int, name: str, body: str) -> str:
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>{body}</p:sp>'


def _cell(text: str, fill: str = "") -> str:
    props = f'<a:tcPr><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill></a:tcPr>' if fill else "<a:tcPr/>"
    return f'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1400"/><a:t>{text}</a:t></a:r></a:p></a:txBody>{props}</a:tc>'


SLIDE = f"""<p:sld {
    NS
}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFF5E0"/></a:solidFill></p:bgPr></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>Bilan annuel</a:t></a:r></a:p></p:txBody></p:sp>
{
    _shape(
        3,
        "Notes box",
        "<p:spPr>" + _xfrm(1219200, 2286000, 6096000, 1828800) + '<a:prstGeom prst="rect"/></p:spPr>'
        '<p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:p><a:pPr algn="ctr"/>'
        '<a:r><a:rPr sz="2000" b="1"/><a:t>Bold </a:t></a:r>'
        '<a:r><a:rPr sz="2000" i="1" u="sng"><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></a:rPr><a:t>red</a:t></a:r>'
        '<a:r><a:rPr sz="2000"><a:hlinkClick r:id="rIdLink"/></a:rPr><a:t> link</a:t></a:r></a:p>'
        '<a:p><a:pPr lvl="0"><a:buChar char="-"/></a:pPr><a:r><a:rPr sz="2000"/><a:t>First</a:t></a:r></a:p>'
        '<a:p><a:pPr lvl="1"><a:buChar char="-"/></a:pPr><a:r><a:rPr sz="2000"/><a:t>Nested</a:t></a:r></a:p></p:txBody>',
    )
}
{
    _shape(
        4,
        "Card",
        "<p:spPr>"
        + _xfrm(7620000, 2286000, 3048000, 1524000)
        + '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 20000"/></a:avLst></a:prstGeom>'
        '<a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:ln w="25400"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr>'
        '<p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>'
        '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"/><a:t>On card</a:t></a:r></a:p></p:txBody>',
    )
}
{
    _shape(
        5,
        "Dot",
        "<p:spPr>"
        + _xfrm(7620000, 4114800, 914400, 914400, ' rot="2700000"')
        + '<a:prstGeom prst="ellipse"/><a:solidFill><a:srgbClr val="123456"><a:alpha val="50000"/></a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>',
    )
}
{
    _shape(
        6,
        "Star",
        "<p:spPr>"
        + _xfrm(9144000, 4114800, 914400, 914400)
        + '<a:prstGeom prst="star5"/><a:solidFill><a:srgbClr val="FFD700"/></a:solidFill></p:spPr>',
    )
}
<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="7" name="Arrow"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>{
    _xfrm(1219200, 4572000, 2438400, 0)
}<a:prstGeom prst="straightConnector1"/>
<a:ln w="38100"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>
<p:pic><p:nvPicPr><p:cNvPr id="8" name="Photo" descr="A blue picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rIdImg"/><a:srcRect l="10000" r="10000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr>{_xfrm(4000000, 4572000, 1828800, 914400)}<a:prstGeom prst="rect"/></p:spPr></p:pic>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="9" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
<p:xfrm><a:off x="1219200" y="5029200"/><a:ext cx="4876800" cy="914400"/></p:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/>
<a:tblGrid><a:gridCol w="3251200"/><a:gridCol w="1625600"/></a:tblGrid>
<a:tr h="457200">{_cell("Item", "DDDDDD")}{_cell("Value")}</a:tr><a:tr h="457200">{_cell("Users")}{
    _cell("1200")
}</a:tr>
</a:tbl></a:graphicData></a:graphic></p:graphicFrame>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="6096000" y="5029200"/><a:ext cx="1219200" cy="609600"/><a:chOff x="0" y="0"/><a:chExt cx="2438400" cy="1219200"/></a:xfrm></p:grpSpPr>
{
    _shape(
        11,
        "Inner",
        "<p:spPr>"
        + _xfrm(0, 0, 2438400, 1219200)
        + '<a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></p:spPr>',
    )
}
{
    _shape(
        12,
        "Inner 2",
        "<p:spPr>"
        + _xfrm(1219200, 609600, 1219200, 609600)
        + '<a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="FEDCBA"/></a:solidFill></p:spPr>',
    )
}
</p:grpSp>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="13" name="Sales"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
<p:xfrm><a:off x="8000000" y="300000"/><a:ext cx="3000000" cy="1500000"/></p:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic></p:graphicFrame>
</p:spTree></p:cSld></p:sld>"""

CHART = f"""<c:chartSpace {NS}><c:chart><c:plotArea><c:barChart><c:grouping val="stacked"/>
<c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>2026</c:v></c:pt></c:strCache></c:strRef></c:tx>
<c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>12</c:v></c:pt><c:pt idx="1"><c:v>30.5</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser>
</c:barChart></c:plotArea><c:legend/></c:chart></c:chartSpace>"""

NOTES = f"""<p:notes {NS}><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Image"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>
<p:txBody><a:bodyPr/><a:p><a:r><a:t>Say hello.</a:t></a:r></a:p><a:p><a:r><a:t>Then the numbers.</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:notes>"""

SECOND = f"""<p:sld {NS} show="0"><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
{_shape(2, "Box", "<p:spPr>" + _xfrm(0, 0, 9144000, 6858000) + '<a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill></p:spPr>')}
</p:spTree></p:cSld></p:sld>"""


def build_pptx(
    size: tuple[int, int] = WIDE, *, slide: str = SLIDE, extra: dict[str, bytes] | None = None
) -> bytes:
    parts: dict[str, str | bytes] = {
        "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        "ppt/presentation.xml": f'<p:presentation {NS}><p:sldMasterIdLst><p:sldMasterId id="1" r:id="rIdM"/></p:sldMasterIdLst>'
        '<p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst>'
        f'<p:sldSz cx="{size[0]}" cy="{size[1]}"/></p:presentation>',
        "ppt/_rels/presentation.xml.rels": _rels(
            ("rIdM", "slideMaster", "slideMasters/slideMaster1.xml"),
            ("rId1", "slide", "slides/slide1.xml"),
            ("rId2", "slide", "slides/slide2.xml"),
        ),
        "ppt/theme/theme1.xml": THEME,
        "ppt/slideMasters/slideMaster1.xml": MASTER,
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": _rels(("rId1", "theme", "../theme/theme1.xml")),
        "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": _rels(
            ("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")
        ),
        "ppt/slides/slide1.xml": slide,
        "ppt/slides/_rels/slide1.xml.rels": _rels(
            ("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"),
            ("rIdImg", "image", "../media/image1.png"),
            ("rIdLink", "hyperlink", "https://rodiumai.com"),
            ("rIdChart", "chart", "../charts/chart1.xml"),
            ("rIdNotes", "notesSlide", "../notesSlides/notesSlide1.xml"),
        ),
        "ppt/slides/slide2.xml": SECOND,
        "ppt/slides/_rels/slide2.xml.rels": _rels(
            ("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")
        ),
        "ppt/media/image1.png": _png(),
        "ppt/charts/chart1.xml": CHART,
        "ppt/notesSlides/notesSlide1.xml": NOTES,
    }
    parts.update(extra or {})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts.items():
            zf.writestr(name, data)
    return buf.getvalue()


def _convert(raw: bytes, canvas=(1920, 1080)):
    saved: list[str] = []

    def save(data: bytes, stem: str):
        Image.open(io.BytesIO(data)).verify()
        saved.append(stem)
        return {"path": f"public/images/imported/x/{stem}.webp", "width": 64, "height": 32}

    return convert_pptx(raw, canvas=canvas, save_image=save), saved


def _by_name(elements: list[dict], name: str) -> list[dict]:
    out = []
    for el in elements:
        if el.get("name") == name:
            out.append(el)
        if el["type"] == "group":
            out += _by_name(el["children"], name)
    return out


S = 1920 / 12192000  # EMU to px on a 16:9 canvas


def test_full_slide_converts_and_validates():
    result, saved = _convert(build_pptx())
    assert [s["index"] for s in result["slides"]] == [1, 2]
    first = result["slides"][0]
    slide = first["slide"]
    validate_slide(slide)
    assert first["title"] == "Bilan annuel"
    assert first["notes"] == "Say hello.\nThen the numbers."
    assert slide["background"] == {"type": "color", "token": "#FFF5E0"}
    assert saved == ["001-image1"]
    # The second slide is hidden and inherits the master background (bg2 -> lt2).
    second = result["slides"][1]
    assert second["hidden"] is True
    assert second["slide"]["background"] == {"type": "color", "token": "#EEEEEE"}
    assert second["warnings"] == {}


def test_master_decoration_and_layout_placeholder_inheritance():
    slide = _convert(build_pptx())[0]["slides"][0]["slide"]
    bar = _by_name(slide["elements"], "Brand bar")[0]
    assert bar["fill"] == "#FF0000" and bar["y"] == pytest.approx(6604000 * S, abs=0.2)
    # Painted under the slide's own shapes.
    assert bar["z"] == 1
    title = _by_name(slide["elements"], "Title 1")[0]
    # Position from the layout (zero insets there), size and colour from the master title style.
    assert (title["x"], title["y"]) == (
        pytest.approx(1219200 * S, abs=0.2),
        pytest.approx(685800 * S, abs=0.2),
    )
    assert title["w"] == pytest.approx(9753600 * S, abs=0.2)
    assert title["role"] == "title"
    assert title["style"]["size"] == pytest.approx(44 * EMU * S, abs=0.1)
    assert title["style"]["color"] == "#222244"
    assert title["style"]["weight"] == 700
    assert title["style"]["align"] == "center"
    assert title["style"]["valign"] == "bottom"
    assert title["style"]["font"] == "display"


def test_text_runs_bullets_and_theme_colour():
    slide = _convert(build_pptx())[0]["slides"][0]["slide"]
    box = _by_name(slide["elements"], "Notes box")[0]
    assert box["style"]["align"] == "center" and box["style"]["valign"] == "middle"
    assert box["style"]["size"] == pytest.approx(20 * EMU * S, abs=0.1)
    assert box["style"]["color"] == "#111111"
    first, bullets = box["content"]
    assert first["type"] == "paragraph"
    runs = first["runs"]
    assert runs[0] == {"text": "Bold ", "bold": True}
    # accent1 FF0000 with lumMod 50% is 800000.
    assert runs[1] == {"text": "red", "italic": True, "underline": True, "color": "#800000"}
    assert runs[2] == {"text": " link", "link": "https://rodiumai.com"}
    assert bullets == {"type": "bullet-list", "items": [{"text": "First"}, {"text": "Nested", "level": 1}]}


def test_shapes_lines_pictures_tables_groups_charts():
    result = _convert(build_pptx())[0]["slides"][0]
    slide, warnings = result["slide"], result["warnings"]
    card = _by_name(slide["elements"], "Card")
    shape, text = card
    assert shape["shape"] == "rect" and shape["fill"] == "#00AA00"
    assert shape["stroke"] == "#000000" and shape["strokeWidth"] == pytest.approx(25400 * S, abs=0.01)
    assert shape["radius"] == pytest.approx(1524000 * S * 0.2, abs=0.2)
    # Text colour from the shape style (fontRef lt1), not the master default.
    assert text["style"]["color"] == "#FAFAFA"

    dot = _by_name(slide["elements"], "Dot")[0]
    assert dot["shape"] == "ellipse" and dot["fill"] == "#12345680" and dot["rotation"] == 45
    assert "stroke" not in dot
    star = _by_name(slide["elements"], "Star")[0]
    assert star["shape"] == "rect" and warnings["shape_approximated"] == 1

    arrow = _by_name(slide["elements"], "Arrow")[0]
    assert arrow["shape"] == "arrow" and arrow["stroke"] == "#333333"
    assert arrow["w"] == pytest.approx(2438400 * S, abs=0.2)
    assert "rotation" not in arrow

    photo = _by_name(slide["elements"], "Photo")[0]
    assert photo["src"] == "public/images/imported/x/001-image1.webp"
    assert photo["crop"] == {"x": 0.1, "y": 0, "w": 0.8, "h": 1}
    assert photo["alt"] == "A blue picture"

    table = _by_name(slide["elements"], "Table")[0]
    assert table["headerRow"] is True
    assert table["rows"] == [[{"text": "Item"}, {"text": "Value"}], [{"text": "Users"}, {"text": "1200"}]]
    assert table["style"]["headerFill"] == "#DDDDDD"
    assert table["columnWidths"] == [pytest.approx(3251200 * S, abs=0.1), pytest.approx(1625600 * S, abs=0.1)]

    group = _by_name(slide["elements"], "Group")[0]
    assert group["type"] == "group" and group["w"] == pytest.approx(1219200 * S, abs=0.1)
    inner, inner2 = group["children"]
    # Children are scaled by ext/chExt (one half) and placed relative to the group.
    assert (inner["x"], inner["y"]) == (0, 0)
    assert inner["w"] == pytest.approx(1219200 * S, abs=0.1)
    assert inner2["x"] == pytest.approx(609600 * S, abs=0.1)

    chart = _by_name(slide["elements"], "Sales")[0]
    assert chart["chart"] == "bar"
    assert chart["data"] == {"labels": ["Q1", "Q2"], "series": [{"name": "2026", "values": [12, 30.5]}]}
    assert chart["options"] == {"stacked": True, "legend": True}


def test_other_ratio_is_fitted_and_centred():
    slide = _convert(build_pptx(size=(9144000, 6858000)))[0]["slides"][1]["slide"]
    box = slide["elements"][-1]
    # A 4:3 slide in a 16:9 canvas: full height, centred horizontally.
    assert (box["x"], box["y"], box["w"], box["h"]) == (240, 0, 1440, 1080)


def test_unknown_chart_becomes_a_placeholder():
    raw = build_pptx(
        extra={
            "ppt/charts/chart1.xml": f"<c:chartSpace {NS}><c:chart><c:plotArea/></c:chart></c:chartSpace>".encode()
        }
    )
    result = _convert(raw)[0]["slides"][0]
    chart = _by_name(result["slide"]["elements"], "Sales")[0]
    assert chart["type"] == "shape" and result["warnings"]["chart_placeholder"] == 1


def test_unsupported_picture_is_reported():
    raw = build_pptx(extra={"ppt/media/image1.png": b"not an image"})
    result, saved = _convert(raw)
    assert saved == []
    assert result["slides"][0]["warnings"]["picture_unsupported"] == 1
    assert not _by_name(result["slides"][0]["slide"]["elements"], "Photo")


# ── archive guards ──────────────────────────────────────────────────────────


def _code(raw: bytes) -> str:
    with pytest.raises(PptxError) as exc:
        _convert(raw)
    return exc.value.code


def test_not_a_zip_and_missing_parts():
    assert _code(b"plain text") == "PPTX_INVALID"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", "<x/>")
    assert _code(buf.getvalue()) == "PPTX_INVALID"


def test_password_protected_and_encrypted_entries():
    assert _code(archive._OLE_MAGIC + b"\x00" * 600) == "PPTX_ENCRYPTED"
    raw = bytearray(build_pptx())
    # Set the "encrypted" bit of the first entry in the central directory.
    at = raw.find(b"PK\x01\x02")
    raw[at + 8] |= 0x1
    assert _code(bytes(raw)) == "PPTX_ENCRYPTED"


def test_dtd_and_entities_are_refused():
    bomb = (
        '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><p:sld '
        + NS
        + "/>"
    )
    assert _code(build_pptx(slide=bomb)) == "PPTX_INVALID"
    # Same thing hidden in UTF-16.
    utf16 = (
        '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>'
    ).encode("utf-16")
    assert _code(build_pptx(extra={"ppt/slides/slide1.xml": utf16})) == "PPTX_INVALID"


def test_zip_bomb_entry_is_refused():
    # 4 MB of zeros deflate a thousand times: refused before being inflated.
    assert (
        _code(build_pptx(extra={"ppt/slides/slide1.xml": b"<" + b"\x00" * (4 * 1024 * 1024)}))
        == "PPTX_TOO_COMPLEX"
    )


def test_total_size_and_entry_count_limits(monkeypatch):
    monkeypatch.setattr(archive, "MAX_ENTRIES", 5)
    assert _code(build_pptx()) == "PPTX_TOO_COMPLEX"
    monkeypatch.setattr(archive, "MAX_ENTRIES", 4000)
    monkeypatch.setattr(archive, "MAX_TOTAL_UNCOMPRESSED", 2000)
    assert _code(build_pptx()) == "PPTX_TOO_COMPLEX"


def test_oversized_file_is_refused(monkeypatch):
    monkeypatch.setattr(archive, "MAX_PPTX_BYTES", 100)
    with pytest.raises(PptxError) as exc:
        _convert(build_pptx())
    assert exc.value.code == "PPTX_TOO_LARGE" and exc.value.status == 413


# ── route ───────────────────────────────────────────────────────────────────


@pytest.fixture
def client(monkeypatch, tmp_path_factory):
    """``client(role="owner", kind="slides")`` -> (TestClient, project id)."""

    def make(role: str = "owner", kind: str = "slides"):
        monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
        monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
        clear_settings_cache()
        owner_id, user_id = uuid.uuid4(), uuid.uuid4()
        project = SimpleNamespace(
            id=uuid.uuid4(), user_id=owner_id if role != "owner" else user_id, platform=kind
        )
        scaffold_slides(str(project.id), "Deck")

        def db_get(model, key):
            if model is Project:
                return project if str(key) == str(project.id) else None
            if model is ProjectCollaborator and role in ("editor", "viewer"):
                return SimpleNamespace(role=role, accepted_at=datetime.now(UTC))
            return None

        app = FastAPI()
        app.include_router(documents_mod.router)
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
        app.dependency_overrides[get_db] = lambda: SimpleNamespace(get=db_get)
        return TestClient(app), str(project.id)

    yield make
    clear_settings_cache()


def _upload(client: TestClient, pid: str, raw: bytes):
    files = {
        "file": (
            "deck.pptx",
            raw,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    }
    return client.post(f"/projects/{pid}/slides/import/pptx", files=files)


def test_route_converts_without_touching_the_deck(client):
    http, pid = client()
    root = get_settings().projects_path / pid
    before = (root / "deck.json").read_text(encoding="utf-8")
    r = _upload(http, pid, build_pptx())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["canvas"] == {"width": 1920, "height": 1080}
    assert len(body["slides"]) == 2
    photo = _by_name(body["slides"][0]["slide"]["elements"], "Photo")[0]
    assert photo["src"].startswith("public/images/imported/") and photo["src"].endswith(".webp")
    assert (root / photo["src"]).is_file()
    media = json.loads((root / ".forge" / "media.json").read_text(encoding="utf-8"))
    assert any(key.startswith("/images/imported/") for key in media)
    # Nothing is added to the deck: the editor inserts what the user picks.
    assert (root / "deck.json").read_text(encoding="utf-8") == before


def test_route_editor_allowed_viewer_refused(client):
    http, pid = client(role="editor")
    assert _upload(http, pid, build_pptx()).status_code == 200
    http, pid = client(role="viewer")
    assert _upload(http, pid, build_pptx()).status_code == 404
    http, pid = client(role="stranger")
    assert _upload(http, pid, build_pptx()).status_code == 404


def test_route_errors(client, monkeypatch):
    http, pid = client()
    r = _upload(http, pid, b"nope")
    assert r.status_code == 422 and r.json()["detail"]["code"] == "PPTX_INVALID"
    monkeypatch.setattr(documents_mod, "MAX_PPTX_BYTES", 50)
    r = _upload(http, pid, build_pptx())
    assert r.status_code == 413 and r.json()["detail"]["code"] == "PPTX_TOO_LARGE"
