"""The Pydantic contracts must agree with the shared JSON Schemas.

``contracts/forge-design/`` holds the schemas and the fixtures. The web suite
(``apps/web/lib/contracts/forge-design.test.ts``) replays the same fixtures
through Ajv and Zod, so a change on one side without the other fails CI.
"""

from __future__ import annotations

import json
import typing
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from app.contracts import forge_design as fd

ROOT = Path(__file__).resolve().parents[3] / "contracts" / "forge-design"
FIXTURES = ROOT / "fixtures"

SCHEMA_FILES = {
    "deck": "deck.schema.json",
    "slide": "slide.schema.json",
    "codelab": "codelab.schema.json",
    "design-system": "design-system.schema.json",
}
VALIDATE = {
    "deck": fd.validate_deck,
    "slide": fd.validate_slide,
    "codelab": fd.validate_codelab,
    "design-system": fd.validate_design_system,
}


def _schema(name: str) -> dict:
    return json.loads((ROOT / SCHEMA_FILES[name]).read_text(encoding="utf-8"))


def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(_schema(name))


def _fixtures(group: str) -> list[tuple[str, str, dict]]:
    out = []
    for path in sorted((FIXTURES / group).glob("*.json")):
        kind = path.name.split(".", 1)[0]
        out.append((kind, path.name, json.loads(path.read_text(encoding="utf-8"))))
    return out


def _ids(cases):
    return [case[1] for case in cases]


@pytest.mark.parametrize("name", sorted(SCHEMA_FILES))
def test_schemas_are_valid_json_schema(name):
    Draft202012Validator.check_schema(_schema(name))


VALID = _fixtures("valid")
INVALID = _fixtures("invalid")
SEMANTIC = _fixtures("invalid-semantic")


def test_every_kind_has_fixtures():
    kinds = {case[0] for case in VALID}
    assert kinds == set(SCHEMA_FILES)
    assert INVALID and SEMANTIC


@pytest.mark.parametrize(("kind", "name", "doc"), VALID, ids=_ids(VALID))
def test_valid_fixture_passes_schema_and_model(kind, name, doc):
    errors = list(_validator(kind).iter_errors(doc))
    assert not errors, [e.message for e in errors]
    VALIDATE[kind](doc)


@pytest.mark.parametrize(("kind", "name", "doc"), INVALID, ids=_ids(INVALID))
def test_invalid_fixture_fails_schema_and_model(kind, name, doc):
    assert list(_validator(kind).iter_errors(doc)), f"{name} should fail the JSON Schema"
    with pytest.raises(ValidationError):
        VALIDATE[kind](doc)


@pytest.mark.parametrize(("kind", "name", "doc"), SEMANTIC, ids=_ids(SEMANTIC))
def test_semantic_fixture_fails_model_only(kind, name, doc):
    # These rules (unique ids, depth) are beyond JSON Schema: the schema lets
    # them through and the model must catch them.
    assert not list(_validator(kind).iter_errors(doc)), f"{name} should pass the JSON Schema"
    with pytest.raises(ValidationError):
        VALIDATE[kind](doc)


def _resolve(schema: dict, pointer: str):
    node = schema
    for part in pointer.strip("/").split("/"):
        node = node[part]
    return node


ENUMS = [
    ("deck", "$defs/transition/properties/type/enum", fd.TransitionType),
    ("deck", "$defs/transition/properties/direction/enum", fd.Direction),
    ("deck", "$defs/transition/properties/easing/enum", fd.Easing),
    ("slide", "$defs/animation/properties/type/enum", fd.AnimationType),
    ("slide", "$defs/animation/properties/trigger/enum", fd.AnimationTrigger),
    ("slide", "$defs/animation/properties/direction/enum", fd.Direction),
    ("slide", "$defs/credit/properties/source/enum", fd.CreditSource),
    ("slide", "$defs/textStyle/properties/font/enum", fd.FontRole),
    ("slide", "$defs/textStyle/properties/align/enum", fd.TextAlign),
    ("slide", "$defs/textStyle/properties/valign/enum", fd.VerticalAlign),
    ("slide", "$defs/textElement/properties/role/enum", fd.TextRole),
    ("slide", "$defs/imageElement/properties/fit/enum", fd.ImageFit),
    ("slide", "$defs/shapeElement/properties/shape/enum", fd.ShapeKind),
    ("slide", "$defs/chartElement/properties/chart/enum", fd.ChartKind),
    ("codelab", "properties/level/enum", fd.CodelabLevel),
    ("design-system", "$defs/tokenType/enum", fd.TokenType),
    ("design-system", "properties/components/items/enum", fd.ShowcaseComponent),
]


@pytest.mark.parametrize(("kind", "pointer", "literal"), ENUMS, ids=[f"{k}:{p}" for k, p, _ in ENUMS])
def test_enums_match_schema(kind, pointer, literal):
    assert list(_resolve(_schema(kind), pointer)) == list(typing.get_args(literal))


def test_element_types_match_schema():
    schema = _schema("slide")
    consts = [
        schema["$defs"][ref["$ref"].rsplit("/", 1)[1]]["properties"]["type"]["const"]
        for ref in schema["$defs"]["element"]["oneOf"]
    ]
    assert consts == list(typing.get_args(fd.ElementType))


def test_formats_match_schema():
    variants = _schema("deck")["$defs"]["format"]["oneOf"]
    sizes = {
        v["properties"]["ratio"]["const"]: (
            v["properties"]["width"]["const"],
            v["properties"]["height"]["const"],
        )
        for v in variants
    }
    assert sizes == fd.FORMAT_SIZES
    assert list(sizes) == list(typing.get_args(fd.DeckRatio))


def _patterns(node, out: set[str]) -> set[str]:
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "pattern" and isinstance(value, str):
                out.add(value)
            elif key == "patternProperties":
                out.update(value)
                _patterns(list(value.values()), out)
            else:
                _patterns(value, out)
    elif isinstance(node, list):
        for item in node:
            _patterns(item, out)
    return out


def test_every_schema_pattern_is_mirrored():
    model_patterns = {
        value for name, value in vars(fd).items() if name.endswith("_PATTERN") and isinstance(value, str)
    }
    for name in SCHEMA_FILES:
        missing = _patterns(_schema(name), set()) - model_patterns
        assert not missing, f"{name}: patterns without a model counterpart {missing}"


def test_dump_keeps_integers_and_drops_absent_fields():
    doc = json.loads((FIXTURES / "valid" / "slide.minimal.json").read_text(encoding="utf-8"))
    dumped = fd.dump_document(fd.validate_slide(doc))
    assert dumped == doc
    assert isinstance(dumped["elements"][0]["x"], int)
