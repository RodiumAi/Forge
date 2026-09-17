"""Hermetic coverage for Playwright URL-capture network containment."""

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace

from app.services import url_capture
from app.services.net_guard import BlockedURLError, ValidatedTarget


@dataclass
class _Request:
    url: str
    headers: dict[str, str]
    method: str = "GET"


class _Route:
    def __init__(self, url: str):
        self.request = _Request(url, {"accept": "text/html"})
        self.aborted = False
        self.fulfilled: tuple[int, dict[str, str], bytes] | None = None

    def abort(self) -> None:
        self.aborted = True

    def fulfill(self, *, status: int, headers: dict[str, str], body: bytes) -> None:
        self.fulfilled = (status, headers, body)


class _WebSocketRoute:
    def __init__(self):
        self.closed: tuple[int | None, str | None] | None = None

    def close(self, *, code=None, reason=None) -> None:
        self.closed = (code, reason)


class _Page:
    def __init__(self, context, *, opener=None, primary=False):
        self._context = context
        self._opener = opener
        self.primary = primary
        self.closed = False
        self.goto_urls: list[str] = []

    def opener(self):
        return self._opener

    def route(self, *_args, **_kwargs) -> None:
        raise AssertionError("page.route must never be used")

    def set_viewport_size(self, _viewport) -> None:
        pass

    def goto(self, url: str, **_kwargs) -> None:
        self.goto_urls.append(url)
        route = _Route(url)
        self._context.http_handler(route)
        self._context.navigation_routes.append(route)

        popup = _Page(self._context, opener=self)
        self._context.popups.append(popup)
        self._context.page_handler(popup)

        private_route = _Route("http://127.0.0.1/admin")
        self._context.http_handler(private_route)
        self._context.private_routes.append(private_route)

        if self._context.websocket_handler is not None:
            websocket = _WebSocketRoute()
            self._context.websocket_handler(websocket)
            self._context.websockets.append(websocket)

    def wait_for_load_state(self, *_args, **_kwargs) -> None:
        pass

    def screenshot(self, **_kwargs) -> bytes:
        return b"png"

    def close(self) -> None:
        self.closed = True


class _Context:
    def __init__(self, events: list[str]):
        self.events = events
        self.http_handler = None
        self.websocket_handler = None
        self.page_handler = None
        self.pages: list[_Page] = []
        self.popups: list[_Page] = []
        self.navigation_routes: list[_Route] = []
        self.private_routes: list[_Route] = []
        self.websockets: list[_WebSocketRoute] = []

    def route(self, pattern, handler) -> None:
        assert pattern == "**/*"
        self.events.append("context.route")
        self.http_handler = handler

    def route_web_socket(self, pattern, handler) -> None:
        assert pattern == "**/*"
        self.events.append("context.route_web_socket")
        self.websocket_handler = handler

    def on(self, event, handler) -> None:
        assert event == "page"
        self.events.append("context.on.page")
        self.page_handler = handler

    def new_page(self) -> _Page:
        assert self.http_handler is not None
        self.events.append("context.new_page")
        page = _Page(self, primary=True)
        self.pages.append(page)
        if self.page_handler is not None:
            self.page_handler(page)
        return page

    def close(self) -> None:
        pass


class _Browser:
    def __init__(self, events: list[str]):
        self.events = events
        self.context = _Context(events)
        self.context_options = None

    def new_context(self, **kwargs) -> _Context:
        self.context_options = kwargs
        return self.context

    def close(self) -> None:
        pass


class _Chromium:
    def __init__(self, browser: _Browser):
        self.browser = browser

    def launch(self, *, headless: bool) -> _Browser:
        assert headless is True
        return self.browser


class _Playwright:
    def __init__(self, browser: _Browser):
        self.chromium = _Chromium(browser)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None


def test_capture_installs_context_guards_before_pages(monkeypatch):
    original_url = "https://public.example/start"
    events: list[str] = []
    browser = _Browser(events)

    def resolve(url: str) -> ValidatedTarget:
        if url.startswith("http://127.0.0.1"):
            raise BlockedURLError()
        return ValidatedTarget(
            url=url,
            scheme="https",
            host="public.example",
            port=443,
            ip="93.184.216.34",
        )

    monkeypatch.setattr(url_capture, "resolve_and_validate", resolve)
    monkeypatch.setattr(
        url_capture,
        "httpx_get_pinned_sync",
        lambda _client, _target, *, headers: SimpleNamespace(
            status_code=200,
            headers={
                "content-type": "text/html",
                "content-encoding": "gzip",
                "content-length": "999",
            },
            content=b"<html>safe</html>",
        ),
    )
    monkeypatch.setattr(
        "playwright.sync_api.sync_playwright",
        lambda: _Playwright(browser),
    )

    shots = url_capture._capture_sync(original_url)

    assert shots == [("desktop", b"png"), ("mobile", b"png")]
    first_page = events.index("context.new_page")
    assert events.index("context.route") < first_page
    assert events.index("context.route_web_socket") < first_page
    assert events.index("context.on.page") < first_page
    assert browser.context_options == {
        "ignore_https_errors": True,
        "service_workers": "block",
        "accept_downloads": False,
    }

    assert [page.goto_urls for page in browser.context.pages] == [
        [original_url],
        [original_url],
    ]
    assert all(page.closed for page in browser.context.pages)
    assert all(popup.closed for popup in browser.context.popups)

    for route in browser.context.navigation_routes:
        assert route.aborted is False
        assert route.fulfilled == (
            200,
            {"content-type": "text/html"},
            b"<html>safe</html>",
        )

    assert all(route.aborted for route in browser.context.private_routes)
    assert all(route.fulfilled is None for route in browser.context.private_routes)
    assert all(
        websocket.closed == (1008, "WebSockets are disabled during URL capture")
        for websocket in browser.context.websockets
    )
