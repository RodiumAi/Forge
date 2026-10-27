import json, sys, pathlib
from PIL import Image, ImageDraw
d = pathlib.Path(sys.argv[1]); meta = json.loads((d/"meta.json").read_text())
names = list(meta)
for part in range(0, len(names), 6):
    chunk = names[part:part+6]
    sheet = Image.new("RGB", (4*260, len(chunk)*190), "white"); dr = ImageDraw.Draw(sheet)
    for r, n in enumerate(chunk):
        for c, m in enumerate(meta[n]):
            im = Image.open(d/m["file"]); im.thumbnail((250,160))
            sheet.paste(im, (c*260, r*190+20)); dr.text((c*260, r*190+4), f"{n}-{c} {m['tags'][:30]}", fill="black")
    sheet.save(d/f"sheet{part//6}.png")
