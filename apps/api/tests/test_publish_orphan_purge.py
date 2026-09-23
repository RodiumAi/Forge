"""Publish must purge orphan keys under {slug}/ (stale + cross-tenant reclaim)."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from app.services import publish_esm


def test_publish_purges_orphan_keys(monkeypatch, tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html></html>", encoding="utf-8")
    (dist / "app.js").write_text("console.log(1)", encoding="utf-8")

    async def fake_transform(project_id, out_dir, *, title="Forge app"):
        for src in dist.iterdir():
            (out_dir / src.name).write_bytes(src.read_bytes())
        return {"ok": True}

    store = MagicMock()
    store.bucket_site_assets = "forge-assets"
    store.list_prefix.return_value = [
        "brandx/index.html",
        "brandx/app.js",
        "brandx/secret.pdf",  # orphan from a previous publish / other tenant
        "brandx/old/page.html",
    ]
    store.delete_keys.return_value = 2
    store.put.side_effect = lambda *a, **k: "ok"

    monkeypatch.setattr(publish_esm, "transform_project_to_dir", fake_transform)
    monkeypatch.setattr(publish_esm, "get_object_store", lambda: store)
    monkeypatch.setattr(
        publish_esm,
        "get_settings",
        lambda: MagicMock(
            bucket_site_assets="forge-assets",
            sites_url_for_slug=lambda slug: f"https://{slug}.example",
        ),
    )

    result = asyncio.run(publish_esm.publish_project_esm("proj-1", "brandx", title="Demo"))

    assert result["files_uploaded"] == 2
    assert result["orphans_deleted"] == 2
    store.delete_keys.assert_called_once()
    deleted = set(store.delete_keys.call_args.args[1])
    assert deleted == {"brandx/secret.pdf", "brandx/old/page.html"}
    # New build keys must have been uploaded.
    put_keys = {c.args[1] for c in store.put.call_args_list}
    assert put_keys == {"brandx/index.html", "brandx/app.js"}


def test_list_prefix_and_delete_keys_batching():
    from app.providers.objects import ObjectStore

    store = ObjectStore.__new__(ObjectStore)
    internal = MagicMock()
    store.internal = internal

    internal.list_objects_v2.side_effect = [
        {
            "Contents": [{"Key": "a/1"}, {"Key": "a/2"}],
            "IsTruncated": True,
            "NextContinuationToken": "t2",
        },
        {"Contents": [{"Key": "a/3"}], "IsTruncated": False},
    ]
    assert store.list_prefix("bucket", "a/") == ["a/1", "a/2", "a/3"]

    keys = [f"brandx/k{i}" for i in range(1005)]
    n = store.delete_keys("bucket", keys)
    assert n == 1005
    assert internal.delete_objects.call_count == 2


@pytest.mark.parametrize(
    "bad_prefix",
    ["", "/", "..", "../", "A/", "-bad/", "has space/", "a/../b/", "//x/"],
)
def test_list_prefix_rejects_unsafe_prefixes(bad_prefix):
    from app.providers.objects import ObjectStore

    store = ObjectStore.__new__(ObjectStore)
    store.internal = MagicMock()
    with pytest.raises(ValueError, match="unsafe site object prefix"):
        store.list_prefix("bucket", bad_prefix)
    store.internal.list_objects_v2.assert_not_called()


def test_list_prefix_normalizes_bare_slug():
    from app.providers.objects import ObjectStore

    store = ObjectStore.__new__(ObjectStore)
    internal = MagicMock()
    store.internal = internal
    internal.list_objects_v2.return_value = {
        "Contents": [{"Key": "brandx/index.html"}],
        "IsTruncated": False,
    }
    assert store.list_prefix("bucket", "brandx") == ["brandx/index.html"]
    assert internal.list_objects_v2.call_args.kwargs["Prefix"] == "brandx/"


def test_delete_keys_rejects_keys_outside_site_prefix():
    from app.providers.objects import ObjectStore

    store = ObjectStore.__new__(ObjectStore)
    store.internal = MagicMock()
    with pytest.raises(ValueError, match="unsafe site object key"):
        store.delete_keys("bucket", ["../etc/passwd"])
    store.internal.delete_objects.assert_not_called()
    with pytest.raises(ValueError, match="unsafe site object key"):
        store.delete_keys("bucket", ["brandx/ok.html", "other/secret.pdf"], under_prefix="brandx/")
    store.internal.delete_objects.assert_not_called()
