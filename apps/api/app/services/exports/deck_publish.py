"""Publish a slides project: the player site on the project's slug.

Same bucket, prefix (``{slug}/``), custom domain and upload path as a web
site (``publish_esm.upload_site_dir``); only the build differs: no code to
compile, the fixed player bundle plus the deck's documents and images.
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

from app.config import get_settings
from app.services.exports.bundle import build_player_bundle
from app.services.exports.deck_site import deck_title, write_published_site
from app.services.exports.deck_source import load_deck
from app.services.publish_esm import optimize_images, upload_site_dir


async def publish_deck(
    project_id: str,
    slug: str,
    *,
    title: str,
    lang: str,
    badge: bool,
    notes: bool,
    site_url: str | None = None,
) -> dict:
    settings = get_settings()
    public_url = site_url or settings.sites_url_for_slug(slug)
    src = await asyncio.to_thread(load_deck, project_id, include_notes=notes)
    bundle = await build_player_bundle(src.icons(), variant="site")
    with tempfile.TemporaryDirectory(prefix="forge-deck-site-") as tmp:
        out = Path(tmp) / "dist"
        name = deck_title(src, title)
        site = await asyncio.to_thread(
            write_published_site,
            project_id,
            src,
            out,
            bundle,
            title=name,
            lang=lang,
            badge=badge,
            notes=notes,
        )
        await asyncio.to_thread(optimize_images, out)
        uploaded, orphans = await upload_site_dir(out, slug)
    return {
        "public_url": public_url,
        "files_uploaded": uploaded,
        "orphans_deleted": orphans,
        "build_mode": "deck_player",
        "assets": len(site["assets"]),
        "notes": notes,
        "badge": badge,
    }
