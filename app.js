/* QuickAI bio page: renders tools.json, carries ?src= through to outbound links and the signup form. */
(function () {
  "use strict";

  // ---- Config -------------------------------------------------------------
  var TOOLS_URL = "tools.json";
  var KNOWN_SRC = { yt: "youtube", tt: "tiktok", ig: "instagram" }; // ?src=yt|tt|ig
  var UTM_MEDIUM = "bio";
  var UTM_CAMPAIGN = "free_tools_list";
  // Some affiliate programs read their own sub-ID parameter. Make documents ?affiliateSource=
  // (help.make.com/affiliate-program). Add others here once you know their parameter name.
  var SUBID_PARAMS = { make: "affiliateSource" };

  var params = new URLSearchParams(window.location.search);

  // ---- Source tracking ----------------------------------------------------
  function cleanSrc(v) {
    v = (v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
    return v || null;
  }
  var src = cleanSrc(params.get("src"));
  try {
    if (src) sessionStorage.setItem("qa_src", src);       // survive a trip to privacy.html and back
    else src = cleanSrc(sessionStorage.getItem("qa_src"));
  } catch (e) { /* storage blocked: fine */ }
  src = src || "direct";
  var utmSource = src; // short code (yt/tt/ig) is used as utm_source; KNOWN_SRC documents the mapping

  var formSrc = document.getElementById("form-src");
  var formUtm = document.getElementById("form-utm-source");
  if (formSrc) formSrc.value = src;
  if (formUtm) formUtm.value = utmSource;

  // Keep ?src on internal links (privacy/terms) so the round trip keeps attribution.
  if (src !== "direct") {
    document.querySelectorAll('a[href$=".html"]').forEach(function (a) {
      a.href = a.getAttribute("href") + "?src=" + encodeURIComponent(src);
    });
  }

  function withUtm(rawUrl, slug, isAff) {
    try {
      var u = new URL(rawUrl);
      u.searchParams.set("utm_source", utmSource);
      u.searchParams.set("utm_medium", UTM_MEDIUM);
      u.searchParams.set("utm_campaign", UTM_CAMPAIGN);
      u.searchParams.set("utm_content", slug);
      if (isAff && SUBID_PARAMS[slug]) u.searchParams.set(SUBID_PARAMS[slug], src);
      return u.toString();
    } catch (e) {
      return rawUrl;
    }
  }

  // An affiliate URL is "live" only if it is a real http(s) URL (not a {{PLACEHOLDER}}).
  function liveAffiliate(t) {
    return typeof t.affiliateUrl === "string" && t.affiliateUrl.indexOf("{{") === -1 && /^https?:\/\//.test(t.affiliateUrl);
  }
  // Preview only: ?demoAffiliate=1 shows Affiliate tags on placeholder links so you can check the layout.
  var demoAff = params.get("demoAffiliate") === "1";

  // ---- Dates --------------------------------------------------------------
  function parseISO(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmt(d) {
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  var today = new Date(); today.setHours(0, 0, 0, 0);

  // ---- Rendering ----------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function card(t) {
    var isAff = liveAffiliate(t);
    var showAffTag = isAff || (demoAff && t.affiliateUrl);
    var href = withUtm(isAff ? t.affiliateUrl : t.url, t.slug, isAff);

    var c = el("article", "card" + (t.pro ? " card-pro" : ""));
    c.id = "tool-" + t.slug;

    var top = el("div", "card-top");
    var titleWrap = el("div");
    titleWrap.appendChild(el("h3", null, t.name));
    titleWrap.appendChild(el("div", "cat", t.category));
    top.appendChild(titleWrap);
    c.appendChild(top);

    c.appendChild(el("p", "one", t.oneLiner));

    var meta = el("div", "meta");
    var d = parseISO(t.featuredDate);
    if (d && d > today) meta.appendChild(el("span", "tag tag-soon", "Video drops " + fmt(d)));
    else if (d) meta.appendChild(el("span", "tag tag-date", "Featured in: " + fmt(d) + " video"));
    else meta.appendChild(el("span", "tag tag-date", "Not featured in a video yet"));
    meta.appendChild(el("span", "tag tag-free", t.freeTier ? "Free tier: yes" : "Free tier: no"));
    c.appendChild(meta);

    var cta = el("div", "card-cta");
    var a = el("a", "btn " + (t.pro ? "btn-ghost" : "btn-primary"), "Try " + t.name.split(" (")[0] + " →");
    a.href = href;
    a.target = "_blank";
    a.rel = isAff ? "sponsored noopener" : "noopener";
    a.setAttribute("data-slug", t.slug);
    cta.appendChild(a);
    if (showAffTag) {
      var tag = el("span", "tag tag-aff", "Affiliate");
      tag.title = "Affiliate link: QuickAI may earn a commission at no extra cost to you.";
      cta.appendChild(tag);
    }
    c.appendChild(cta);
    return c;
  }

  function render(data) {
    var tools = (data && data.tools) || [];
    var free = tools.filter(function (t) { return !t.pro; });
    var pro = tools.filter(function (t) { return t.pro; });
    free.sort(function (a, b) { return (b.featuredDate || "").localeCompare(a.featuredDate || ""); });

    var list = document.getElementById("tool-list");
    var proList = document.getElementById("pro-list");
    list.textContent = "";
    proList.textContent = "";
    free.forEach(function (t) { list.appendChild(card(t)); });
    pro.forEach(function (t) { proList.appendChild(card(t)); });
    if (!pro.length) document.getElementById("pro").hidden = true;

    var eleven = tools.filter(function (t) { return t.slug === "elevenlabs"; })[0];
    if (eleven && liveAffiliate(eleven)) document.getElementById("elevenlabs-attribution").hidden = false;
  }

  fetch(TOOLS_URL, { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(function () {
      document.getElementById("tool-list").innerHTML =
        '<p class="muted">Couldn\'t load the list right now. Please refresh.</p>';
    });

  // ---- Signup form --------------------------------------------------------
  var form = document.getElementById("signup-form");
  var status = document.getElementById("signup-status");
  if (form) {
    form.addEventListener("submit", function (e) {
      var action = form.getAttribute("action") || "";
      if (action === form.getAttribute("data-placeholder-action") || action.indexOf("example") !== -1) {
        e.preventDefault();
        status.textContent = "Signups open soon. The newsletter isn't connected yet.";
        return;
      }
      if (!window.fetch || !window.FormData) return; // plain POST fallback
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      status.textContent = "Signing you up...";
      fetch(action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && (!res.d || res.d.status !== "failed")) {
            status.textContent = "Nearly done! Check your inbox and confirm your email to get the list.";
            form.reset();
          } else {
            status.textContent = "Something went wrong. Please check your email address and try again.";
          }
        })
        .catch(function () { form.submit(); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
