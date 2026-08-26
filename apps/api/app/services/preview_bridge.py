"""Visual edit bridge injected into preview HTML."""

FORGE_EDIT_BRIDGE = b"""
<script id="forge-edit-bridge">
(function () {
  if (window.__forgeEditBridge) return;
  window.__forgeEditBridge = true;
  var TOOL = null;
  var EDITING = null;
  var ORIG = "";
  var STYLE_BACKUP = null;
  var HOVER = null;
  var SELECTED = null;
  var STYLE_ID = "forge-edit-style";
  var REF_SEQ = 0;
  var LAST_CLICK = null;
  var OBSERVER = null;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "body.forge-tool-select [data-forge-hover],body.forge-tool-comment [data-forge-hover],body.forge-tool-image [data-forge-hover]{outline:2px solid #3b82f6!important;outline-offset:2px;cursor:crosshair}" +
      "body.forge-tool-select [data-forge-selected],body.forge-tool-comment [data-forge-selected],body.forge-tool-image [data-forge-selected]{outline:2px solid #2563eb!important;outline-offset:2px}" +
      ".forge-sel-label{position:absolute;z-index:2147483646;background:#2563eb;color:#fff;font:11px/1.2 ui-sans-serif,system-ui,sans-serif;padding:2px 6px;border-radius:4px;pointer-events:none;transform:translateY(4px)}" +
      "body.forge-tool-text [data-forge-editable]{outline:1px dashed rgba(242,98,10,.45);outline-offset:2px;cursor:text}" +
      "body.forge-tool-text [data-forge-editing]{outline:2px solid #f2620a!important;outline-offset:2px;caret-color:currentColor!important}" +
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
    for (var i = 0; i < 8 && cur; i++) {
      if (/^(H1|H2|H3|H4|H5|H6|P|SPAN|A|BUTTON|LI|LABEL|STRONG|EM|B|I|SMALL|DIV|FIGCAPTION|BLOCKQUOTE|TD|TH|ARTICLE|SECTION|NAV|HEADER|FOOTER|MAIN|HGROUP)$/i.test(cur.tagName)) {
        var text = (cur.innerText || "").trim().replace(/\\s+/g, " ");
        if (text.length >= 1 && !/^\\d+([.,]\\d+)?%?$/.test(text) && cur.children.length <= 12) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function notifyEditMiss(reason) {
    try {
      window.parent.postMessage({ type: "forge-edit-miss", reason: reason || "not-editable" }, "*");
    } catch (e) {}
  }

  function pickTarget(el, tool) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id === "forge-sel-label" || (el.closest && el.closest("#forge-sel-label"))) return null;
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
    var nodes = document.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,span,a,button,li,label,strong,em,figcaption,blockquote,td,th,article,section,nav,header,footer,main,hgroup"
    );
    nodes.forEach(function (n) {
      var text = (n.innerText || "").trim();
      if (text.length >= 1) n.setAttribute("data-forge-editable", "1");
    });
  }

  function stopObserver() {
    if (OBSERVER) {
      OBSERVER.disconnect();
      OBSERVER = null;
    }
  }

  function startObserver() {
    stopObserver();
    if (!document.body) return;
    OBSERVER = new MutationObserver(function () {
      if (TOOL === "text" && !EDITING) markTextCandidates();
    });
    OBSERVER.observe(document.body, { childList: true, subtree: true });
  }

  function ackTool(tool) {
    try {
      window.parent.postMessage({ type: "forge-tool-ack", tool: tool || null }, "*");
    } catch (e) {}
  }

  function notifyReady() {
    try {
      window.parent.postMessage({ type: "forge-tool-ready", tool: TOOL }, "*");
    } catch (e) {}
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
    stopObserver();
    if (!TOOL) {
      ackTool(null);
      return;
    }
    document.body.classList.add("forge-tool-" + TOOL);
    if (TOOL === "text") {
      document.body.classList.add("forge-edit-mode");
      markTextCandidates();
      startObserver();
    }
    ackTool(TOOL);
  }

  function restoreStyle(el) {
    if (!el || !STYLE_BACKUP) return;
    el.style.color = STYLE_BACKUP.color;
    el.style.caretColor = STYLE_BACKUP.caretColor;
    el.style.webkitTextFillColor = STYLE_BACKUP.fill;
    STYLE_BACKUP = null;
  }

  function finishEdit(save) {
    if (!EDITING) return;
    var el = EDITING;
    var next = (el.innerText || "").trim().replace(/\\s+/g, " ");
    el.contentEditable = "false";
    el.removeAttribute("data-forge-editing");
    restoreStyle(el);
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

  function placeCaretFromClick(target) {
    try {
      var sel = window.getSelection();
      sel.removeAllRanges();
      if (LAST_CLICK && document.caretRangeFromPoint) {
        var range = document.caretRangeFromPoint(LAST_CLICK.x, LAST_CLICK.y);
        if (range && target.contains(range.startContainer)) {
          sel.addRange(range);
          return;
        }
      }
      if (LAST_CLICK && document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(LAST_CLICK.x, LAST_CLICK.y);
        if (pos && target.contains(pos.offsetNode)) {
          var r2 = document.createRange();
          r2.setStart(pos.offsetNode, pos.offset);
          r2.collapse(true);
          sel.addRange(r2);
          return;
        }
      }
      // Fallback: caret at end (do not select all).
      var end = document.createRange();
      end.selectNodeContents(target);
      end.collapse(false);
      sel.addRange(end);
    } catch (err) {}
  }

  function startTextEdit(target) {
    if (EDITING && EDITING !== target) finishEdit(true);
    ORIG = (target.innerText || "").trim().replace(/\\s+/g, " ");
    if (ORIG.length < 1) return;
    EDITING = target;
    var cs = window.getComputedStyle(target);
    var color = cs.color || "#111";
    STYLE_BACKUP = {
      color: target.style.color || "",
      caretColor: target.style.caretColor || "",
      fill: target.style.webkitTextFillColor || ""
    };
    target.style.color = color;
    target.style.caretColor = color;
    target.style.webkitTextFillColor = color;
    target.setAttribute("data-forge-editing", "1");
    target.contentEditable = "true";
    target.focus();
    placeCaretFromClick(target);
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
    "mousedown",
    function (e) {
      if (TOOL !== "text") return;
      LAST_CLICK = { x: e.clientX, y: e.clientY };
    },
    true
  );

  document.addEventListener(
    "click",
    function (e) {
      if (!TOOL) return;
      if (TOOL === "text") {
        var textTarget = isEditableTarget(e.target);
        if (!textTarget) {
          notifyEditMiss("not-editable");
          return;
        }
        if (EDITING === textTarget) return;
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
    } else if (data.type === "forge-tool-ping") {
      notifyReady();
      ackTool(TOOL);
    } else if (data.type === "forge-preview-navigate") {
      navigatePreviewPath(typeof data.path === "string" ? data.path : "/");
    }
  });

  function navigatePreviewPath(path) {
    var normalized = (path || "/").replace(/\/+$/, "") || "/";
    var segment = normalized === "/" ? "home" : normalized.replace(/^\//, "").toLowerCase();
    var navButtons = document.querySelectorAll(
      ".nav-links-desktop .nav-link-item, .nav-mobile-menu .nav-mobile-link, [data-forge-page]"
    );
    for (var i = 0; i < navButtons.length; i++) {
      var btn = navButtons[i];
      var forgePage = btn.getAttribute("data-forge-page");
      if (forgePage && forgePage.toLowerCase() === segment) {
        btn.click();
        return;
      }
      var text = (btn.textContent || "").trim().toLowerCase();
      if (segment === "home" && (text === "accueil" || text.indexOf("home") >= 0)) {
        btn.click();
        return;
      }
      if (segment === "about" && (text.indexOf("propos") >= 0 || text === "about")) {
        btn.click();
        return;
      }
    }
  }

  ensureStyle();
  notifyReady();
})();
</script>
"""
