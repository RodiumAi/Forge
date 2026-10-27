"""Search Pixabay and download candidate images (untrusted data dir passed as argv[1])."""
import json, sys, urllib.parse, urllib.request, pathlib, ssl

import os

KEY = os.environ["PIXABAY_API_KEY"]  # read from the environment, never committed
out = pathlib.Path(sys.argv[1])
queries = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
ctx = ssl.create_default_context()
meta = {}
for name, (q, orient, n) in queries.items():
    params = {"key": KEY, "q": q, "image_type": "photo", "orientation": orient, "safesearch": "true", "per_page": 20, "order": "popular"}
    url = "https://pixabay.com/api/?" + urllib.parse.urlencode(params)
    data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 forge-templates"}), context=ctx, timeout=30))
    hits = data.get("hits", [])[:n]
    meta[name] = []
    for i, h in enumerate(hits):
        dest = out / f"{name}-{i}.jpg"
        req = urllib.request.Request(h["webformatURL"], headers={"User-Agent": "Mozilla/5.0 forge-templates"})
        dest.write_bytes(urllib.request.urlopen(req, context=ctx, timeout=60).read())
        meta[name].append({"file": dest.name, "id": h["id"], "user": h["user"], "page": h["pageURL"], "large": h["largeImageURL"], "w": h["imageWidth"], "h": h["imageHeight"], "tags": h["tags"]})
    print(name, len(hits))
(out / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
