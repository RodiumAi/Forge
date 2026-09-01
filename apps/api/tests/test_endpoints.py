"""Endpoint-level checks that do not need a database.

Only routes whose behaviour is easy to get wrong are covered: the runner shell
(which now carries the import map and the bridge) and the public manifest the
code editor derives its ambient types from.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestHealth:
    def test_reports_the_runtime(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["runtime"] == "babel_esm"


class TestRunnerShell:
    def test_serves_generated_html(self):
        res = client.get("/runner/")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/html")

    def test_is_not_cached(self):
        # The import map and parent origins are environment dependent.
        assert client.get("/runner/").headers.get("cache-control") == "no-store"

    def test_serves_the_bridge_and_the_runner_next_to_it(self):
        assert client.get("/runner/bridge.js").status_code == 200
        assert client.get("/runner/runner.js").status_code == 200

    def test_the_bridge_never_broadcasts_to_a_wildcard_origin(self):
        source = client.get("/runner/bridge.js").text
        assert ', "*")' not in source
        assert "isAllowedOrigin(ev.origin)" in source


class TestRuntimePackages:
    def test_exposes_the_manifest(self):
        res = client.get("/plugins/runtime-packages")
        assert res.status_code == 200
        body = res.json()
        assert "react" in body["packages"]
        assert "react" in body["browser"]

    def test_excludes_backend_sdks(self):
        packages = client.get("/plugins/runtime-packages").json()["packages"]
        for forbidden in ("firebase", "@supabase/supabase-js", "stripe"):
            assert forbidden not in packages


class TestConnectorsAreGone:
    """The product is frontend-only: no connector or site-gateway route may exist."""

    def test_no_connector_routes(self):
        paths = {getattr(r, "path", "") for r in app.routes}
        assert not [p for p in paths if p.startswith("/connectors")]

    def test_no_site_gateway_routes(self):
        paths = {getattr(r, "path", "") for r in app.routes}
        assert "/v1/email/send" not in paths
        assert "/v1/storage/upload" not in paths

    def test_no_vite_preview_proxy(self):
        paths = {getattr(r, "path", "") for r in app.routes}
        assert not [p for p in paths if p.startswith("/preview/")]
