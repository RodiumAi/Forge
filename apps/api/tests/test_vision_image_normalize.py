"""Vision reference screenshots are compressed before base64 embedding."""

from io import BytesIO

from PIL import Image

from app.services.attachments import MAX_VISION_BINARY_BYTES, normalize_vision_image


def _png_bytes(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color=(120, 40, 200))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_normalize_vision_image_downscales_tall_mockup():
    body = _png_bytes(1400, 12000)
    out, ctype = normalize_vision_image(body, "image/png")
    assert ctype == "image/jpeg"
    assert len(out) <= MAX_VISION_BINARY_BYTES
    with Image.open(BytesIO(out)) as img:
        assert max(img.size) <= 1920


def test_normalize_vision_image_keeps_small_png():
    body = _png_bytes(400, 300)
    out, ctype = normalize_vision_image(body, "image/png")
    assert out == body
    assert ctype == "image/png"
