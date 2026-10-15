(function () {
  var root = window.HRKB_ROOT || "";
  var doc = document.documentElement;
  var body = document.body;
  var main = document.getElementById("content");
  var status = document.getElementById("sr-status");
  function announce(msg) { if (status) { status.textContent = ""; setTimeout(function () { status.textContent = msg; }, 50); } }

  // Theme: light <-> dark, remembered per browser. aria-pressed = dark mode on.
  var themeBtn = document.querySelector(".theme");
  var themeText = themeBtn.querySelector(".bt");
  function isDark() {
    var t = doc.dataset.theme;
    if (t) return t === "dark";
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function labelTheme() {
    var dark = isDark();
    themeBtn.setAttribute("aria-pressed", dark ? "true" : "false");
    themeBtn.setAttribute("aria-label", "Dark mode");
    themeText.textContent = "Dark mode";
  }
  themeBtn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    doc.dataset.theme = next;
    try { localStorage.setItem("hrkb-theme", next); } catch (e) {}
    labelTheme();
    announce(next === "dark" ? "Dark mode on" : "Dark mode off");
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", labelTheme);
  }
  labelTheme();

  // Chapter drawer (small screens). Off-screen links are hidden from tab order by CSS
  // visibility; the page behind becomes inert while the drawer is open.
  var menu = document.querySelector(".menu");
  var nav = document.getElementById("nav");
  menu.setAttribute("aria-label", "Chapters");
  function drawerMode() { return window.matchMedia("(max-width: 900px)").matches; }
  function setNav(open, restoreFocus) {
    body.classList.toggle("nav-open", open);
    menu.setAttribute("aria-expanded", open ? "true" : "false");
    if (main) main.inert = open && drawerMode();
    if (open) {
      var cur = nav.querySelector('[aria-current="page"]') || nav.querySelector("a");
      if (cur) setTimeout(function () { cur.focus(); }, 30);
    } else if (restoreFocus) {
      menu.focus();
    }
  }
  menu.addEventListener("click", function () { setNav(!body.classList.contains("nav-open"), false); });
  document.addEventListener("click", function (e) {
    if (body.classList.contains("nav-open") && !nav.contains(e.target) && !menu.contains(e.target)) setNav(false, false);
  });
  window.addEventListener("resize", function () { if (!drawerMode() && body.classList.contains("nav-open")) setNav(false, false); });

  // Full screen / reading mode. Uses the Fullscreen API where the browser allows it (Android, desktop);
  // otherwise (iPhone Safari) it hides the page chrome so only the text remains.
  var fsBtn = document.querySelector(".fs");
  var exitBtn = document.querySelector(".exit-reading");
  fsBtn.setAttribute("aria-label", "Full screen");
  var usedApi = false;
  function canApi() { return !!(doc.requestFullscreen || doc.webkitRequestFullscreen); }
  function inApi() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function setReading(on) {
    body.classList.toggle("reading", on);
    fsBtn.setAttribute("aria-pressed", on ? "true" : "false");
    exitBtn.hidden = !on;
    if (on) { exitBtn.focus({ preventScroll: true }); announce("Full screen on. Use Exit full screen to return."); }
    else { fsBtn.focus({ preventScroll: true }); announce("Full screen off"); }
  }
  function enter() {
    if (body.classList.contains("nav-open")) setNav(false, false);
    usedApi = false;
    if (canApi()) {
      var req = doc.requestFullscreen ? doc.requestFullscreen() : doc.webkitRequestFullscreen();
      usedApi = true;
      if (req && req.catch) req.catch(function () { usedApi = false; });
    }
    setReading(true);
  }
  function exit() {
    if (inApi()) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
    setReading(false);
  }
  fsBtn.addEventListener("click", function () { body.classList.contains("reading") ? exit() : enter(); });
  exitBtn.addEventListener("click", exit);
  function onFsChange() { if (usedApi && !inApi() && body.classList.contains("reading")) setReading(false); }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);

  // Escape: close results, drawer or reading mode, in that order.
  var input = document.getElementById("q");
  var list = document.getElementById("results");
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!list.hidden) { closeResults(); input.focus(); return; }
    if (body.classList.contains("nav-open")) { setNav(false, true); return; }
    if (body.classList.contains("reading") && !inApi()) exit();
  });

  // "On this page" collapses on phones and closes after a jump.
  var toc = document.querySelector(".toc");
  if (toc && window.innerWidth < 700) toc.open = false;
  if (toc) toc.addEventListener("click", function (e) {
    if (e.target.tagName === "A" && window.innerWidth < 700) toc.open = false;
  });

  // Search over section text.
  var index = window.HRKB_INDEX || [];
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mark(s, terms) {
    var out = esc(s);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>");
    });
    return out;
  }
  function snippet(text, term) {
    var i = text.toLowerCase().indexOf(term);
    if (i < 0) return text.slice(0, 140) + "…";
    var s = Math.max(0, i - 60);
    return (s > 0 ? "…" : "") + text.slice(s, s + 160) + "…";
  }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return { terms: terms, hits: [] };
    var res = [];
    index.forEach(function (e) {
      var t = e.t.toLowerCase(), x = e.x.toLowerCase(), score = 0, ok = true;
      terms.forEach(function (term) {
        var inT = t.indexOf(term) >= 0, inX = x.indexOf(term) >= 0;
        if (!inT && !inX) ok = false;
        score += (inT ? 10 : 0) + (inX ? 1 + Math.min(5, x.split(term).length - 1) : 0);
      });
      if (ok) res.push({ e: e, s: score });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return { terms: terms, hits: res.slice(0, 12).map(function (r) { return r.e; }) };
  }
  function closeResults() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function render(q) {
    if (!q.trim()) { closeResults(); list.innerHTML = ""; return; }
    var r = search(q);
    if (!r.hits.length) {
      list.innerHTML = '<li class="empty">No sections match “' + esc(q) + '”. Try a shorter word, such as “wage” or “POSH”.</li>';
      announce("No results");
    } else {
      list.innerHTML = r.hits.map(function (e) {
        return '<li><a href="' + root + e.u + '"><span class="rt">' + mark(e.t, r.terms) + '</span><span class="rc">' +
          esc(e.c) + '</span><span class="rx">' + mark(snippet(e.x, r.terms[0]), r.terms) + "</span></a></li>";
      }).join("");
      announce(r.hits.length + (r.hits.length === 1 ? " result" : " results") + ". Press down arrow to browse.");
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  var timer;
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { render(input.value); }, 150); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { var a = list.querySelector("a"); if (a) window.location.href = a.href; }
    if (e.key === "ArrowDown") { var f = list.querySelector("a"); if (f) { e.preventDefault(); f.focus(); } }
  });
  list.addEventListener("keydown", function (e) {
    var links = Array.prototype.slice.call(list.querySelectorAll("a"));
    var i = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
  });
  document.addEventListener("click", function (e) {
    if (!list.contains(e.target) && e.target !== input) closeResults();
  });
})();
