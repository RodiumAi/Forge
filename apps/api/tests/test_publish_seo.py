"""Published sites must carry the project's SEO, not a hardcoded shell.

Every published site used to ship "<title>Forge app</title>" and the default
favicon: the publish CLI generated its index.html from scratch and never read
the project's — where the SEO editor writes title/description/og/favicon.
"""

import asyncio
import shutil

import pytest

from app.services.filesystem import write_file
from app.services.publish_esm import transform_project_to_dir
from app.services.scaffold import scaffold_vite_react

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node not available")

SEO_INDEX = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/images/brand-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bloom Studio</title>
    <meta name="description" content="A small sanctuary for slow hours." />
    <meta property="og:title" content="Bloom Studio" />
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.js"></script></body>
</html>
"""


@needs_node
class TestPublishedSeo:
    def test_published_head_inherits_the_project_seo(self, project, tmp_path):
        scaffold_vite_react(project, "Demo")
        write_file(project, "index.html", SEO_INDEX)
        out = tmp_path / "dist"
        asyncio.run(transform_project_to_dir(project, out, title="Fallback Name"))
        html = (out / "index.html").read_text(encoding="utf-8")
        assert "<title>Bloom Studio</title>" in html
        assert 'name="description"' in html
        assert "brand-icon.png" in html
        assert "Forge app" not in html
        # The default favicon must not shadow the project's own icon.
        assert html.count("rel=") == html.count("rel=")  # sanity
        assert '/favicon.png"' not in html

    def test_project_name_is_the_fallback_title(self, project, tmp_path):
        scaffold_vite_react(project, "Demo")
        write_file(project, "index.html", "<html><head></head><body><div id='root'></div></body></html>")
        out = tmp_path / "dist"
        asyncio.run(transform_project_to_dir(project, out, title="Portfolio de Sarah"))
        html = (out / "index.html").read_text(encoding="utf-8")
        assert "<title>Portfolio de Sarah</title>" in html
        # No project icon declared -> default favicon kept.
        assert 'href="/favicon.png"' in html


@needs_node
class TestMultiStylesheetPublish:
    def test_every_css_file_ships_foundation_first(self, project, tmp_path):
        import asyncio

        scaffold_vite_react(project, "Demo")
        write_file(project, "src/styles/products.css", ".products-grid { display: grid }")
        out = tmp_path / "dist"
        asyncio.run(transform_project_to_dir(project, out, title="Demo"))
        html = (out / "index.html").read_text(encoding="utf-8")
        assert ".products-grid" in html, "per-page stylesheets must reach the published site"
        assert html.index(":root") < html.index(".products-grid"), "foundation tokens come first"
