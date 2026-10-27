import json, sys, pathlib, urllib.request, ssl, io
from PIL import Image
dl = pathlib.Path(sys.argv[1]); outroot = pathlib.Path(sys.argv[2])
meta = json.loads((dl/"meta.json").read_text())
picks = json.loads(pathlib.Path(sys.argv[3]).read_text())
ctx = ssl.create_default_context(); credits = {}
for kit, items in picks.items():
    imgdir = outroot / kit / "public" / "images"; imgdir.mkdir(parents=True, exist_ok=True)
    for fname, ref in items.items():
        group, idx = ref.rsplit("-", 1); m = meta[group][int(idx)]
        raw = urllib.request.urlopen(urllib.request.Request(m["large"], headers={"User-Agent": "Mozilla/5.0 forge-templates"}), context=ctx, timeout=60).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB"); im.thumbnail((1600, 1600))
        im.save(imgdir / f"{fname}.webp", "WEBP", quality=80, method=6)
        credits.setdefault(kit, {})[fname] = {"author": m["user"], "url": m["page"], "w": im.width, "h": im.height}
        print(kit, fname, im.size, (imgdir / f"{fname}.webp").stat().st_size)
(outroot / "credits.json").write_text(json.dumps(credits, indent=1, ensure_ascii=False), encoding="utf-8")
