"""SEO of a published site: per-page head, structured data, sitemap, robots.

Pure string functions over the built HTML, so they are easy to test and run
the same whether the page was pre-rendered or not.

- `<html lang>` follows the site's language (detected from its text), not "en".
- Every page gets its canonical URL and og:url; relative og/twitter images
  become absolute (social scrapers ignore relative URLs).
- og:site_name / og:locale and a schema.org WebSite object are added when the
  project did not declare its own.
- sitemap.xml lists the pre-rendered routes; robots.txt points to it.
"""

from __future__ import annotations

import html
import json
import re
from datetime import UTC, datetime
from urllib.parse import urljoin

_STOPWORDS = {
    "fr": {
        "le",
        "la",
        "les",
        "des",
        "une",
        "est",
        "et",
        "pour",
        "avec",
        "dans",
        "vous",
        "nous",
        "sur",
        "pas",
        "plus",
        "votre",
        "notre",
        "du",
        "au",
        "aux",
        "qui",
        "que",
        "ce",
        "cette",
    },
    "en": {
        "the",
        "and",
        "for",
        "with",
        "you",
        "your",
        "our",
        "are",
        "this",
        "that",
        "from",
        "is",
        "we",
        "of",
        "to",
        "in",
        "on",
        "it",
        "an",
        "be",
        "all",
        "more",
        "get",
    },
    "es": {
        "el",
        "los",
        "las",
        "una",
        "es",
        "y",
        "para",
        "con",
        "en",
        "su",
        "nuestro",
        "que",
        "por",
        "del",
        "como",
        "más",
        "tu",
        "sus",
    },
    "de": {
        "der",
        "die",
        "das",
        "und",
        "ist",
        "mit",
        "für",
        "ein",
        "eine",
        "sie",
        "wir",
        "ihr",
        "auf",
        "nicht",
        "den",
        "dem",
        "zu",
        "von",
    },
    "it": {
        "il",
        "lo",
        "gli",
        "una",
        "è",
        "e",
        "per",
        "con",
        "nel",
        "che",
        "del",
        "della",
        "sono",
        "più",
        "tuo",
        "nostro",
        "di",
    },
    "pt": {
        "o",
        "os",
        "as",
        "uma",
        "é",
        "e",
        "para",
        "com",
        "em",
        "seu",
        "nosso",
        "que",
        "do",
        "da",
        "mais",
        "você",
        "não",
    },
}
_OG_LOCALE = {"fr": "fr_FR", "en": "en_US", "es": "es_ES", "de": "de_DE", "it": "it_IT", "pt": "pt_PT"}
_TAG_RE = re.compile(r"<[^>]+>")
_WORD_RE = re.compile(r"[a-zàâäçéèêëîïôöùûüÿñœæß]+", re.I)
_BEACON = (
    "<script>(function(){if(navigator.webdriver)return;var e='/_rodium/v1/sites/hit',"
    "s=function(){try{var b=JSON.stringify({p:location.pathname,r:document.referrer||''});"
    "if(navigator.sendBeacon){navigator.sendBeacon(e,new Blob([b],{type:'application/json'}))}"
    "else{fetch(e,{method:'POST',body:b,keepalive:true,headers:{'Content-Type':'application/json'}})}"
    "}catch(x){}},h=history.pushState;s();history.pushState=function(){h.apply(this,arguments);"
    "setTimeout(s,0)};addEventListener('popstate',s)})();</script>"
)


def detect_language(text: str, fallback: str = "en") -> str:
    """Two-letter language of a page from its visible words (stopword vote)."""
    words = [w.lower() for w in _WORD_RE.findall(_TAG_RE.sub(" ", text or ""))]
    if len(words) < 12:
        return fallback
    scores = {lang: sum(1 for w in words if w in stops) for lang, stops in _STOPWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] >= 3 else fallback


def page_url(site_url: str, route: str) -> str:
    base = site_url.rstrip("/") + "/"
    return urljoin(base, route.lstrip("/")) if route not in ("", "/") else base


def _has(doc: str, pattern: str) -> bool:
    return re.search(pattern, doc, re.I) is not None


def _set_lang(doc: str, lang: str) -> str:
    if re.search(r"<html\b[^>]*\blang=", doc, re.I):
        return re.sub(r'(<html\b[^>]*\blang=)["\'][^"\']*["\']', rf'\1"{lang}"', doc, count=1, flags=re.I)
    return re.sub(r"<html\b", f'<html lang="{lang}"', doc, count=1, flags=re.I)


def _absolutize_images(doc: str, site_url: str) -> str:
    def fix(match: re.Match[str]) -> str:
        before, value, after = match.group(1), match.group(2), match.group(3)
        if value.startswith(("http://", "https://", "//", "data:")) or not value:
            return match.group(0)
        return f"{before}{html.escape(page_url(site_url, value), quote=True)}{after}"

    return re.sub(
        r'(<meta\b[^>]*(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]*\bcontent=["\'])([^"\']*)(["\'])',
        fix,
        doc,
        flags=re.I,
    )


def finalize_page_head(
    doc: str,
    *,
    site_url: str,
    route: str,
    lang: str,
    site_name: str,
    description: str = "",
    analytics: bool = True,
    indexable: bool = True,
) -> str:
    """Inject per-page SEO into one built HTML page (idempotent).

    A canonical set in the SEO editor applies to the whole site: its origin is
    kept (the owner may canonicalise to another domain) and its path becomes
    the page's own. `indexable=False` (the 404 page) gets no canonical/og:url.
    """
    existing = re.search(r'<link\b[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']*)["\']', doc, re.I)
    base = site_url
    if existing and re.match(r"https?://", existing.group(1)):
        parsed = re.match(r"(https?://[^/]+)", existing.group(1))
        base = parsed.group(1) if parsed else site_url
    url = html.escape(page_url(base, route), quote=True)
    doc = _set_lang(doc, lang)
    doc = _absolutize_images(doc, site_url)
    extra: list[str] = []
    if not indexable:
        doc = re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>\s*', "", doc, flags=re.I)
    elif existing:
        doc = re.sub(
            r'(<link\b[^>]*rel=["\']canonical["\'][^>]*href=["\'])[^"\']*(["\'])',
            lambda m: m.group(1) + url + m.group(2),
            doc,
            count=1,
            flags=re.I,
        )
    else:
        extra.append(f'<link rel="canonical" href="{url}" />')
    if indexable and _has(doc, r'property=["\']og:url["\']'):
        doc = re.sub(
            r'(<meta\b[^>]*property=["\']og:url["\'][^>]*content=["\'])[^"\']*(["\'])',
            lambda m: m.group(1) + url + m.group(2),
            doc,
            count=1,
            flags=re.I,
        )
    elif indexable:
        extra.append(f'<meta property="og:url" content="{url}" />')
    if not _has(doc, r'property=["\']og:site_name["\']') and site_name:
        extra.append(f'<meta property="og:site_name" content="{html.escape(site_name, quote=True)}" />')
    if not _has(doc, r'property=["\']og:locale["\']'):
        extra.append(f'<meta property="og:locale" content="{_OG_LOCALE.get(lang, "en_US")}" />')
    if not _has(doc, r'property=["\']og:type["\']'):
        extra.append('<meta property="og:type" content="website" />')
    if route in ("", "/") and not _has(doc, r'type=["\']application/ld\+json["\']'):
        data = {"@context": "https://schema.org", "@type": "WebSite", "name": site_name, "url": url}
        if description:
            data["description"] = description
        payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        extra.append(f'<script type="application/ld+json">{payload}</script>')
    if extra:
        if "<!--forge:head-->" in doc:
            doc = doc.replace("<!--forge:head-->", "\n".join(extra) + "\n<!--forge:head-->", 1)
        else:
            doc = re.sub(r"</head>", "\n".join(extra) + "\n</head>", doc, count=1, flags=re.I)
    if analytics and "/_rodium/v1/sites/hit" not in doc:
        if "<!--forge:body-->" in doc:
            doc = doc.replace("<!--forge:body-->", _BEACON + "\n<!--forge:body-->", 1)
        else:
            doc = re.sub(r"</body>", _BEACON + "\n</body>", doc, count=1, flags=re.I)
    return doc


def meta_description(doc: str) -> str:
    match = re.search(r'<meta\b[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']', doc, re.I)
    return html.unescape(match.group(1)).strip() if match else ""


def is_noindex(doc: str) -> bool:
    match = re.search(r'<meta\b[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']*)["\']', doc, re.I)
    return bool(match and "noindex" in match.group(1).lower())


def sitemap_xml(site_url: str, routes: list[str]) -> str:
    today = datetime.now(UTC).date().isoformat()
    rows = []
    for route in sorted(set(routes), key=lambda r: (r != "/", r)):
        loc = html.escape(page_url(site_url, route))
        priority = "1.0" if route == "/" else "0.7"
        rows.append(f"  <url><loc>{loc}</loc><lastmod>{today}</lastmod><priority>{priority}</priority></url>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    )


def robots_txt(site_url: str, *, noindex: bool) -> str:
    if noindex:
        return "User-agent: *\nDisallow: /\n"
    return f"User-agent: *\nAllow: /\n\nSitemap: {page_url(site_url, '/sitemap.xml')}\n"
