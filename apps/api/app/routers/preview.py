from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.schemas import PreviewStatus
from app.services import preview as preview_service

router = APIRouter(tags=["preview"])


def _owned(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


@router.get("/projects/{project_id}/preview", response_model=PreviewStatus)
def preview_status(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    project = _owned(db, user, project_id, resolve_locale(request))
    public_url = get_settings().preview_url_for_slug(project.slug)
    running = preview_service.get_preview(str(project_id))
    if running:
        if not project.preview_running or project.preview_port != running.port:
            project.preview_running = True
            project.preview_port = running.port
            db.commit()
        return PreviewStatus(
            running=True,
            port=running.port,
            url=f"/preview/{project_id}/",
            public_url=public_url,
        )
    # Process missing (API restart / crash) — do not trust a stale DB flag.
    if project.preview_running:
        project.preview_running = False
        db.commit()
    return PreviewStatus(
        running=False,
        port=project.preview_port,
        url=None,
        public_url=public_url,
    )


@router.post("/projects/{project_id}/preview/start", response_model=PreviewStatus)
async def preview_start(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    try:
        proc = await preview_service.start_preview(str(project_id), project.preview_port)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc) or t("preview_failed", locale)) from exc
    project.preview_port = proc.port
    project.preview_running = True
    db.commit()
    return PreviewStatus(
        running=True,
        port=proc.port,
        url=f"/preview/{project_id}/",
        public_url=get_settings().preview_url_for_slug(project.slug),
    )


@router.post("/projects/{project_id}/preview/stop", response_model=PreviewStatus)
def preview_stop(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    project = _owned(db, user, project_id, resolve_locale(request))
    preview_service.stop_preview(str(project_id))
    project.preview_running = False
    db.commit()
    return PreviewStatus(
        running=False,
        port=project.preview_port,
        url=None,
        public_url=get_settings().preview_url_for_slug(project.slug),
    )


FORGE_EDIT_BRIDGE = b"""
<script id="forge-edit-bridge">
(function () {
  if (window.__forgeEditBridge) return;
  window.__forgeEditBridge = true;
  var TOOL = null;
  var EDITING = null;
  var ORIG = "";
  var HOVER = null;
  var SELECTED = null;
  var STYLE_ID = "forge-edit-style";
  var REF_SEQ = 0;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "body.forge-tool-select [data-forge-hover],body.forge-tool-comment [data-forge-hover],body.forge-tool-image [data-forge-hover]{outline:2px solid #3b82f6!important;outline-offset:2px;cursor:crosshair}" +
      "body.forge-tool-select [data-forge-selected],body.forge-tool-comment [data-forge-selected],body.forge-tool-image [data-forge-selected]{outline:2px solid #2563eb!important;outline-offset:2px}" +
      ".forge-sel-label{position:absolute;z-index:2147483646;background:#2563eb;color:#fff;font:11px/1.2 ui-sans-serif,system-ui,sans-serif;padding:2px 6px;border-radius:4px;pointer-events:none;transform:translateY(4px)}" +
      "body.forge-tool-text [data-forge-editable]{outline:1px dashed rgba(242,98,10,.45);outline-offset:2px;cursor:text}" +
      "body.forge-tool-text [data-forge-editing]{outline:2px solid #f2620a!important;outline-offset:2px;background:rgba(242,98,10,.08)}" +
      "body.forge-tool-image img{cursor:crosshair}" +
      "body[class*=forge-tool-] a,body[class*=forge-tool-] button{pointer-events:auto}";
    document.head.appendChild(s);
  }

  function clearHover() {
    if (HOVER) {
      HOVER.removeAttribute("data-forge-hover");
      HOVER = null;
    }
    var lab = document.getElementById("forge-sel-label");
    if (lab) lab.remove();
  }

  function clearSelected() {
    if (SELECTED) {
      SELECTED.removeAttribute("data-forge-selected");
      SELECTED = null;
    }
  }

  function showLabel(el, text) {
    var lab = document.getElementById("forge-sel-label");
    if (!lab) {
      lab = document.createElement("div");
      lab.id = "forge-sel-label";
      lab.className = "forge-sel-label";
      document.body.appendChild(lab);
    }
    var r = el.getBoundingClientRect();
    lab.textContent = text;
    lab.style.left = Math.max(4, r.left + window.scrollX) + "px";
    lab.style.top = Math.max(4, r.bottom + window.scrollY) + "px";
  }

  function ensureRef(el) {
    var existing = el.getAttribute("data-forge-ref");
    if (existing) return existing;
    REF_SEQ += 1;
    var ref = "f" + REF_SEQ + "-" + Date.now().toString(36);
    el.setAttribute("data-forge-ref", ref);
    return ref;
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) {
      var safeId = el.id;
      try { safeId = CSS.escape(el.id); } catch (e) {}
      return "#" + safeId;
    }
    var ref = ensureRef(el);
    return '[data-forge-ref="' + ref + '"]';
  }

  function describe(el) {
    var tag = (el.tagName || "").toLowerCase();
    var id = el.id || null;
    var className = (typeof el.className === "string" ? el.className : "").trim() || null;
    var text = (el.innerText || el.alt || "").trim().replace(/\\s+/g, " ").slice(0, 80);
    return {
      tag: tag,
      id: id,
      className: className,
      selector: buildSelector(el),
      text: text
    };
  }

  function isEditableTarget(el) {
    if (!el || el.nodeType !== 1) return null;
    var tag = el.tagName;
    if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|SVG|PATH|IMG|VIDEO|CANVAS|CODE|PRE)$/i.test(tag)) return null;
    var cur = el;
    for (var i = 0; i < 4 && cur; i++) {
      if (/^(H1|H2|H3|H4|H5|H6|P|SPAN|A|BUTTON|LI|LABEL|STRONG|EM|B|I|SMALL|DIV)$/i.test(cur.tagName)) {
        var text = (cur.innerText || "").trim().replace(/\\s+/g, " ");
        if (text.length >= 2 && !/^\\d+([.,]\\d+)?%?$/.test(text) && cur.children.length <= 3) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function pickTarget(el, tool) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id === "forge-sel-label" || el.closest && el.closest("#forge-sel-label")) return null;
    if (tool === "image") {
      var img = el.closest ? el.closest("img") : null;
      if (!img && el.tagName === "IMG") img = el;
      return img || null;
    }
    if (tool === "text") return isEditableTarget(el);
    var cur = el;
    for (var i = 0; i < 6 && cur && cur !== document.body; i++) {
      if (/^(SCRIPT|STYLE|HTML|BODY|HEAD)$/i.test(cur.tagName)) break;
      if (cur.tagName === "IMG" && tool !== "select" && tool !== "comment") break;
      return cur;
    }
    return el;
  }

  function markTextCandidates() {
    var nodes = document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,a,button,li,label,strong,em");
    nodes.forEach(function (n) {
      var text = (n.innerText || "").trim();
      if (text.length >= 2) n.setAttribute("data-forge-editable", "1");
    });
  }

  function setTool(next) {
    ensureStyle();
    if (EDITING) finishEdit(false);
    clearHover();
    clearSelected();
    document.body.classList.remove(
      "forge-tool-select",
      "forge-tool-text",
      "forge-tool-comment",
      "forge-tool-image",
      "forge-edit-mode"
    );
    document.querySelectorAll("[data-forge-editable],[data-forge-editing]").forEach(function (n) {
      n.removeAttribute("data-forge-editable");
      n.removeAttribute("data-forge-editing");
      n.contentEditable = "false";
    });
    TOOL = next || null;
    if (!TOOL) return;
    document.body.classList.add("forge-tool-" + TOOL);
    if (TOOL === "text") {
      document.body.classList.add("forge-edit-mode");
      markTextCandidates();
    }
  }

  function finishEdit(save) {
    if (!EDITING) return;
    var el = EDITING;
    var next = (el.innerText || "").trim().replace(/\\s+/g, " ");
    el.contentEditable = "false";
    el.removeAttribute("data-forge-editing");
    EDITING = null;
    if (save && next && next !== ORIG) {
      try {
        window.parent.postMessage(
          { type: "forge-visual-edit", oldText: ORIG, newText: next },
          "*"
        );
      } catch (e) {}
    } else if (!save) {
      el.innerText = ORIG;
    }
  }

  function startTextEdit(target) {
    if (EDITING && EDITING !== target) finishEdit(true);
    ORIG = (target.innerText || "").trim().replace(/\\s+/g, " ");
    if (ORIG.length < 2) return;
    EDITING = target;
    target.setAttribute("data-forge-editing", "1");
    target.contentEditable = "true";
    target.focus();
    try {
      var range = document.createRange();
      range.selectNodeContents(target);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) {}
  }

  document.addEventListener(
    "mouseover",
    function (e) {
      if (!TOOL || TOOL === "text") return;
      var target = pickTarget(e.target, TOOL);
      if (!target || target === HOVER) return;
      clearHover();
      HOVER = target;
      target.setAttribute("data-forge-hover", "1");
      showLabel(target, (target.tagName || "").toLowerCase());
    },
    true
  );

  document.addEventListener(
    "mouseout",
    function (e) {
      if (!TOOL || TOOL === "text") return;
      if (HOVER && e.target === HOVER) clearHover();
    },
    true
  );

  document.addEventListener(
    "click",
    function (e) {
      if (!TOOL) return;
      if (TOOL === "text") {
        var textTarget = isEditableTarget(e.target);
        if (!textTarget) return;
        e.preventDefault();
        e.stopPropagation();
        startTextEdit(textTarget);
        return;
      }
      var target = pickTarget(e.target, TOOL);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      clearSelected();
      SELECTED = target;
      target.setAttribute("data-forge-selected", "1");
      var info = describe(target);
      showLabel(target, info.tag);
      try {
        if (TOOL === "select") {
          window.parent.postMessage({
            type: "forge-element-select",
            tag: info.tag,
            id: info.id,
            className: info.className,
            selector: info.selector,
            text: info.text
          }, "*");
        } else if (TOOL === "comment") {
          window.parent.postMessage({
            type: "forge-comment-anchor",
            tag: info.tag,
            id: info.id,
            className: info.className,
            selector: info.selector,
            text: info.text
          }, "*");
        } else if (TOOL === "image") {
          window.parent.postMessage(
            {
              type: "forge-image-select",
              src: target.getAttribute("src") || "",
              alt: target.getAttribute("alt") || "",
              selector: info.selector
            },
            "*"
          );
        }
      } catch (err) {}
    },
    true
  );

  document.addEventListener(
    "dblclick",
    function (e) {
      if (TOOL !== "text") return;
      var target = isEditableTarget(e.target);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      startTextEdit(target);
    },
    true
  );

  document.addEventListener(
    "keydown",
    function (e) {
      if (!EDITING) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finishEdit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishEdit(false);
      }
    },
    true
  );

  document.addEventListener(
    "focusout",
    function (e) {
      if (!EDITING) return;
      if (e.target === EDITING) {
        setTimeout(function () {
          if (EDITING && document.activeElement !== EDITING) finishEdit(true);
        }, 0);
      }
    },
    true
  );

  window.addEventListener("message", function (ev) {
    var data = ev && ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "forge-tool-mode") {
      setTool(data.tool || null);
    } else if (data.type === "forge-edit-mode") {
      setTool(data.enabled ? "text" : null);
    }
  });

  ensureStyle();
})();
</script>
"""


@router.api_route("/preview/{project_id}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
@router.api_route("/preview/{project_id}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def preview_proxy(project_id: UUID, request: Request, path: str = "") -> Response:
    locale = resolve_locale(request)
    proc = preview_service.get_preview(str(project_id))
    if proc is None:
        raise HTTPException(status_code=404, detail=t("preview_not_running", locale))

    # Vite is started with base=/preview/{id}/ — upstream expects that prefix too.
    target_path = (path or "").lstrip("/")
    upstream_path = f"/preview/{project_id}/{target_path}" if target_path else f"/preview/{project_id}/"
    query = request.url.query
    url = f"http://127.0.0.1:{proc.port}{upstream_path}"
    if query:
        url = f"{url}?{query}"

    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}
    body = await request.body()

    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        upstream = await client.request(request.method, url, headers=headers, content=body)

    excluded = {
        "content-encoding",
        "transfer-encoding",
        "content-length",
        "connection",
        "x-frame-options",
        "content-security-policy",
    }
    response_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in excluded}
    # Forge UI (e.g. :3100) embeds the API preview (:8100) in an iframe.
    response_headers["Content-Security-Policy"] = "frame-ancestors *"

    content = upstream.content
    content_type = upstream.headers.get("content-type", "")
    if "text/html" in content_type:
        prefix = f"/preview/{project_id}".encode()
        # Safety net if Vite base was not applied (legacy configs).
        content = (
            content.replace(b'src="/@', b'src="' + prefix + b'/@')
            .replace(b"src='/@", b"src='" + prefix + b'/@')
            .replace(b'href="/@', b'href="' + prefix + b'/@')
            .replace(b'from "/@', b'from "' + prefix + b'/@')
            .replace(b"from '/@", b"from '" + prefix + b"/@")
            .replace(b'src="/src/', b'src="' + prefix + b'/src/')
            .replace(b"src='/src/", b"src='" + prefix + b"/src/")
        )
        # Inject visual-edit bridge once (before </body> or at end).
        if b"forge-edit-bridge" not in content:
            lower = content.lower()
            idx = lower.rfind(b"</body>")
            if idx >= 0:
                content = content[:idx] + FORGE_EDIT_BRIDGE + content[idx:]
            else:
                content = content + FORGE_EDIT_BRIDGE

    return Response(content=content, status_code=upstream.status_code, headers=response_headers)


@router.api_route("/preview-by-slug/{slug}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
@router.api_route("/preview-by-slug/{slug}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def preview_by_slug(slug: str, request: Request, path: str = "", db: Session = Depends(get_db)) -> Response:
    project = db.query(Project).filter(Project.slug == slug).first()
    if project is None:
        raise HTTPException(status_code=404, detail=t("project_not_found", resolve_locale(request)))
    return await preview_proxy(project.id, request, path)
