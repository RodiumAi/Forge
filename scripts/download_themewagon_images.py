# Collect image URLs from each ThemeWagon demo via browser CDP, then download.
# This file is filled by the agent as sites are inspected.

import json
import re
import time
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1] / "data" / "templates" / "_media" / "themewagon"
ROOT.mkdir(parents=True, exist_ok=True)

# Seeded from live DOM inspection (Sarab + Bloom). Other sites filled after browse.
SEEDS: dict[str, list[str]] = {
    "sarab": [
        "https://themewagon.github.io/sarab/img/menu/1.jpg",
        "https://themewagon.github.io/sarab/img/menu/2.jpg",
        "https://themewagon.github.io/sarab/img/menu/3.jpg",
        "https://themewagon.github.io/sarab/img/menu/4.jpg",
        "https://themewagon.github.io/sarab/img/menu/5.jpg",
        "https://themewagon.github.io/sarab/img/menu/6.jpg",
        "https://themewagon.github.io/sarab/img/banner-img.jpg",
        "https://themewagon.github.io/sarab/img/category/1.jpg",
        "https://themewagon.github.io/sarab/img/category/2.jpg",
        "https://themewagon.github.io/sarab/img/category/3.jpg",
        "https://themewagon.github.io/sarab/img/category/4.jpg",
        "https://themewagon.github.io/sarab/img/category/5.jpg",
        "https://themewagon.github.io/sarab/img/category/6.jpg",
        "https://themewagon.github.io/sarab/img/about1.jpg",
        "https://themewagon.github.io/sarab/img/about2.jpg",
        "https://themewagon.github.io/sarab/img/off-img.jpg",
        "https://themewagon.github.io/sarab/img/portfolio/work1.jpg",
        "https://themewagon.github.io/sarab/img/portfolio/work2.jpg",
        "https://themewagon.github.io/sarab/img/portfolio/work3.jpg",
        "https://themewagon.github.io/sarab/img/portfolio/work4.jpg",
        "https://themewagon.github.io/sarab/img/portfolio/work5.jpg",
        "https://themewagon.github.io/sarab/img/chefs/1.jpg",
        "https://themewagon.github.io/sarab/img/chefs/2.jpg",
        "https://themewagon.github.io/sarab/img/chefs/3.jpg",
        "https://themewagon.github.io/sarab/img/chefs/4.jpg",
        "https://themewagon.github.io/sarab/img/testimonial/1.jpg",
        "https://themewagon.github.io/sarab/img/testimonial/2.jpg",
        "https://themewagon.github.io/sarab/img/testimonial/3.jpg",
        "https://themewagon.github.io/sarab/img/testimonial/4.jpg",
        "https://themewagon.github.io/sarab/img/blog/1.jpg",
        "https://themewagon.github.io/sarab/img/blog/2.jpg",
        "https://themewagon.github.io/sarab/img/blog/3.jpg",
    ],
    "bloomtpl": [
        "https://images.unsplash.com/photo-1579338559194-a162d19bf842?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1608667508764-33cf0726b13a?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1465453869711-7e174808ace9?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1512374382149-233c42b6a83b?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1516767254874-281bffac9e9a?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1621315271772-28b1f3a5df87?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1496202703211-aa28e9500c30?q=80&w=800&auto=format&fit=crop",
    ],
    "play-astro": [
        "https://themewagon.github.io/play-astro/assets/hero/hero-image.jpg",
        "https://themewagon.github.io/play-astro/assets/about/about-image-01.jpg",
        "https://themewagon.github.io/play-astro/assets/about/about-image-02.jpg",
        "https://themewagon.github.io/play-astro/assets/testimonials/author-01.jpg",
        "https://themewagon.github.io/play-astro/assets/testimonials/author-02.jpg",
        "https://themewagon.github.io/play-astro/assets/testimonials/author-03.jpg",
        "https://themewagon.github.io/play-astro/assets/team/team-01.png",
        "https://themewagon.github.io/play-astro/assets/team/team-02.png",
        "https://themewagon.github.io/play-astro/assets/team/team-03.png",
        "https://themewagon.github.io/play-astro/assets/team/team-04.png",
        "https://themewagon.github.io/play-astro/assets/blog/blog-01.jpg",
        "https://themewagon.github.io/play-astro/assets/blog/blog-02.jpg",
        "https://themewagon.github.io/play-astro/assets/blog/blog-03.jpg",
        "https://themewagon.github.io/play-astro/assets/logo/logo-white.svg",
    ],
}


def safe_name(url: str, idx: int) -> str:
    path = urlparse(url).path
    base = Path(path).name or f"img-{idx}"
    base = re.sub(r"[^a-zA-Z0-9._-]+", "-", base)
    if "?" in base:
        base = base.split("?", 1)[0]
    if not Path(base).suffix:
        base += ".jpg"
    return f"{idx:02d}-{base}"


def download(slug: str, urls: list[str]) -> None:
    dest = ROOT / slug
    dest.mkdir(parents=True, exist_ok=True)
    manifest = []
    # Windows / corporate SSL often breaks Python certs — disable verify for asset mirror only.
    import ssl

    ctx = ssl._create_unverified_context()
    for i, url in enumerate(urls, 1):
        name = safe_name(url, i)
        out = dest / name
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 ForgeTemplates/1.0"})
            with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
                data = resp.read()
            out.write_bytes(data)
            manifest.append({"file": name, "source": url, "bytes": len(data)})
            print(f"OK {slug}/{name} ({len(data)} B)")
        except Exception as exc:
            print(f"FAIL {url}: {exc}")
            manifest.append({"file": name, "source": url, "error": str(exc)})
        time.sleep(0.05)
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    extra = ROOT.parent / "themewagon-urls.json"
    if extra.is_file():
        more = json.loads(extra.read_text(encoding="utf-8"))
        for k, v in more.items():
            SEEDS.setdefault(k, [])
            for u in v:
                if u not in SEEDS[k]:
                    SEEDS[k].append(u)
    for slug, urls in SEEDS.items():
        print(f"=== {slug} ({len(urls)}) ===")
        download(slug, urls)


if __name__ == "__main__":
    main()
