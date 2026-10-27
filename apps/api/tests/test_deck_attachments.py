"""Images attached to a deck chat message: marker parsing and placement."""

from __future__ import annotations

import asyncio

from app.services.deck_ai import attachments
from app.services.deck_ai.targeting import Visual
from app.services.deck_ai.visuals import fill_visual
from app.services.filesystem import safe_resolve


def _put(project: str, path: str) -> None:
    target = safe_resolve(project, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"x")


def test_image_paths_reads_the_marker_in_order_without_duplicates():
    prompt = "Une deck sur Lomé\n\n[Images: public/images/a.webp, public/images/b.png, public/images/a.webp]"
    assert attachments.image_paths(prompt) == ["public/images/a.webp", "public/images/b.png"]
    assert attachments.strip_markers(prompt) == "Une deck sur Lomé"


def test_image_paths_rejects_paths_outside_public():
    prompt = "[Images: ../secret.png, src/app.webp, public/../x.png, public/ok.jpg]"
    assert attachments.image_paths(prompt) == ["public/ok.jpg"]


def test_existing_images_keeps_only_files_in_the_project(project):
    _put(project, "public/images/a.webp")
    prompt = "[Images: public/images/a.webp, public/images/missing.webp]"
    assert attachments.existing_images(project, prompt) == ["public/images/a.webp"]


def test_describe_is_empty_without_images():
    assert attachments.describe([]) == ""
    assert attachments.describe_for_edit([]) == ""
    assert "2 image" in attachments.describe(["public/a.webp", "public/b.webp"])


def test_fill_visual_uses_the_attached_image_before_stock(project):
    slide = {
        "id": "s1",
        "elements": [{"id": "img", "type": "image", "src": "", "x": 0, "y": 0, "w": 400, "h": 300}],
    }
    outcome = asyncio.run(
        fill_visual(
            project_id=project,
            slide=slide,
            visual=Visual(query="Lomé skyline", element_id="img"),
            user_image="public/images/a.webp",
        )
    )
    element = outcome.slide["elements"][0]
    assert outcome.source == "upload"
    assert element["src"] == "public/images/a.webp"
    assert element["credit"] == {"source": "upload"}


# ── imported documents (PDF, PowerPoint) ───────────────────────────────────

PPTX_TEXT = (
    "--- Slide 1 ---\nTitle: Bilan 2026\n- Ventes +12 %\n\n--- Slide 2 ---\nTitle: Suite\nNotes: Conclure"
)


def _doc_prompt() -> str:
    return (
        "Mets à jour le titre\n\n"
        "[Document: bilan.pptx | pptx]\n" + PPTX_TEXT + "\n[/Document]\n\n"
        "[Document: annexe.pdf | pdf | truncated]\nChiffres clés du rapport\n[/Document]\n\n"
        "[Images: public/images/a.webp]"
    )


def test_documents_are_read_in_order_and_stripped_from_the_request():
    prompt = _doc_prompt()
    docs = attachments.documents(prompt)
    assert [(d.name, d.kind, d.truncated) for d in docs] == [
        ("bilan.pptx", "pptx", False),
        ("annexe.pdf", "pdf", True),
    ]
    assert docs[0].text == PPTX_TEXT
    assert attachments.strip_markers(prompt) == "Mets à jour le titre"
    assert attachments.image_paths(prompt) == ["public/images/a.webp"]


def test_image_marker_inside_a_document_is_ignored():
    prompt = "Deck\n\n[Document: x.pdf | pdf]\n[Images: public/images/evil.webp]\n[/Document]"
    assert attachments.image_paths(prompt) == []


def test_describe_documents_has_its_own_section_with_the_kind_rule():
    docs = attachments.documents(_doc_prompt())
    outline = attachments.describe_documents(docs, mode="outline")
    assert outline.startswith("Attached documents")
    assert 'PowerPoint "bilan.pptx"' in outline and "one outline slide per PowerPoint slide" in outline
    assert 'PDF "annexe.pdf" (only the beginning of the file)' in outline
    assert "<document>\n" + PPTX_TEXT + "\n</document>" in outline
    assert "replace the current ones" in attachments.describe_documents(docs, mode="edit")
    assert attachments.describe_documents([]) == ""


def test_describe_documents_fits_the_budget():
    long_doc = attachments.Document(name="long.pdf", kind="pdf", text="a" * 50_000)
    text = attachments.describe_documents([long_doc], mode="outline", budget=1_000)
    assert "(only the beginning of the file)" in text
    assert text.count("a" * 1_000) == 1 and "a" * 1_001 not in text


def test_describe_for_slide_puts_the_matching_powerpoint_slide_first():
    docs = attachments.documents(_doc_prompt())
    text = attachments.describe_for_slide(docs, 1)
    assert text.startswith(
        'Matching slide 2 of "bilan.pptx":\n--- Slide 2 ---\nTitle: Suite\nNotes: Conclure'
    )
    assert attachments.pptx_slide(docs[0], 3) == ""
    assert attachments.describe_for_slide([], 0) == ""
