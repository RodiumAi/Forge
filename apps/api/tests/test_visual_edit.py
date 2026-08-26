"""Visual edit / visual image must never guess which occurrence to rewrite.

These rewrite the user's source by string substitution. Before this behaviour
was locked down, an ambiguous target was resolved by heuristic and the wrong
element got silently modified.
"""

import pytest

from app.services.filesystem import read_file, write_file
from app.services.source_edit import AmbiguousMatch
from app.services.visual_edit import apply_visual_text_edit
from app.services.visual_image import apply_visual_image_replace


class TestTextEdit:
    def test_replaces_a_unique_occurrence(self, project):
        write_file(project, "src/App.tsx", "<h1>Bonjour</h1>")
        result = apply_visual_text_edit(project, "Bonjour", "Salut")
        assert result.path == "src/App.tsx"
        assert read_file(project, "src/App.tsx") == "<h1>Salut</h1>"

    def test_refuses_when_the_text_appears_twice_in_one_file(self, project):
        original = "<h1>Prix</h1><span>Prix</span>"
        write_file(project, "src/App.tsx", original)
        with pytest.raises(AmbiguousMatch):
            apply_visual_text_edit(project, "Prix", "Tarif")
        # The file must be left exactly as it was.
        assert read_file(project, "src/App.tsx") == original

    def test_refuses_when_several_files_match_once_each(self, project):
        write_file(project, "src/a/One.tsx", "<p>Contact</p>")
        write_file(project, "src/b/Two.tsx", "<p>Contact</p>")
        with pytest.raises(AmbiguousMatch):
            apply_visual_text_edit(project, "Contact", "Nous joindre")

    def test_prefers_the_single_src_match(self, project):
        write_file(project, "src/App.tsx", "<p>Contact</p>")
        write_file(project, "docs/notes.js", "// Contact")
        result = apply_visual_text_edit(project, "Contact", "Nous joindre")
        assert result.path == "src/App.tsx"
        assert read_file(project, "docs/notes.js") == "// Contact"

    def test_reencodes_escaped_quotes_like_the_matched_literal(self, project):
        # Source holds an escaped apostrophe; the replacement must be escaped too.
        write_file(project, "src/App.tsx", '"L\\\'annee"')
        apply_visual_text_edit(project, "L'annee", "L'ete")
        assert read_file(project, "src/App.tsx") == '"L\\\'ete"'

    def test_matches_html_entities(self, project):
        write_file(project, "src/App.tsx", "<p>Tom &amp; Jerry</p>")
        apply_visual_text_edit(project, "Tom & Jerry", "Tom & Anna")
        assert read_file(project, "src/App.tsx") == "<p>Tom &amp; Anna</p>"

    def test_reports_missing_text(self, project):
        write_file(project, "src/App.tsx", "<h1>Bonjour</h1>")
        with pytest.raises(FileNotFoundError):
            apply_visual_text_edit(project, "Introuvable", "x")

    def test_rejects_a_too_short_target(self, project):
        write_file(project, "src/App.tsx", "a")
        with pytest.raises(ValueError):
            apply_visual_text_edit(project, "a", "b")

    def test_rejects_a_noop_edit(self, project):
        write_file(project, "src/App.tsx", "<h1>Bonjour</h1>")
        with pytest.raises(ValueError):
            apply_visual_text_edit(project, "Bonjour", "Bonjour")

    def test_ignores_files_outside_the_source_extensions(self, project):
        write_file(project, "README.md", "Bonjour")
        with pytest.raises(FileNotFoundError):
            apply_visual_text_edit(project, "Bonjour", "Salut")


class TestImageReplace:
    def test_replaces_a_unique_src(self, project):
        write_file(project, "src/App.tsx", '<img src="/logo.png" />')
        apply_visual_image_replace(project, "/logo.png", "/new.png")
        assert read_file(project, "src/App.tsx") == '<img src="/new.png" />'

    def test_rejects_an_external_absolute_url(self, project, object_store_host):
        original = '<img src="/logo.png" />'
        write_file(project, "src/App.tsx", original)
        with pytest.raises(ValueError, match="not served by this instance"):
            apply_visual_image_replace(project, "/logo.png", "https://evil.example.com/x.png")
        assert read_file(project, "src/App.tsx") == original

    def test_accepts_an_object_store_url(self, project, object_store_host):
        write_file(project, "src/App.tsx", '<img src="/logo.png" />')
        apply_visual_image_replace(project, "/logo.png", f"{object_store_host}/forge-uploads/a.png")
        assert f"{object_store_host}/forge-uploads/a.png" in read_file(project, "src/App.tsx")

    def test_does_not_use_the_bare_filename_as_a_needle(self, project):
        # "hero.png" also appears in a comment; only the real src must change.
        write_file(project, "src/App.tsx", '// about hero.png\n<img src="/img/hero.png" />')
        apply_visual_image_replace(project, "/img/hero.png", "/img/new.png")
        content = read_file(project, "src/App.tsx")
        assert "// about hero.png" in content
        assert '<img src="/img/new.png" />' in content

    def test_refuses_an_ambiguous_src(self, project):
        original = '<img src="/logo.png" /><img src="/logo.png" />'
        write_file(project, "src/App.tsx", original)
        with pytest.raises(AmbiguousMatch):
            apply_visual_image_replace(project, "/logo.png", "/new.png")
        assert read_file(project, "src/App.tsx") == original

    def test_matches_a_public_prefixed_literal(self, project):
        write_file(project, "src/App.tsx", 'import logo from "public/logo.png";')
        apply_visual_image_replace(project, "/logo.png", "/new.png")
        assert 'from "public/new.png"' in read_file(project, "src/App.tsx")

    def test_reports_a_missing_src(self, project):
        write_file(project, "src/App.tsx", '<img src="/logo.png" />')
        with pytest.raises(FileNotFoundError):
            apply_visual_image_replace(project, "/absent.png", "/new.png")

    def test_rejects_an_empty_target(self, project):
        write_file(project, "src/App.tsx", '<img src="/logo.png" />')
        with pytest.raises(ValueError):
            apply_visual_image_replace(project, "/logo.png", "  ")
