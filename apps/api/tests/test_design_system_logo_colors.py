"""The logo's real colours drive the palette, not the model's guess."""

from __future__ import annotations

import io

from PIL import Image

from app.services.design_system.logo_colors import align_palette, measure_logo_colors


def _logo() -> bytes:
    """Four bars on a transparent canvas, the largest one mint."""
    image = Image.new("RGBA", (200, 100), (0, 0, 0, 0))
    for x, colour, height in (
        (0, (50, 90, 180, 255), 70),
        (50, (60, 140, 255, 255), 50),
        (100, (0, 200, 210, 255), 40),
        (150, (120, 230, 220, 255), 100),
    ):
        for dx in range(40):
            for y in range(height):
                image.putpixel((x + dx, y), colour)
    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue()


def test_measures_the_logo_colours_by_area():
    assert measure_logo_colors(_logo()) == ["#78e6dc", "#325ab4", "#3c8cff", "#00c8d2"]


def test_ignores_a_white_canvas_and_unreadable_files():
    image = Image.new("RGB", (40, 40), (255, 255, 255))
    out = io.BytesIO()
    image.save(out, "PNG")
    assert measure_logo_colors(out.getvalue()) == []
    assert measure_logo_colors(b"not an image") == []


def test_brings_accent_and_secondary_back_on_the_logo():
    logo = ["#78e6dc", "#325ab4", "#00c8d2", "#3c8cff"]
    colors = align_palette(
        {"bg": "#ffffff", "fg": "#101014", "accent": "#23439c", "secondary": "#0b8f6a"}, logo
    )
    # The accent reads best on white among the logo colours; the invented green is gone.
    assert colors["accent"] == "#325ab4"
    assert colors["secondary"] == "#78e6dc"
    assert [colors[f"brand-{i}"] for i in range(1, 5)] == logo


def test_keeps_a_palette_already_on_the_logo():
    logo = ["#325ab4", "#00c8d2"]
    colors = align_palette(
        {"bg": "#ffffff", "fg": "#000000", "accent": "#00c8d2", "secondary": "#325ab4"}, logo
    )
    assert colors["accent"] == "#00c8d2" and colors["secondary"] == "#325ab4"
