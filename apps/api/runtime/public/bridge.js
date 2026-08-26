/**
 * Forge visual-edit bridge — runs inside the preview iframe, next to runner.js.
 *
 * It used to be a Python string injected into the generated project's
 * index.html. That file is no longer loaded by the iframe (the Vite proxy that
 * served it is gone), so the bridge silently stopped running and every visual
 * tool became a no-op. It now ships as a real asset of the runner shell.
 *
 * Messaging contract: the parent pins its postMessage target to this iframe's
 * origin, and this side pins replies to the parent origin — never "*".
 */
(function () {
  if (window.__forgeEditBridge) return;
  window.__forgeEditBridge = true;

  var TOOL = null;
  var EDITING = null;
  var ORIG = "";
  var ORIG_HTML = "";
  var STYLE_BACKUP = null;
  var HOVER = null;
  var SELECTED = null;
  var STYLE_ID = "forge-edit-style";
  var REF_SEQ = 0;
  var LAST_CLICK = null;
  var OBSERVER = null;
  var MARK_TIMER = null;

  /* ---------------------------------------------------------------- origin */

  var ALLOWED_ORIGINS = (window.__FORGE_PARENT_ORIGINS || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.indexOf(origin) !== -1;
  }

  // The embedder is the only legitimate peer; derive it from the referrer and
  // keep it only if it is explicitly allowed.
  var PARENT_ORIGIN = (function () {
    try {
      var ref = document.referrer ? new URL(document.referrer).origin : "";
      return isAllowedOrigin(ref) ? ref : "";
    } catch (e) {
      return "";
    }
  })();

  function post(payload) {
    if (!PARENT_ORIGIN) return;
    try {
      window.parent.postMessage(payload, PARENT_ORIGIN);
    } catch (e) {
      /* ignore */
    }
  }

  /* ----------------------------------------------------------------- style */

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "body.forge-tool-select [data-forge-hover],body.forge-tool-comment [data-forge-hover],body.forge-tool-image [data-forge-hover]{outline:2px solid #3b82f6!important;outline-offset:2px;cursor:crosshair}" +
      "body.forge-tool-select [data-forge-selected],body.forge-tool-comment [data-forge-selected],body.forge-tool-image [data-forge-selected]{outline:2px solid #2563eb!important;outline-offset:2px}" +
      ".forge-sel-label{position:fixed;z-index:2147483646;background:#2563eb;color:#fff;font:11px/1.2 ui-sans-serif,system-ui,sans-serif;padding:2px 6px;border-radius:4px;pointer-events:none;transform:translateY(4px)}" +
      "body.forge-tool-text [data-forge-editable]{outline:1px dashed rgba(242,98,10,.45);outline-offset:2px;cursor:text}" +
      "body.forge-tool-text [data-forge-editing]{outline:2px solid #f2620a!important;outline-offset:2px;caret-color:currentColor!important}" +
      "body.forge-tool-image img{cursor:crosshair}";
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
    // position:fixed + viewport rect — the previous absolute + scrollY version
    // mispositioned the label inside any scrollable or transformed ancestor.
    var r = el.getBoundingClientRect();
    lab.textContent = text;
    lab.style.left = Math.max(4, r.left) + "px";
    lab.style.top = Math.max(4, r.bottom) + "px";
  }

  /* -------------------------------------------------------------- selectors */

  function ensureRef(el) {
    var existing = el.getAttribute("data-forge-ref");
    if (existing) return existing;
    REF_SEQ += 1;
    var ref = "f" + REF_SEQ + "-" + Date.now().toString(36);
    el.setAttribute("data-forge-ref", ref);
    return ref;
  }

  /** Structural path, stable across re-renders (unlike data-forge-ref). */
  function structuralSelector(el) {
    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && parts.length < 6) {
      var tag = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (!parent) break;
      var siblings = [];
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].tagName === cur.tagName) siblings.push(parent.children[i]);
      }
      if (siblings.length > 1) {
        tag += ":nth-of-type(" + (siblings.indexOf(cur) + 1) + ")";
      }
      parts.unshift(tag);
      cur = parent;
    }
    return parts.length ? "body > " + parts.join(" > ") : "";
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) {
      var safeId = el.id;
      try { safeId = CSS.escape(el.id); } catch (e) { /* ignore */ }
      return "#" + safeId;
    }
    return structuralSelector(el) || '[data-forge-ref="' + ensureRef(el) + '"]';
  }

  function describe(el) {
    var tag = (el.tagName || "").toLowerCase();
    var className = (typeof el.className === "string" ? el.className : "").trim() || null;
    var text = (el.innerText || el.alt || "").trim().replace(/\s+/g, " ").slice(0, 80);
    return {
      tag: tag,
      id: el.id || null,
      className: className,
      selector: buildSelector(el),
      text: text
    };
  }

  /* --------------------------------------------------------------- targets */

  var EDITABLE_TAGS = /^(H1|H2|H3|H4|H5|H6|P|SPAN|A|BUTTON|LI|LABEL|STRONG|EM|B|I|SMALL|DIV|FIGCAPTION|BLOCKQUOTE|TD|TH|ARTICLE|SECTION|NAV|HEADER|FOOTER|MAIN|HGROUP)$/i;
  var EXCLUDED_TAGS = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|SVG|PATH|IMG|VIDEO|CANVAS|CODE|PRE)$/i;
  // Kept in sync with EDITABLE_TAGS so every editable element gets the dashed
  // outline; the previous list omitted div/b/i and left them silently editable.
  var CANDIDATE_QUERY =
    "h1,h2,h3,h4,h5,h6,p,span,a,button,li,label,strong,em,b,i,small,div,figcaption," +
    "blockquote,td,th,article,section,nav,header,footer,main,hgroup";

  function isEditableTarget(el) {
    if (!el || el.nodeType !== 1) return null;
    if (EXCLUDED_TAGS.test(el.tagName)) return null;
    var cur = el;
    for (var i = 0; i < 8 && cur; i++) {
      if (EDITABLE_TAGS.test(cur.tagName)) {
        var text = (cur.innerText || "").trim().replace(/\s+/g, " ");
        if (text.length >= 1 && !/^\d+([.,]\d+)?%?$/.test(text) && cur.children.length <= 12) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }
    return null;
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
    if (/^(SCRIPT|STYLE|HTML|BODY|HEAD)$/i.test(el.tagName)) return null;
    return el;
  }

  function markTextCandidates() {
    var nodes = document.querySelectorAll(CANDIDATE_QUERY);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if ((n.innerText || "").trim().length >= 1) n.setAttribute("data-forge-editable", "1");
    }
  }

  function scheduleMark() {
    // Debounced: setAttribute itself mutates the DOM, so an un-debounced
    // observer re-triggered itself on every React render.
    if (MARK_TIMER) return;
    MARK_TIMER = setTimeout(function () {
      MARK_TIMER = null;
      if (TOOL === "text" && !EDITING) markTextCandidates();
    }, 150);
  }

  function stopObserver() {
    if (OBSERVER) {
      OBSERVER.disconnect();
      OBSERVER = null;
    }
    if (MARK_TIMER) {
      clearTimeout(MARK_TIMER);
      MARK_TIMER = null;
    }
  }

  function startObserver() {
    stopObserver();
    if (!document.body) return;
    OBSERVER = new MutationObserver(scheduleMark);
    OBSERVER.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------ tool state */

  function ackTool(tool) {
    post({ type: "forge-tool-ack", tool: tool || null });
  }

  function notifyReady() {
    post({ type: "forge-tool-ready", tool: TOOL });
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
    var marked = document.querySelectorAll("[data-forge-editable],[data-forge-editing]");
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute("data-forge-editable");
      marked[i].removeAttribute("data-forge-editing");
      marked[i].contentEditable = "false";
    }
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

  /* --------------------------------------------------------- text editing */

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
    var next = (el.innerText || "").trim().replace(/\s+/g, " ");
    el.contentEditable = "false";
    el.removeAttribute("data-forge-editing");
    restoreStyle(el);
    EDITING = null;
    if (save && next && next !== ORIG) {
      post({ type: "forge-visual-edit", oldText: ORIG, newText: next });
    } else if (!save) {
      // Restore markup, not flattened text: `innerText = ORIG` destroyed nested
      // links, <strong> and icons on every cancel.
      el.innerHTML = ORIG_HTML;
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
      var end = document.createRange();
      end.selectNodeContents(target);
      end.collapse(false);
      sel.addRange(end);
    } catch (err) {
      /* ignore */
    }
  }

  function startTextEdit(target) {
    if (EDITING && EDITING !== target) finishEdit(true);
    ORIG = (target.innerText || "").trim().replace(/\s+/g, " ");
    if (ORIG.length < 1) return;
    ORIG_HTML = target.innerHTML;
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

  /* ------------------------------------------------------------- listeners */

  document.addEventListener("mouseover", function (e) {
    if (!TOOL || TOOL === "text") return;
    var target = pickTarget(e.target, TOOL);
    if (!target || target === HOVER) return;
    clearHover();
    HOVER = target;
    target.setAttribute("data-forge-hover", "1");
    showLabel(target, (target.tagName || "").toLowerCase());
  }, true);

  document.addEventListener("mouseout", function (e) {
    if (!TOOL || TOOL === "text") return;
    if (HOVER && e.target === HOVER) clearHover();
  }, true);

  document.addEventListener("mousedown", function (e) {
    if (TOOL !== "text") return;
    LAST_CLICK = { x: e.clientX, y: e.clientY };
  }, true);

  document.addEventListener("click", function (e) {
    if (!TOOL) return;
    if (TOOL === "text") {
      var textTarget = isEditableTarget(e.target);
      if (!textTarget) {
        post({ type: "forge-edit-miss", reason: "not-editable" });
        return;
      }
      if (EDITING === textTarget) return;
      e.preventDefault();
      e.stopPropagation();
      startTextEdit(textTarget);
      return;
    }
    var target = pickTarget(e.target, TOOL);
    if (!target) {
      // Silence here used to leave the user clicking with zero feedback.
      post({ type: "forge-edit-miss", reason: TOOL === "image" ? "not-an-image" : "not-selectable" });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    clearSelected();
    SELECTED = target;
    target.setAttribute("data-forge-selected", "1");
    var info = describe(target);
    showLabel(target, info.tag);

    if (TOOL === "select") {
      post({
        type: "forge-element-select",
        tag: info.tag, id: info.id, className: info.className,
        selector: info.selector, text: info.text
      });
    } else if (TOOL === "comment") {
      post({
        type: "forge-comment-anchor",
        tag: info.tag, id: info.id, className: info.className,
        selector: info.selector, text: info.text
      });
    } else if (TOOL === "image") {
      post({
        type: "forge-image-select",
        src: target.getAttribute("src") || "",
        alt: target.getAttribute("alt") || "",
        selector: info.selector
      });
    }
  }, true);

  document.addEventListener("keydown", function (e) {
    if (!EDITING) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      finishEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishEdit(false);
    }
  }, true);

  document.addEventListener("focusout", function (e) {
    if (!EDITING) return;
    if (e.target === EDITING) {
      setTimeout(function () {
        if (EDITING && document.activeElement !== EDITING) finishEdit(true);
      }, 0);
    }
  }, true);

  window.addEventListener("message", function (ev) {
    if (!isAllowedOrigin(ev.origin)) return;
    if (!PARENT_ORIGIN) PARENT_ORIGIN = ev.origin;
    var data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "forge-tool-mode") {
      setTool(data.tool || null);
    } else if (data.type === "forge-tool-ping") {
      notifyReady();
      ackTool(TOOL);
    } else if (data.type === "forge-preview-navigate") {
      navigatePreviewPath(typeof data.path === "string" ? data.path : "/");
    }
  });

  /** Best-effort client-side route change for react-router previews. */
  function navigatePreviewPath(path) {
    var normalized = (path || "/").replace(/\/+$/, "") || "/";
    var links = document.querySelectorAll("a[href],[data-forge-page]");
    for (var i = 0; i < links.length; i++) {
      var el = links[i];
      var page = el.getAttribute("data-forge-page");
      if (page && ("/" + page.replace(/^\//, "")) === normalized) {
        el.click();
        return;
      }
      var href = el.getAttribute("href") || "";
      if (href && href.replace(/\/+$/, "") === normalized) {
        el.click();
        return;
      }
    }
    // No matching link: fall back to the History API so react-router reacts.
    try {
      window.history.pushState({}, "", normalized);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      /* ignore */
    }
  }

  ensureStyle();
  notifyReady();
})();
