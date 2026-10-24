# Slides kit builder

Scripts used to build the `data/templates/slides-*` kits (wave 1, agent E). Run from `apps/api` with the API venv.

1. `fetch.py <out_dir> <queries.json>`: search Pixabay (`PIXABAY_API_KEY` in the environment) and download candidates into an untrusted folder.
2. `convert.py`: convert the picked images to WebP with credits.
3. `kits_content.py`: content of each kit (titles, texts, figures, image picks). Add new kits here.
4. `build_kits.py <out_dir> <images_dir>`: write the kits with `kitlib.py` layout builders (12 layouts on 1920 x 1080).
5. `render_check.py` and `sheet.py`: Playwright screenshots and a contact sheet to eyeball overflow.

Then run `pytest tests/test_templates.py tests/test_template_slides.py` in `apps/api`.
