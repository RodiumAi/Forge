from app.services.design_colors import (
    merge_palettes,
    normalize_hex,
    parse_palette,
    replace_token_hex,
)


def test_normalize_hex_expands_short():
    assert normalize_hex("#abc") == "#aabbcc"
    assert normalize_hex("#AABBCC") == "#aabbcc"


def test_replace_token_hex_updates_aliases():
    src = "--accent: #7c3aed;\n--color-accent: #7c3aed;"
    assert replace_token_hex(src, "accent", "#ff5500") == (
        "--accent: #ff5500;\n--color-accent: #ff5500;"
    )


def test_parse_and_merge_palette():
    md = parse_palette("--bg: #111111\n--accent: #222222")
    css = parse_palette(":root { --color-accent: #222222; --muted: #333333; }")
    merged = merge_palettes(md, css)
    names = [e.name for e in merged]
    assert "bg" in names
    assert "accent" in names
    assert "muted" in names
    assert "color-accent" not in names
