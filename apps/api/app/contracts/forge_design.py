"""Pydantic mirror of ``contracts/forge-design/*.schema.json`` (version 1).

Keep every enum, bound and pattern identical to the JSON Schema: the contract
tests compare the two and replay the shared fixtures through both. The models
also enforce what JSON Schema cannot express (unique ids, group depth).

Field names are the camelCase keys of the documents on purpose, so a document
round-trips through ``dump_document`` without any renaming.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
COLOR_PATTERN = r"^(--[A-Za-z0-9-]{1,48}|#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8}))$"
ASSET_PATTERN = r"^(?!.*\.\.)(?!/)[A-Za-z0-9_./-]+$"
HTTPS_PATTERN = r"^https://"
LAYOUT_PATTERN = r"^[a-z0-9][a-z0-9-]{0,47}$"
STEP_FILE_PATTERN = r"^steps/[0-9]{2,3}-[a-z0-9]+(-[a-z0-9]+)*\.md$"
DOWNLOAD_PATH_PATTERN = r"^files/(?!.*\.\.)[A-Za-z0-9_./-]+$"
ICON_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"
LANGUAGE_PATTERN = r"^[a-z0-9+#-]{1,32}$"
HIGHLIGHT_PATTERN = r"^[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*$"

#: Deepest allowed nesting of `group` elements in a slide.
MAX_GROUP_DEPTH = 4
#: Deepest allowed nesting of token groups in a design system.
MAX_TOKEN_DEPTH = 8

Id = Annotated[str, Field(pattern=ID_PATTERN)]
ColorRef = Annotated[str, Field(pattern=COLOR_PATTERN)]
AssetPath = Annotated[str, Field(min_length=1, max_length=400, pattern=ASSET_PATTERN)]
HttpsUrl = Annotated[str, Field(max_length=2000, pattern=HTTPS_PATTERN)]
Coord = Annotated[float, Field(ge=-10000, le=10000)]
Size = Annotated[float, Field(gt=0, le=10000)]
Unit = Annotated[float, Field(ge=0, le=1)]

DeckRatio = Literal["16:9", "4:3", "1:1"]
TransitionType = Literal[
    "none",
    "fade",
    "push",
    "slide",
    "wipe",
    "zoom-in",
    "zoom-out",
    "dissolve",
    "curtain",
    "cube",
    "morph",
]
Direction = Literal["left", "right", "up", "down"]
Easing = Literal["linear", "ease", "ease-in", "ease-out", "ease-in-out"]
AnimationType = Literal[
    "appear",
    "rise",
    "drop",
    "slide",
    "pop",
    "zoom",
    "typewriter",
    "mask-reveal",
    "bounce",
    "pulse",
]
AnimationTrigger = Literal["on-enter", "on-click", "after-previous"]
ElementType = Literal["text", "image", "shape", "icon", "table", "chart", "video", "code", "group"]
TextRole = Literal["title", "subtitle", "heading", "body", "caption", "quote", "label"]
FontRole = Literal["display", "body", "mono"]
TextAlign = Literal["left", "center", "right", "justify"]
VerticalAlign = Literal["top", "middle", "bottom"]
ImageFit = Literal["cover", "contain", "fill"]
CreditSource = Literal["pixabay", "openverse", "upload", "generated", "other"]
ShapeKind = Literal["rect", "ellipse", "line", "arrow"]
ChartKind = Literal["bar", "line", "pie"]
CodelabLevel = Literal["beginner", "intermediate", "advanced"]
TokenType = Literal[
    "color",
    "dimension",
    "fontFamily",
    "fontWeight",
    "duration",
    "cubicBezier",
    "number",
    "shadow",
    "border",
    "gradient",
    "typography",
    "transition",
    "strokeStyle",
]
ShowcaseComponent = Literal["button", "input", "card", "badge", "alert", "table"]

#: Canvas size of each deck format.
FORMAT_SIZES: dict[str, tuple[int, int]] = {"16:9": (1920, 1080), "4:3": (1440, 1080), "1:1": (1080, 1080)}


class _Doc(BaseModel):
    # strict: "5" is not 5 and true is not 1, same as JSON Schema.
    # python-re: the path patterns use lookaheads the default engine refuses.
    model_config = ConfigDict(extra="forbid", strict=True, regex_engine="python-re")

    @model_validator(mode="before")
    @classmethod
    def _no_nulls(cls, data: Any) -> Any:
        # Optional fields are absent, never null: JSON Schema refuses null.
        if isinstance(data, dict):
            for key, value in data.items():
                if value is None:
                    raise ValueError(f"{key} must not be null")
        return data


# ── deck.json ──────────────────────────────────────────────────────────────


class Format169(_Doc):
    ratio: Literal["16:9"]
    width: Literal[1920]
    height: Literal[1080]


class Format43(_Doc):
    ratio: Literal["4:3"]
    width: Literal[1440]
    height: Literal[1080]


class Format11(_Doc):
    ratio: Literal["1:1"]
    width: Literal[1080]
    height: Literal[1080]


Format = Annotated[Format169 | Format43 | Format11, Field(discriminator="ratio")]


class Theme(_Doc):
    designSystem: str = Field(min_length=1, max_length=64)
    tokens: str = Field(min_length=1, max_length=200)


class Transition(_Doc):
    type: TransitionType
    durationMs: int | None = Field(default=None, ge=0, le=5000)
    direction: Direction | None = None
    easing: Easing | None = None


class SlideRef(_Doc):
    id: Id
    layout: str = Field(pattern=LAYOUT_PATTERN)
    transition: Transition | None = None
    hidden: bool | None = None


class Deck(_Doc):
    version: Literal[1]
    title: str | None = Field(default=None, max_length=200)
    format: Format
    theme: Theme
    slides: list[SlideRef] = Field(max_length=500)

    @model_validator(mode="after")
    def _unique_slide_ids(self) -> Deck:
        _ensure_unique((ref.id for ref in self.slides), "slide id")
        return self


# ── slides/<id>.json ───────────────────────────────────────────────────────


class ColorBackground(_Doc):
    type: Literal["color"]
    token: ColorRef


class Credit(_Doc):
    source: CreditSource
    author: str | None = Field(default=None, max_length=200)
    url: HttpsUrl | None = None


class ImageBackground(_Doc):
    type: Literal["image"]
    src: AssetPath
    fit: ImageFit | None = None
    overlay: ColorRef | None = None
    overlayOpacity: Unit | None = None
    credit: Credit | None = None


class GradientStop(_Doc):
    color: ColorRef
    at: Unit


class GradientBackground(_Doc):
    type: Literal["gradient"]
    angle: float | None = Field(default=None, ge=0, le=360)
    stops: list[GradientStop] = Field(min_length=2, max_length=8)


Background = Annotated[
    ColorBackground | ImageBackground | GradientBackground,
    Field(discriminator="type"),
]


class Animation(_Doc):
    type: AnimationType
    trigger: AnimationTrigger
    delayMs: int | None = Field(default=None, ge=0, le=10000)
    durationMs: int | None = Field(default=None, ge=0, le=10000)
    direction: Direction | None = None
    order: int | None = Field(default=None, ge=0, le=999)


class Run(_Doc):
    text: str = Field(max_length=5000)
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    link: HttpsUrl | None = None
    color: ColorRef | None = None


class Inline(_Doc):
    text: str | None = Field(default=None, max_length=5000)
    runs: list[Run] | None = Field(default=None, max_length=100)


class Paragraph(Inline):
    type: Literal["paragraph"]


class ListItem(Inline):
    level: int | None = Field(default=None, ge=0, le=4)


class TextList(_Doc):
    type: Literal["bullet-list", "ordered-list"]
    items: list[ListItem] = Field(max_length=50)


TextBlock = Annotated[Paragraph | TextList, Field(discriminator="type")]


class TextStyle(_Doc):
    font: FontRole | None = None
    size: float | None = Field(default=None, ge=6, le=400)
    weight: int | None = Field(default=None, ge=100, le=900)
    color: ColorRef | None = None
    align: TextAlign | None = None
    valign: VerticalAlign | None = None
    lineHeight: float | None = Field(default=None, ge=0.5, le=4)
    letterSpacing: float | None = Field(default=None, ge=-20, le=100)
    italic: bool | None = None
    underline: bool | None = None
    uppercase: bool | None = None


class _ElementBase(_Doc):
    id: Id
    name: str | None = Field(default=None, max_length=120)
    x: Coord
    y: Coord
    w: Size
    h: Size
    rotation: float | None = Field(default=None, ge=-360, le=360)
    z: int | None = Field(default=None, ge=0, le=10000)
    opacity: Unit | None = None
    locked: bool | None = None
    hidden: bool | None = None
    matchKey: str | None = Field(default=None, pattern=ID_PATTERN)
    link: HttpsUrl | None = None
    animation: Animation | None = None


class TextElement(_ElementBase):
    type: Literal["text"]
    role: TextRole | None = None
    content: list[TextBlock] = Field(max_length=50)
    style: TextStyle | None = None


class ImageCrop(_Doc):
    x: Unit
    y: Unit
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class ImageElement(_ElementBase):
    type: Literal["image"]
    src: AssetPath
    alt: str | None = Field(default=None, max_length=300)
    fit: ImageFit | None = None
    radius: float | None = Field(default=None, ge=0, le=2000)
    crop: ImageCrop | None = None
    credit: Credit | None = None


class ShapeElement(_ElementBase):
    type: Literal["shape"]
    shape: ShapeKind
    fill: ColorRef | None = None
    stroke: ColorRef | None = None
    strokeWidth: float | None = Field(default=None, ge=0, le=200)
    radius: float | None = Field(default=None, ge=0, le=2000)


class IconElement(_ElementBase):
    type: Literal["icon"]
    icon: str = Field(max_length=64, pattern=ICON_PATTERN)
    color: ColorRef | None = None
    strokeWidth: float | None = Field(default=None, ge=0.5, le=4)


class TableStyle(_Doc):
    size: float | None = Field(default=None, ge=6, le=200)
    color: ColorRef | None = None
    headerFill: ColorRef | None = None
    border: ColorRef | None = None


class TableElement(_ElementBase):
    type: Literal["table"]
    rows: list[Annotated[list[Inline], Field(min_length=1, max_length=20)]] = Field(
        min_length=1, max_length=50
    )
    headerRow: bool | None = None
    columnWidths: list[Annotated[float, Field(gt=0)]] | None = Field(default=None, max_length=20)
    style: TableStyle | None = None


class ChartSeries(_Doc):
    name: str = Field(max_length=120)
    values: list[float] = Field(max_length=100)
    color: ColorRef | None = None


class ChartData(_Doc):
    labels: list[Annotated[str, Field(max_length=120)]] = Field(max_length=100)
    series: list[ChartSeries] = Field(min_length=1, max_length=12)


class ChartOptions(_Doc):
    stacked: bool | None = None
    legend: bool | None = None
    values: bool | None = None


class ChartElement(_ElementBase):
    type: Literal["chart"]
    chart: ChartKind
    data: ChartData
    options: ChartOptions | None = None


class VideoElement(_ElementBase):
    type: Literal["video"]
    url: HttpsUrl
    poster: AssetPath | None = None
    autoplay: bool | None = None
    muted: bool | None = None


class CodeElement(_ElementBase):
    type: Literal["code"]
    language: str | None = Field(default=None, pattern=LANGUAGE_PATTERN)
    code: str = Field(max_length=20000)
    lineNumbers: bool | None = None
    highlight: str | None = Field(default=None, pattern=HIGHLIGHT_PATTERN)
    size: float | None = Field(default=None, ge=6, le=200)


class GroupElement(_ElementBase):
    type: Literal["group"]
    children: list[Element] = Field(min_length=1, max_length=100)


Element = Annotated[
    TextElement
    | ImageElement
    | ShapeElement
    | IconElement
    | TableElement
    | ChartElement
    | VideoElement
    | CodeElement
    | GroupElement,
    Field(discriminator="type"),
]

GroupElement.model_rebuild()


class Slide(_Doc):
    id: Id
    background: Background | None = None
    elements: list[Element] = Field(max_length=200)

    @model_validator(mode="after")
    def _ids_and_depth(self) -> Slide:
        ids: list[str] = []

        def walk(elements: list, depth: int) -> None:
            for element in elements:
                ids.append(element.id)
                if isinstance(element, GroupElement):
                    if depth + 1 > MAX_GROUP_DEPTH:
                        raise ValueError(f"groups nest at most {MAX_GROUP_DEPTH} levels deep")
                    walk(element.children, depth + 1)

        walk(self.elements, 0)
        _ensure_unique(ids, "element id")
        return self


# ── codelab.json ───────────────────────────────────────────────────────────


class Author(_Doc):
    name: str = Field(min_length=1, max_length=120)
    url: HttpsUrl | None = None


class CodelabStep(_Doc):
    id: Id
    title: str | None = Field(default=None, max_length=200)
    file: str = Field(pattern=STEP_FILE_PATTERN)
    minutes: int = Field(ge=0, le=600)


class CodelabDownload(_Doc):
    id: Id
    label: str = Field(min_length=1, max_length=120)
    path: str = Field(max_length=300, pattern=DOWNLOAD_PATH_PATTERN)
    zip: bool | None = None


Line300 = Annotated[str, Field(min_length=1, max_length=300)]


class Codelab(_Doc):
    version: Literal[1]
    title: str = Field(min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)
    level: CodelabLevel
    durationMinutes: int = Field(ge=0, le=6000)
    prerequisites: list[Line300] | None = Field(default=None, max_length=30)
    learn: list[Line300] | None = Field(default=None, max_length=30)
    author: Author | None = None
    repoUrl: HttpsUrl | None = None
    theme: Theme | None = None
    steps: list[CodelabStep] = Field(max_length=200)
    downloads: list[CodelabDownload] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def _unique(self) -> Codelab:
        _ensure_unique((step.id for step in self.steps), "step id")
        _ensure_unique((step.file for step in self.steps), "step file")
        _ensure_unique((item.id for item in self.downloads or []), "download id")
        return self


# ── design-system.json ─────────────────────────────────────────────────────

_NAME_RE = re.compile(ID_PATTERN)
_TOKEN_TYPES = frozenset(TokenType.__args__)
_TOKEN_KEYS = frozenset({"$value", "$type", "$description", "$extensions"})

Line400 = Annotated[str, Field(min_length=1, max_length=400)]
Lines = Annotated[list[Line400], Field(max_length=40)]


class Logo(_Doc):
    src: AssetPath
    darkSrc: AssetPath | None = None
    minSizePx: int | None = Field(default=None, ge=8, le=2000)
    clearSpace: str | None = Field(default=None, max_length=200)
    usage: Lines | None = None


class Guidance(_Doc):
    summary: str | None = Field(default=None, max_length=2000)
    do: Lines | None = None
    dont: Lines | None = None


def _check_token(token: dict, path: str) -> None:
    unknown = set(token) - _TOKEN_KEYS
    if unknown:
        raise ValueError(f"{path}: unknown token keys {sorted(unknown)}")
    value = token["$value"]
    if isinstance(value, bool) or not isinstance(value, (str, int, float, list, dict)):
        raise ValueError(f"{path}: $value must be a string, number, array or object")
    _check_meta(token, path)
    if "$extensions" in token and not isinstance(token["$extensions"], dict):
        raise ValueError(f"{path}: $extensions must be an object")


def _check_meta(node: dict, path: str) -> None:
    if "$type" in node and node["$type"] not in _TOKEN_TYPES:
        raise ValueError(f"{path}: unknown $type {node['$type']!r}")
    if "$description" in node:
        desc = node["$description"]
        if not isinstance(desc, str) or len(desc) > 500:
            raise ValueError(f"{path}: $description must be a string of at most 500 characters")


def _check_group(group: Any, path: str, depth: int) -> None:
    if not isinstance(group, dict):
        raise ValueError(f"{path}: a token group must be an object")
    if "$value" in group:
        raise ValueError(f"{path}: a group cannot carry $value")
    if depth > MAX_TOKEN_DEPTH:
        raise ValueError(f"{path}: token groups nest at most {MAX_TOKEN_DEPTH} levels deep")
    _check_meta(group, path)
    for key, child in group.items():
        if key in ("$type", "$description"):
            continue
        if not _NAME_RE.match(key):
            raise ValueError(f"{path}: invalid token name {key!r}")
        child_path = f"{path}.{key}" if path else key
        if isinstance(child, dict) and "$value" in child:
            _check_token(child, child_path)
        else:
            _check_group(child, child_path, depth + 1)


class DesignSystem(_Doc):
    version: Literal[1]
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    tokens: dict[str, Any]
    logo: Logo | None = None
    voice: Guidance | None = None
    imagery: Guidance | None = None
    guidelines: Guidance | None = None
    components: list[ShowcaseComponent] | None = Field(default=None, max_length=20)

    @field_validator("tokens")
    @classmethod
    def _w3c_tokens(cls, tokens: dict[str, Any]) -> dict[str, Any]:
        _check_group(tokens, "", 0)
        for required in ("color", "font"):
            if required not in tokens:
                raise ValueError(f"tokens.{required} is required")
        return tokens


# ── helpers ────────────────────────────────────────────────────────────────


def _ensure_unique(values, label: str) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise ValueError(f"duplicate {label} {value!r}")
        seen.add(value)


def validate_deck(data: Any) -> Deck:
    return Deck.model_validate(data)


def validate_slide(data: Any) -> Slide:
    return Slide.model_validate(data)


def validate_codelab(data: Any) -> Codelab:
    return Codelab.model_validate(data)


def validate_design_system(data: Any) -> DesignSystem:
    return DesignSystem.model_validate(data)


def _whole_numbers(value: Any) -> Any:
    # Number fields are floats in the models; 160 must not come back as 160.0.
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {key: _whole_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_whole_numbers(item) for item in value]
    return value


def dump_document(model: BaseModel) -> dict[str, Any]:
    """The JSON document for a validated model (absent fields stay absent)."""
    return _whole_numbers(model.model_dump(mode="json", exclude_none=True))
