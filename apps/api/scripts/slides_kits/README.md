# Slides kit builder

Scripts that built the 36 `data/templates/slides-*` kits. Run them from this
folder with the API virtual environment (Pillow; Playwright for
`render_check.py`). Keep downloaded images in their own folder, outside the
repository.

1. `fetch.py <download_dir> <queries.json>`: search Pixabay (`PIXABAY_API_KEY`
   in the environment, never committed) and download candidates plus a
   `meta.json` into `<download_dir>`.
2. `sheet.py <download_dir>`: contact sheets of the candidates, to pick images.
3. `convert.py <download_dir> <images_root> <picks.json>`: download the picked
   images in large size, convert them to WebP (quality 80) under
   `<images_root>/<kit>/public/images/` and write `<images_root>/credits.json`.
4. Content modules, one entry per kit (titles, texts, figures, theme, image
   picks): `kits_content.py` (six reference kits), `kits_content_f1.py` and
   `kits_content_f2.py`. Add new kits to one of them.
5. `build_kits.py <repo_root> <images_root> [content_module] [kit_id ...]`:
   write the kits (template.json, DESIGN.md, deck.json, slides, notes, images,
   preview.html) with the layout builders of `kitlib.py` (12 layouts on
   1920 x 1080), the variants of `kitvariants.py` and the per-kit styles of
   `kitstyle_f2.py`. The content module defaults to `kits_content`; kit ids
   limit the build to those kits.
6. `render_check.py <kit_dir> <out_dir>`: Playwright screenshots of every slide
   and a contact sheet, to spot overflow.

Then, from `apps/api`: render the gallery card with
`python scripts/render_template_previews.py <kit_id>`, register new ids in
`EXPECTED_SLIDES_IDS` (`tests/test_templates.py`) and run
`pytest tests/test_templates.py tests/test_template_slides.py -q`.

Format and rules: [docs/templates/slides-style-guide.md](../../../../docs/templates/slides-style-guide.md).
