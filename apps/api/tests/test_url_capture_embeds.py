"""Skip third-party embed pastes for auto URL capture (Tally, widgets, …)."""

from __future__ import annotations

from app.services import url_capture

_TALLY_PROMPT = """en bas tu peux integrer tally avec ces script
<iframe data-tally-src="https://tally.so/embed/68qOQP?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1" loading="lazy" width="100%" height="552" frameborder="0" marginheight="0" marginwidth="0" title="Call me back"></iframe>
<script>var d=document,w="https://tally.so/widgets/embed.js",v=function(){"undefined"!=typeof Tally?Tally.loadEmbeds():d.querySelectorAll("iframe[data-tally-src]:not([src])").forEach((function(e){e.src=e.dataset.tallySrc}))};if("undefined"!=typeof Tally)v();else if(d.querySelector('script[src="'+w+'"]')==null){var s=d.createElement("script");s.src=w,s.onload=v,s.onerror=v,d.body.appendChild(s);}</script>

Et donc on pourra avoir le formulaire"""


def test_extract_site_urls_skips_embed_and_widget_assets():
    text = (
        "clone https://example.com/pricing and also "
        "https://tally.so/embed/68qOQP?x=1 "
        "https://tally.so/widgets/embed.js "
        "https://cdn.example.com/app.js"
    )
    assert url_capture.extract_site_urls(text) == ["https://example.com/pricing"]


def test_tally_prompt_is_embed_snippet_and_needs_no_capture():
    assert url_capture.looks_like_third_party_embed_snippet(_TALLY_PROMPT)
    assert url_capture.site_url_needing_capture(_TALLY_PROMPT) is None


def test_plain_site_url_still_needs_capture():
    prompt = "Reproduis ce site https://mapoche.example/landing en landing page"
    assert not url_capture.looks_like_third_party_embed_snippet(prompt)
    assert url_capture.site_url_needing_capture(prompt) == "https://mapoche.example/landing"


def test_strip_auto_url_capture_markers_keeps_user_refs():
    poisoned = (
        _TALLY_PROMPT
        + "\n\n[Files: url-capture-tally.so-desktop.png, url-capture-tally.so-mobile.png]\n"
        + "[Reference screenshot: url-capture-tally.so-desktop.png | url:/images/url-capture-tally.so-desktop.png | intent:reference]\n"
        + "[Reference screenshot: url-capture-tally.so-mobile.png | url:/images/url-capture-tally.so-mobile.png | intent:reference]\n"
        + "[Reference screenshot: moodboard.png | url:/images/moodboard.png | intent:reference]"
    )
    cleaned = url_capture.strip_auto_url_capture_markers(poisoned)
    assert "url-capture-tally" not in cleaned
    assert "moodboard.png" in cleaned
    assert "data-tally-src" in cleaned
    assert url_capture.looks_like_third_party_embed_snippet(cleaned)


def test_enrich_embed_snippet_strips_without_capture(monkeypatch):
    async def _boom(**_kwargs):
        raise AssertionError("capture must not run for embed snippets")

    monkeypatch.setattr(url_capture, "capture_site_screenshots", _boom)
    poisoned = (
        _TALLY_PROMPT
        + "\n\n[Files: url-capture-tally.so-desktop.png, url-capture-tally.so-mobile.png]\n"
        + "[Reference screenshot: url-capture-tally.so-desktop.png | url:/images/x.png | intent:reference]\n"
        + "[Reference screenshot: url-capture-tally.so-mobile.png | url:/images/y.png | intent:reference]"
    )

    import asyncio

    out = asyncio.run(
        url_capture.enrich_prompt_with_site_url_captures(
            project_id="proj",
            user_content=poisoned,
            locale="fr",
        )
    )
    assert "url-capture-tally" not in out
    assert "data-tally-src" in out
