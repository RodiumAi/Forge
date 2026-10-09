"""Sites gateway host resolution."""

from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import sites_v1
from app.routers.sites_v1 import clear_resolve_cache

client = TestClient(app)

LOOKUP = "app.routers.sites_v1._lookup_slug"
ENDPOINTS = ["/v1/resolve-host", "/v1/authorize-host"]
HOST_HEADER = {"X-Rodium-Forwarded-Host": "www.client.com"}


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_resolve_cache()
    yield
    clear_resolve_cache()


def test_resolve_host_json():
    with patch("app.routers.sites_v1._lookup_slug", return_value="acme"):
        res = client.get(
            "/v1/resolve-host",
            headers={"X-Rodium-Forwarded-Host": "www.client.com"},
        )
    assert res.status_code == 200
    assert res.json() == {"slug": "acme", "bucket_prefix": "acme/"}


def test_resolve_host_unknown():
    with patch("app.routers.sites_v1._lookup_slug", return_value=None):
        res = client.get(
            "/v1/resolve-host",
            headers={"X-Rodium-Forwarded-Host": "unknown.example.com"},
        )
    assert res.status_code == 404


def test_authorize_host_sets_slug_header():
    with patch("app.routers.sites_v1._lookup_slug", return_value="acme"):
        res = client.get(
            "/v1/authorize-host",
            headers={"X-Rodium-Forwarded-Host": "www.client.com"},
        )
    assert res.status_code == 200
    assert res.headers.get("x-site-slug") == "acme"


def test_authorize_host_unknown_404():
    with patch("app.routers.sites_v1._lookup_slug", return_value=None):
        res = client.get(
            "/v1/authorize-host",
            headers={"X-Rodium-Forwarded-Host": "nope.example.com"},
        )
    assert res.status_code == 404


def test_resolve_host_missing_header():
    res = client.get("/v1/resolve-host")
    assert res.status_code == 400


def test_authorize_host_missing_header():
    res = client.get("/v1/authorize-host")
    assert res.status_code == 400


# ── The forwarded host is validated before anything uses it ────────────────


INVALID_HOSTS = [
    "a" * 64 + ".example.com",  # label over 63 characters
    "-bad.example.com",  # leading hyphen
    "bad-.example.com",  # trailing hyphen
    "under_score.example.com",  # not a hostname character
    "exa mple.com",  # space
    "exa%6dple.com",  # percent-escape
    "a..example.com",  # empty label
    "[::1]",  # bracketed IPv6 literal
    "x" * 254,  # over 253 characters overall
    ".".join(["a" * 63] * 4),  # 255 characters, every label individually valid
    "a" * 20_000 + ".example.com",  # far past any header a real client sends
]

# (what the gateway sends, what is looked up)
VALID_HOSTS = [
    ("www.client.com", "www.client.com"),
    ("www.client.com.", "www.client.com"),  # trailing dot (FQDN form)
    ("WWW.Client.COM", "www.client.com"),  # case-insensitive
    ("www.client.com:8443", "www.client.com"),  # port is dropped
    ("xn--bcher-kva.example", "xn--bcher-kva.example"),  # punycode
    ("1-2.example.com", "1-2.example.com"),
    ("a" * 63 + ".example.com", "a" * 63 + ".example.com"),  # longest legal label
    (".".join(["a" * 63] * 3 + ["a" * 61]), ".".join(["a" * 63] * 3 + ["a" * 61])),  # exactly 253 characters
]


class TestHostnameValidation:
    @pytest.mark.parametrize("host", INVALID_HOSTS, ids=lambda h: h[:24])
    @pytest.mark.parametrize("path", ENDPOINTS)
    def test_a_malformed_host_is_a_plain_404_that_touches_nothing(self, path, host):
        with patch(LOOKUP) as lookup:
            res = client.get(path, headers={"X-Rodium-Forwarded-Host": host})

        assert res.status_code == 404
        assert res.json()["detail"] == "unknown_host"  # same answer as an unknown host
        lookup.assert_not_called()  # no database query
        assert len(sites_v1._cache) == 0  # no cache write

    @pytest.mark.parametrize(("sent", "looked_up"), VALID_HOSTS, ids=lambda h: h[:24])
    @pytest.mark.parametrize("path", ENDPOINTS)
    def test_a_well_formed_host_is_normalised_and_resolved(self, path, sent, looked_up):
        with patch(LOOKUP, return_value="acme") as lookup:
            res = client.get(path, headers={"X-Rodium-Forwarded-Host": sent})

        assert res.status_code == 200
        lookup.assert_called_once_with(looked_up)


# ── The cache is bounded, keeps its TTL, and can still be cleared ──────────


@pytest.fixture
def clock(monkeypatch):
    """A controllable monotonic clock for the module under test only."""
    now = [1000.0]
    monkeypatch.setattr(sites_v1, "time", SimpleNamespace(monotonic=lambda: now[0]))
    return now


class TestBoundedCache:
    def test_a_flood_of_distinct_hosts_cannot_grow_it_past_the_limit(self):
        with patch(LOOKUP, return_value=None) as lookup:
            for i in range(5000):
                sites_v1._resolve_slug(f"h{i}.attacker.example")

        assert lookup.call_count == 5000  # each was new, so each was looked up once
        assert len(sites_v1._cache) == sites_v1._CACHE_MAX_ENTRIES == 2048

    def test_the_least_recently_used_host_is_the_one_dropped(self, monkeypatch):
        monkeypatch.setattr(sites_v1, "_CACHE_MAX_ENTRIES", 3)
        with patch(LOOKUP, return_value="acme"):
            for host in ("a.example", "b.example", "c.example"):
                sites_v1._resolve_slug(host)
            sites_v1._resolve_slug("a.example")  # a is used again, so b is now the oldest
            sites_v1._resolve_slug("d.example")

        assert set(sites_v1._cache) == {"a.example", "c.example", "d.example"}

    def test_concurrent_requests_keep_it_bounded_and_error_free(self, monkeypatch):
        monkeypatch.setattr(sites_v1, "_CACHE_MAX_ENTRIES", 64)

        def burst(start):
            for i in range(start, start + 400):
                sites_v1._resolve_slug(f"h{i}.example")

        with patch(LOOKUP, return_value=None), ThreadPoolExecutor(8) as pool:
            list(pool.map(burst, range(0, 3200, 400)))  # list() re-raises any worker error

        assert len(sites_v1._cache) <= 64


class TestCacheTtl:
    def test_an_entry_is_reused_for_60_seconds_then_looked_up_again(self, clock):
        with patch(LOOKUP, return_value="acme") as lookup:
            assert sites_v1._resolve_slug("www.client.com") == "acme"
            clock[0] += 59
            assert sites_v1._resolve_slug("www.client.com") == "acme"
            assert lookup.call_count == 1

            clock[0] += 2  # 61 seconds after the first lookup
            assert sites_v1._resolve_slug("www.client.com") == "acme"
            assert lookup.call_count == 2

    def test_an_unknown_host_is_cached_too(self, clock):
        with patch(LOOKUP, return_value=None) as lookup:
            assert sites_v1._resolve_slug("nope.example") is None
            assert sites_v1._resolve_slug("nope.example") is None
        assert lookup.call_count == 1

    def test_a_database_error_serves_the_stale_entry(self, clock):
        with patch(LOOKUP, return_value="acme"):
            sites_v1._resolve_slug("www.client.com")
        clock[0] += 61

        with patch(LOOKUP, side_effect=RuntimeError("database down")):
            assert sites_v1._resolve_slug("www.client.com") == "acme"
            assert sites_v1._resolve_slug("never-seen.example") is None
        assert "never-seen.example" not in sites_v1._cache


class TestClearResolveCache:
    def test_one_host_can_be_dropped_and_is_then_looked_up_again(self):
        with patch(LOOKUP, return_value="acme") as lookup:
            sites_v1._resolve_slug("a.example")
            sites_v1._resolve_slug("b.example")

            clear_resolve_cache("A.Example")  # case-insensitive, as before
            assert set(sites_v1._cache) == {"b.example"}

            sites_v1._resolve_slug("a.example")
            assert lookup.call_count == 3

    def test_everything_can_be_dropped(self):
        with patch(LOOKUP, return_value="acme"):
            sites_v1._resolve_slug("a.example")
            sites_v1._resolve_slug("b.example")

        clear_resolve_cache()

        assert len(sites_v1._cache) == 0

    def test_clearing_a_host_that_is_not_cached_is_harmless(self):
        clear_resolve_cache("never-cached.example")


# ── Rate limiting ──────────────────────────────────────────────────────────


class TestResolveHostRateLimit:
    def test_the_61st_request_in_a_minute_is_refused(self):
        with patch(LOOKUP, return_value="acme"):
            statuses = [client.get("/v1/resolve-host", headers=HOST_HEADER).status_code for _ in range(61)]

        assert statuses == [200] * 60 + [429]

    def test_each_address_has_its_own_budget(self):
        other_address = TestClient(app, client=("203.0.113.9", 4321))
        with patch(LOOKUP, return_value="acme"):
            for _ in range(61):
                client.get("/v1/resolve-host", headers=HOST_HEADER)
            res = other_address.get("/v1/resolve-host", headers=HOST_HEADER)

        assert res.status_code == 200

    def test_malformed_hosts_count_against_the_limit(self):
        # The limit runs before validation, so a flood of junk is throttled too.
        bad = {"X-Rodium-Forwarded-Host": "-bad.example.com"}
        statuses = [client.get("/v1/resolve-host", headers=bad).status_code for _ in range(61)]

        assert statuses == [404] * 60 + [429]


class TestAuthorizeHostIsNotRateLimitedPerIp:
    def test_the_gateway_can_call_it_for_every_request_it_serves(self):
        # Caddy calls this for each request to a custom domain, and all of it
        # reaches the API from the gateway's one address: a per-IP limit here
        # would throttle every custom domain together.
        with patch(LOOKUP, return_value="acme"):
            statuses = {client.get("/v1/authorize-host", headers=HOST_HEADER).status_code for _ in range(200)}

        assert statuses == {200}
