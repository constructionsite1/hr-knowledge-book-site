(function () {
  var root = window.HRKB_ROOT || "";
  var doc = document.documentElement;

  // Theme toggle: light <-> dark, remembered per browser.
  var themeBtn = document.querySelector(".theme");
  function isDark() {
    var t = doc.dataset.theme;
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function labelTheme() { themeBtn.textContent = isDark() ? "Light mode" : "Dark mode"; }
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", labelTheme);
  }
  themeBtn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    doc.dataset.theme = next;
    try { localStorage.setItem("hrkb-theme", next); } catch (e) {}
    labelTheme();
  });
  labelTheme();

  // Chapter drawer on small screens.
  var menu = document.querySelector(".menu");
  var nav = document.getElementById("nav");
  function setNav(open) {
    document.body.classList.toggle("nav-open", open);
    menu.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var a = nav.querySelector("a"); if (a) a.focus(); }
  }
  menu.addEventListener("click", function () { setNav(!document.body.classList.contains("nav-open")); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("nav-open")) { setNav(false); menu.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (document.body.classList.contains("nav-open") && !nav.contains(e.target) && e.target !== menu) setNav(false);
  });

  // Collapse "On this page" on phones.
  var toc = document.querySelector(".toc");
  if (toc && window.innerWidth < 700) toc.open = false;
  if (toc) toc.addEventListener("click", function (e) {
    if (e.target.tagName === "A" && window.innerWidth < 700) toc.open = false;
  });

  // Search over section text.
  var input = document.getElementById("q");
  var list = document.getElementById("results");
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
    if (!terms.length) return [];
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
    return res.slice(0, 12).map(function (r) { return r.e; }).concat([]).map(function (e) { e._terms = terms; return e; });
  }
  function render(q) {
    var r = search(q);
    if (!q.trim()) { list.hidden = true; list.innerHTML = ""; return; }
    if (!r.length) { list.innerHTML = '<li class="empty">No sections match “' + esc(q) + '”.</li>'; list.hidden = false; return; }
    list.innerHTML = r.map(function (e) {
      return '<li><a href="' + root + e.u + '"><span class="rt">' + mark(e.t, e._terms) + '</span><span class="rc">' +
        esc(e.c) + '</span><span class="rx">' + mark(snippet(e.x, e._terms[0]), e._terms) + "</span></a></li>";
    }).join("");
    list.hidden = false;
  }
  var timer;
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { render(input.value); }, 120); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { var a = list.querySelector("a"); if (a) window.location.href = a.href; }
    if (e.key === "Escape") { list.hidden = true; input.blur(); }
    if (e.key === "ArrowDown") { var f = list.querySelector("a"); if (f) { e.preventDefault(); f.focus(); } }
  });
  list.addEventListener("keydown", function (e) {
    var links = Array.prototype.slice.call(list.querySelectorAll("a"));
    var i = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
    if (e.key === "Escape") { list.hidden = true; input.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (!list.contains(e.target) && e.target !== input) list.hidden = true;
  });
})();
