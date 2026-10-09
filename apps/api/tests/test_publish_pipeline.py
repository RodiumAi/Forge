"""Published output: production build, pre-rendered routes, SEO files, caching.

Needs node (and, for the end-to-end class, the dependency CDN and a Chromium
build): skipped when the environment cannot provide them.
"""

from __future__ import annotations

import asyncio
import shutil

import pytest

from app.services import site_seo
from app.services.filesystem import write_bytes, write_file
from app.services.publish_esm import cache_control_for, finalize_site, transform_project_to_dir
from app.services.scaffold import scaffold_vite_react

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node not available")

MAIN = """import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);
"""
APP = """import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import logo from "./assets/logo.png";

function Home() {
  return (
    <main>
      <Helmet><title>Fournil, boulangerie à Lyon</title><meta name="description" content="Pains au levain et viennoiseries." /></Helmet>
      <img src={logo} alt="Fournil" />
      <h1>Le pain de votre quartier, cuit chaque matin dans notre four à bois</h1>
      <p>Nous préparons nos pains au levain avec des farines de la région et nous vous attendons dans la boutique.</p>
      <Link to="/carte">Voir la carte <ArrowRight /></Link>
    </main>
  );
}
function Carte() {
  return (
    <main>
      <Helmet><title>La carte, Fournil</title></Helmet>
      <h1>La carte</h1>
      <Link to="/">Accueil</Link>
    </main>
  );
}
function NotFound() {
  return <main><h1>Page introuvable</h1></main>;
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/carte" element={<Carte />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
"""


class TestSeoHelpers:
    def test_language_is_detected_from_the_text(self):
        fr = "Nous préparons nos pains avec des farines de la région et nous vous attendons dans la boutique pour le petit déjeuner"
        en = "We bake our bread every morning and we are waiting for you in the shop with the best pastries in town"
        assert site_seo.detect_language(fr) == "fr"
        assert site_seo.detect_language(en, fallback="fr") == "en"
        assert site_seo.detect_language("Hi", fallback="de") == "de"

    def test_page_head_gets_canonical_lang_and_absolute_images(self):
        doc = (
            '<!doctype html><html lang="en"><head><title>T</title>'
            '<meta property="og:image" content="/seo/og-image.png" /><!--forge:head--></head>'
            '<body><div id="root"></div><!--forge:body--></body></html>'
        )
        out = site_seo.finalize_page_head(
            doc, site_url="https://fournil.example", route="/carte", lang="fr", site_name="Fournil"
        )
        assert '<html lang="fr">' in out
        assert '<link rel="canonical" href="https://fournil.example/carte" />' in out
        assert 'property="og:url" content="https://fournil.example/carte"' in out
        assert 'content="https://fournil.example/seo/og-image.png"' in out
        assert 'og:locale" content="fr_FR"' in out
        assert "/_rodium/v1/sites/hit" in out
        assert "application/ld+json" not in out, "structured data only on the home page"
        home = site_seo.finalize_page_head(
            doc, site_url="https://fournil.example", route="/", lang="fr", site_name="F"
        )
        assert '"@type": "WebSite"' in home

    def test_sitemap_and_robots(self):
        xml = site_seo.sitemap_xml("https://x.example", ["/carte", "/"])
        assert xml.index("https://x.example/</loc>") < xml.index("https://x.example/carte</loc>")
        assert "Sitemap: https://x.example/sitemap.xml" in site_seo.robots_txt(
            "https://x.example", noindex=False
        )
        assert "Disallow: /" in site_seo.robots_txt("https://x.example", noindex=True)

    def test_cache_policy(self):
        assert "immutable" in cache_control_for("assets/main-ABC.js")
        assert "must-revalidate" in cache_control_for("carte/index.html")
        assert "immutable" not in cache_control_for("generated/hero.webp")


@needs_node
class TestProductionBuild:
    def test_bundled_minified_without_source_maps(self, project, tmp_path):
        scaffold_vite_react(project, "Demo")
        out = tmp_path / "dist"
        result = asyncio.run(transform_project_to_dir(project, out, title="Demo", lang="fr"))
        if result.get("mode") != "bundled":
            pytest.skip("dependency CDN unreachable")
        html = (out / "index.html").read_text(encoding="utf-8")
        assert '<html lang="fr">' in html
        assert 'rel="modulepreload"' in html
        assert "importmap" not in html, "dependencies are bundled, no CDN at runtime"
        bundles = list((out / "assets").glob("main-*.js"))
        assert bundles, "content-hashed entry"
        code = bundles[0].read_text(encoding="utf-8")
        assert "sourceMappingURL=data:" not in code
        assert "AArrowDown" not in code, "unused lucide icons are tree-shaken"
        assert not (out / "src").exists(), "no per-file modules"


def _chromium_available() -> bool:
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            for kwargs in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
                try:
                    p.chromium.launch(headless=True, **kwargs).close()
                    return True
                except Exception:
                    continue
    except Exception:
        return False
    return False


@needs_node
class TestPrerender:
    def test_routes_are_rendered_with_their_own_head(self, project, tmp_path):
        if not _chromium_available():
            pytest.skip("no Chromium build")
        scaffold_vite_react(project, "Fournil")
        write_file(project, "src/main.tsx", MAIN)
        write_file(project, "src/App.tsx", APP)
        write_bytes(project, "src/assets/logo.png", b"\x89PNG\r\n\x1a\n")
        out = tmp_path / "dist"
        build = asyncio.run(transform_project_to_dir(project, out, title="Fournil", lang="en"))
        if build.get("mode") != "bundled":
            pytest.skip("dependency CDN unreachable")
        assert (out / "src" / "assets" / "logo.png").is_file(), "imported assets are published"
        site = asyncio.run(
            finalize_site(out, site_url="https://fournil.example", site_name="Fournil", fallback_lang="en")
        )
        assert site["prerendered"], site
        assert site["routes"] == ["/", "/carte"]
        assert site["lang"] == "fr"
        home = (out / "index.html").read_text(encoding="utf-8")
        carte = (out / "carte" / "index.html").read_text(encoding="utf-8")
        assert "<h1>Le pain de votre quartier" in home
        assert "<title>Fournil, boulangerie à Lyon</title>" in home
        assert "Pains au levain" in home
        assert "<title>La carte, Fournil</title>" in carte
        assert 'href="https://fournil.example/carte"' in carte
        not_found = (out / "404.html").read_text(encoding="utf-8")
        assert "Page introuvable" in not_found and "noindex" in not_found
        sitemap = (out / "sitemap.xml").read_text(encoding="utf-8")
        assert "https://fournil.example/carte" in sitemap
        assert (out / "robots.txt").is_file()
