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

  /** /runner or /projects/{uuid}/draft — keeps BrowserRouter inside the shell. */
  function getPreviewShellBase() {
    if (typeof window.__FORGE_PREVIEW_SHELL_BASE__ === "string" && window.__FORGE_PREVIEW_SHELL_BASE__) {
      return window.__FORGE_PREVIEW_SHELL_BASE__;
    }
    var pathname = window.location.pathname || "";
    var draft = pathname.match(/^(\/projects\/[0-9a-f-]{36}\/draft)\/?/i);
    if (draft) return draft[1];
    if (/^\/runner\/?/i.test(pathname)) return "/runner";
    return "";
  }

  function shellBasePrefix() {
    var base = getPreviewShellBase();
    return base ? base.replace(/\/+$/, "") : "";
  }

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
        // The runner rewrites root-path srcs to the authenticated API URL for
        // display; the literal that lives in the source is kept in
        // data-forge-src, and that's what the replace endpoint must match.
        src: target.getAttribute("data-forge-src") || target.getAttribute("src") || "",
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

  var navigatingFromParent = false;
  var lastReportedPath = null;
  var SECTION_HASHES = {
    top: 1,
    work: 1,
    services: 1,
    process: 1,
    faq: 1,
    galerie: 1,
    expertises: 1,
    apropos: 1,
    temoignages: 1,
    home: 1,
  };

  function reportPreviewPath(path) {
    if (!PARENT_ORIGIN) return;
    var normalized = (path || "/").replace(/\/+$/, "") || "/";
    if (normalized === lastReportedPath) return;
    lastReportedPath = normalized;
    post({ type: "forge-preview-location", path: normalized });
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /** Detect standalone app pages from DOM (not in-page section anchors). */
  function detectActivePreviewPage() {
    var markers = document.querySelectorAll("[data-forge-page]");
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      if (!isVisible(marker)) continue;
      var page = (marker.getAttribute("data-forge-page") || "").trim().toLowerCase();
      if (!page || page === "home" || page === "/") return "/";
      return "/" + page.replace(/^\//, "");
    }

    var navActives = document.querySelectorAll(".nav-link-active, [aria-current='page']");
    for (var j = 0; j < navActives.length; j++) {
      var label = (navActives[j].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      var pageMatch = label.match(/page\s+([a-z0-9-]+)|([a-z0-9-]+)\s+page/);
      if (pageMatch) {
        var key = (pageMatch[1] || pageMatch[2] || "").toLowerCase();
        if (key) return "/" + key;
      }
    }

    var pageContainers = document.querySelectorAll("[class*='-page-container']");
    for (var k = 0; k < pageContainers.length; k++) {
      if (!isVisible(pageContainers[k])) continue;
      var cls = pageContainers[k].className || "";
      var slugMatch = cls.match(/(?:^|\s)([a-z0-9-]+)-page-container(?:\s|$)/i);
      if (slugMatch) return "/" + slugMatch[1].toLowerCase();
    }

    // Active nav item whose label matches a route the builder declared —
    // covers state-based navigation with no detectable page container.
    var activeNav = document.querySelectorAll(
      "nav [aria-current='page'], header [aria-current='page'], " +
        "nav .active, header .active, nav [class*='active'], header [class*='active']",
    );
    for (var n = 0; n < activeNav.length; n++) {
      var slug = slugify(activeNav[n].textContent);
      if (slug && KNOWN_ROUTES[slug]) return "/" + slug;
      if (slug === "home" || slug === "accueil") return "/";
    }

    return null;
  }

  /** Logical app path for the Forge page picker (`/` or `/privacy`). */
  function currentPreviewPath() {
    var domPage = detectActivePreviewPage();
    if (domPage) return domPage;

    var hash = (window.location.hash || "").replace(/^#/, "").split(/[/?]/)[0];
    if (hash) {
      if (SECTION_HASHES[hash.toLowerCase()]) return "/";
      return "/" + hash.toLowerCase();
    }
    var pathname = window.location.pathname || "/";
    var runner = pathname.match(/^\/runner\/?(.*)$/i);
    if (runner) {
      var rest = (runner[1] || "").replace(/\/+$/, "").split("/")[0];
      if (rest) return "/" + rest.toLowerCase();
      return "/";
    }
    var draft = pathname.match(/^\/projects\/[0-9a-f-]{36}\/draft\/?(.*)$/i);
    if (draft) {
      var draftRest = (draft[1] || "").replace(/\/+$/, "").split("/")[0];
      if (draftRest) return "/" + draftRest.toLowerCase();
      return "/";
    }
    var seg = pathname.replace(/\/+$/, "") || "/";
    if (seg === "/" || /^\/runner$/i.test(seg)) return "/";
    return seg.toLowerCase();
  }

  function reportPreviewLocation() {
    if (navigatingFromParent) return;
    if (!PARENT_ORIGIN) return;
    var path = currentPreviewPath();
    if (path === lastReportedPath) return;
    lastReportedPath = path;
    post({ type: "forge-preview-location", path: path });
  }

  function hasDedicatedPageControl(pageKey) {
    if (!pageKey) return false;
    var keyLower = pageKey.toLowerCase();
    var forgePages = document.querySelectorAll("[data-forge-page]");
    for (var i = 0; i < forgePages.length; i++) {
      var page = (forgePages[i].getAttribute("data-forge-page") || "").toLowerCase();
      if (page === keyLower || page === "/" + keyLower) return true;
    }
    if (findPageContainer(pageKey)) return true;
    var clickables = document.querySelectorAll("button, [role='button']");
    for (var j = 0; j < clickables.length; j++) {
      var label = (clickables[j].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        label === "page " + keyLower ||
        label === keyLower + " page" ||
        (label.indexOf("page") >= 0 && label.indexOf(keyLower) >= 0)
      ) {
        return true;
      }
    }
    return false;
  }

  function tryNavigateHome() {
    var back = document.querySelector(
      ".back-btn, [data-forge-page='/'], [data-forge-page='home'], [data-forge-page='/home']",
    );
    if (back) {
      back.click();
      return true;
    }
    var brand = document.querySelector(".brand-btn, .brand button, button.brand-btn");
    if (brand) {
      brand.click();
      return true;
    }
    var clickables = document.querySelectorAll("button, [role='button']");
    for (var i = 0; i < clickables.length; i++) {
      var label = (clickables[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        label === "accueil" ||
        label === "home" ||
        label.indexOf("accueil") === 0 ||
        label.indexOf("home") === 0 ||
        label.indexOf("retour") === 0 ||
        label.indexOf("back to") === 0
      ) {
        clickables[i].click();
        return true;
      }
    }
    return false;
  }

  /** Loose slug equality: exact, containment, or long-enough common prefix.
   *  Bridges accents/plural/language drift between route slugs and nav labels
   *  ("activities" route vs "Activités" label → activites, prefix "activit"). */
  function slugsClose(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 4 && b.indexOf(a) === 0) return true;
    if (b.length >= 4 && a.indexOf(b) === 0) return true;
    var min = Math.min(a.length, b.length);
    if (min < 4) return false;
    var common = 0;
    while (common < min && a.charAt(common) === b.charAt(common)) common++;
    return common >= Math.max(4, Math.ceil(min * 0.7));
  }

  function tryNavigateDedicatedPage(pageKey, normalized) {
    var keyLower = pageKey.toLowerCase();
    var forgePages = document.querySelectorAll("[data-forge-page]");
    for (var i = 0; i < forgePages.length; i++) {
      var el = forgePages[i];
      var page = el.getAttribute("data-forge-page") || "";
      var pageNorm = "/" + String(page).replace(/^\//, "").replace(/\/+$/, "");
      if (pageNorm === "/" ) pageNorm = "/";
      if (pageNorm === normalized || String(page).toLowerCase() === keyLower) {
        el.click();
        reportPreviewPath(normalized);
        return true;
      }
    }

    // Deterministic: anchors whose href targets the requested route
    // ("/activities", "#/activities", "#activities").
    var anchors = document.querySelectorAll("a[href]");
    for (var h = 0; h < anchors.length; h++) {
      var href = (anchors[h].getAttribute("href") || "").trim();
      var hrefNorm = href.replace(/^#\/?/, "/").replace(/\/+$/, "") || "/";
      if (hrefNorm === normalized) {
        safeClick(anchors[h]);
        reportPreviewPath(normalized);
        return true;
      }
    }

    var container = findPageContainer(pageKey);
    if (container) {
      var clickable = container.querySelector("a, button, [role='button']");
      if (clickable) safeClick(clickable);
      else container.click();
      reportPreviewPath(normalized);
      return true;
    }

    // The #1 generated pattern: a nav control labeled like the page
    // ("Contact", "À propos", "Activités"). Buttons drive setPage() state;
    // anchors drive a router — safeClick blocks native navigation. Dashboards
    // put their nav in sidebars/menus, not only <nav>.
    var navScopes = document.querySelectorAll(
      "nav, header, aside, [role='navigation'], [class*='nav'], [class*='sidebar'], [class*='menu']",
    );
    var wantedSlug = pageKeySlug(pageKey);
    for (var s = 0; s < navScopes.length; s++) {
      var controls = navScopes[s].querySelectorAll("a, button, [role='button']");
      for (var c = 0; c < controls.length; c++) {
        var ctl = controls[c];
        if (slugsClose(slugify(ctl.textContent), wantedSlug)) {
          safeClick(ctl);
          reportPreviewPath(normalized);
          return true;
        }
      }
    }

    var clickables = document.querySelectorAll("button, [role='button']");
    for (var j = 0; j < clickables.length; j++) {
      var btn = clickables[j];
      var label = (btn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      var pageMatch =
        label === "page " + keyLower ||
        label === keyLower + " page" ||
        (label.indexOf("page") >= 0 && label.indexOf(keyLower) >= 0);
      if (pageMatch) {
        btn.click();
        reportPreviewPath(normalized);
        return true;
      }
    }
    return false;
  }

  // Routes declared by the builder (detected server-side from the sources).
  // Label matching against a KNOWN set is what makes both sync directions
  // reliable; without it, "Contact" in a navbar is just a word.
  var KNOWN_ROUTES = {};

  /** "À propos " -> "a-propos" ; "Contact" -> "contact". */
  function slugify(text) {
    var s = String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
    try {
      s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {
      /* older engines */
    }
    return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  /** Route segment safe for CSS class lookups (`produits/hw-air-pulse` -> `produits-hw-air-pulse`). */
  function pageKeySlug(pageKey) {
    return slugify(String(pageKey || "").replace(/\//g, " "));
  }

  function cssEscapeIdent(value) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function findPageContainer(pageKey) {
    var slugs = [];
    var full = pageKeySlug(pageKey);
    if (full) slugs.push(full);
    var parts = String(pageKey || "").split("/").filter(Boolean);
    if (parts.length) {
      var last = pageKeySlug(parts[parts.length - 1]);
      if (last && slugs.indexOf(last) === -1) slugs.push(last);
    }
    for (var i = 0; i < slugs.length; i++) {
      try {
        var el = document.querySelector("." + cssEscapeIdent(slugs[i]) + "-page-container");
        if (el) return el;
      } catch (e) {
        /* invalid selector — never crash the preview */
      }
    }
    var containers = document.querySelectorAll("[class*='-page-container']");
    for (var k = 0; k < containers.length; k++) {
      var cls = " " + (containers[k].className || "") + " ";
      for (var j = 0; j < slugs.length; j++) {
        if (cls.indexOf(" " + slugs[j] + "-page-container") >= 0) return containers[k];
      }
    }
    return null;
  }

  /**
   * Click that never lets a plain anchor perform a real navigation (which
   * would leave /runner/ and kill the preview). Default actions run after
   * bubbling: a one-shot document-level listener calls preventDefault at the
   * end of the chain, AFTER any SPA router handler already did its job.
   */
  function safeClick(el) {
    var guard = function (ev) {
      ev.preventDefault();
    };
    document.addEventListener("click", guard, false);
    try {
      el.click();
    } finally {
      document.removeEventListener("click", guard, false);
    }
  }

  function wrapHistoryMethod(method) {
    var orig = window.history[method];
    if (typeof orig !== "function") return;
    window.history[method] = function () {
      var result = orig.apply(this, arguments);
      try {
        reportPreviewLocation();
      } catch (e) {
        /* ignore */
      }
      return result;
    };
  }
  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  window.addEventListener("hashchange", reportPreviewLocation);
  window.addEventListener("popstate", reportPreviewLocation);

  window.addEventListener("message", function (ev) {
    if (!isAllowedOrigin(ev.origin)) return;
    var firstParent = !PARENT_ORIGIN;
    if (!PARENT_ORIGIN) PARENT_ORIGIN = ev.origin;
    var data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "forge-tool-mode") {
      setTool(data.tool || null);
    } else if (data.type === "forge-tool-ping") {
      notifyReady();
      ackTool(TOOL);
      reportPreviewLocation();
    } else if (data.type === "forge-preview-routes") {
      KNOWN_ROUTES = {};
      var paths = Array.isArray(data.paths) ? data.paths : [];
      for (var r = 0; r < paths.length; r++) {
        var key = String(paths[r] || "").replace(/^\//, "").replace(/\/+$/, "").toLowerCase();
        if (key) KNOWN_ROUTES[key] = true;
      }
      reportPreviewLocation();
    } else if (data.type === "forge-preview-navigate") {
      navigatingFromParent = true;
      try {
        navigatePreviewPath(typeof data.path === "string" ? data.path : "/");
        lastReportedPath = currentPreviewPath();
      } finally {
        // Defer so hashchange/pushState from navigate don't echo back.
        setTimeout(function () {
          navigatingFromParent = false;
        }, 200);
      }
    }
    if (firstParent) reportPreviewLocation();
  });

  /**
   * Best-effort client-side route change for preview apps.
   *
   * The runner lives at `/runner/` on the API origin. Absolute path navigations
   * like `/privacy` leave the shell (404) and kill the preview — never do that.
   * Prefer hash routing (common for setCurrentPage / HashRouter prototypes),
   * then in-page controls, then a runner-scoped History API update.
   */
  function navigatePreviewPath(path) {
    var normalized = (path || "/").replace(/\/+$/, "") || "/";
    var pageKey = normalized === "/" ? "" : normalized.replace(/^\//, "");
    var targetHash = pageKey ? "#" + pageKey : "";
    var pathname = window.location.pathname || "/";
    var shellBase = getPreviewShellBase();
    var onPreviewShell = Boolean(shellBase);

    function setPreviewHash(nextKey) {
      var current = (window.location.hash || "").replace(/^#/, "");
      if ((nextKey || "") === current) {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        return;
      }
      if (nextKey) {
        window.location.hash = nextKey;
        return;
      }
      var keep = (onPreviewShell ? pathname : "/runner/") + (window.location.search || "");
      window.history.pushState({}, "", keep);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }

    // 1) Home — click in-app controls (setActivePage('home'), brand, back).
    if (!pageKey) {
      if (tryNavigateHome()) {
        reportPreviewPath("/");
        return;
      }
    }

    // 2) Dedicated standalone pages — before hash/anchors (avoids #contact sections).
    if (pageKey && tryNavigateDedicatedPage(pageKey, normalized)) {
      return;
    }

    // 3) Explicit opt-in hooks.
    var forgePages = document.querySelectorAll("[data-forge-page]");
    for (var i = 0; i < forgePages.length; i++) {
      var el = forgePages[i];
      var page = el.getAttribute("data-forge-page") || "";
      var pageNorm = "/" + String(page).replace(/^\//, "").replace(/\/+$/, "");
      if (pageNorm === "/" ) pageNorm = "/";
      if (pageNorm === normalized || String(page).toLowerCase() === pageKey.toLowerCase()) {
        el.click();
        reportPreviewPath(normalized);
        return;
      }
    }

    // 4) Hash routing for apps that listen to hashchange (never leaves /runner/).
    if (!pageKey || !hasDedicatedPageControl(pageKey)) {
      try {
        setPreviewHash(pageKey);
      } catch (eHash) {
        /* ignore */
      }

      // 5) Anchors — section hashes, and router links to the exact page
      //    (safeClick keeps a plain anchor from really leaving /runner/).
      var anchors = document.querySelectorAll("a[href]");
      for (var a = 0; a < anchors.length; a++) {
        var link = anchors[a];
        var href = link.getAttribute("href") || "";
        if (!href || href.startsWith("mailto:") || href.startsWith("http")) continue;
        var h = href.replace(/\/+$/, "");
        if (pageKey && (h === "/" + pageKey || h.toLowerCase() === "/" + pageKey)) {
          safeClick(link);
          reportPreviewPath(normalized);
          return;
        }
        if (href.startsWith("/") && !href.startsWith("/#") && !/^\/runner\/?/i.test(href)) {
          continue;
        }
        var match =
          (pageKey && (h === targetHash || h === "/#" + pageKey)) ||
          (!pageKey && (h === "#" || h === "#top" || h === "/#top"));
        if (match) {
          link.click();
          reportPreviewPath(normalized);
          return;
        }
      }
    }

    // 6) BrowserRouter fallback — stay under the preview shell (/runner/ or /projects/.../draft).
    try {
      if (!onPreviewShell) return;
      var prefix = shellBasePrefix();
      var nextPath = pageKey ? prefix + "/" + pageKey : prefix + "/";
      var currentPath = pathname.replace(/\/+$/, "") || "/";
      var wantPath = nextPath.replace(/\/+$/, "") || "/";
      if (currentPath !== wantPath) {
        window.history.pushState({}, "", nextPath + (window.location.search || "") + (pageKey ? "#" + pageKey : ""));
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      reportPreviewPath(normalized);
    } catch (eHist) {
      /* ignore */
    }
  }

  ensureStyle();
  notifyReady();

  // Block plain anchors from escaping the preview shell to the API root (/).
  document.addEventListener(
    "click",
    function (ev) {
      var prefix = shellBasePrefix();
      if (!prefix) return;
      var link = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!link) return;
      var href = (link.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || /^https?:/i.test(href)) return;
      if (!href.startsWith("/")) return;
      var normalizedHref = href.replace(/\/+$/, "") || "/";
      var normalizedPrefix = prefix.replace(/\/+$/, "") || "/";
      if (normalizedHref === normalizedPrefix || normalizedHref.indexOf(normalizedPrefix + "/") === 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      navigatePreviewPath(normalizedHref === "/" ? "/" : normalizedHref);
    },
    true,
  );

  var previewSyncTimer = null;
  function schedulePreviewSync() {
    if (navigatingFromParent) return;
    clearTimeout(previewSyncTimer);
    previewSyncTimer = setTimeout(function () {
      reportPreviewLocation();
    }, 120);
  }

  if (document.body) {
    var previewObserver = new MutationObserver(schedulePreviewSync);
    previewObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"],
    });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      var previewObserver = new MutationObserver(schedulePreviewSync);
      previewObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-current"],
      });
    });
  }

  // Initial path once the parent origin is known (may no-op until first parent message).
  reportPreviewLocation();
})();
