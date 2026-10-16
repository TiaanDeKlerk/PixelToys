// Pixel Toys shop page. Toys, settings and orders live in Supabase (see config.js and supabase/setup.sql).
(function () {
  var state = null;
  var picked = {};
  var root = document.getElementById("root");
  var cfg = window.PIXEL_TOYS;
  var db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function photos(t) { return (t.images && t.images.length ? t.images : t.img ? [t.img] : []); }
  function money(t) { return t.price === "" || t.price == null ? "" : state.shop.currency + Number(t.price).toFixed(Number(t.price) % 1 ? 2 : 0); }

  // ---------- Recent orders (kept only on this device) ----------

  var RECENT_KEY = "pixeltoys.recent";
  function recentIds() {
    try { var r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(r) ? r : []; }
    catch (e) { return []; }
  }
  function rememberOrder(id) {
    try {
      var r = recentIds().filter(function (x) { return x !== id; });
      r.unshift(id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 12)));
    } catch (e) { /* storage blocked: recommendations just stay generic */ }
  }

  function byId(id) { return state.toys.find(function (t) { return t.id === id; }); }
  function sold(t) { return state.sold[t.id] || 0; }

  // Most popular: toys that have sold at least once, best sellers first.
  function popular() {
    return state.toys.filter(function (t) { return sold(t) > 0; })
      .sort(function (a, b) { return sold(b) - sold(a); });
  }

  // Recommended: same category as something you ordered, then other best sellers.
  function recommended(recent) {
    var cats = {}, seen = {};
    recent.forEach(function (t) { if (t.category) cats[t.category.toLowerCase()] = true; seen[t.id] = true; });
    var rest = state.toys.filter(function (t) { return !seen[t.id]; });
    var same = rest.filter(function (t) { return t.category && cats[t.category.toLowerCase()]; })
      .sort(function (a, b) { return sold(b) - sold(a); });
    var others = rest.filter(function (t) { return same.indexOf(t) < 0; })
      .sort(function (a, b) { return sold(b) - sold(a); });
    return same.concat(others).slice(0, 4);
  }

  function card(t, opts) {
    opts = opts || {};
    var s = state.shop, sel = picked[t.id];
    var sw = s.colors.map(function (c, i) {
      return '<button class="sw" style="background:' + esc(c.hex) + '" aria-pressed="' + (sel === i) + '" aria-label="' + esc(c.name) + '" data-act="color" data-id="' + esc(t.id) + '" data-i="' + i + '"></button>';
    }).join("");
    var p = money(t), pics = photos(t), n = sold(t);
    return '<article class="card">' +
      (pics.length
        ? '<button class="photo" data-act="gallery" data-id="' + esc(t.id) + '" aria-label="See photos of ' + esc(t.name) + '">' +
            '<img src="' + esc(pics[0]) + '" alt="' + esc(t.name) + '" loading="lazy">' +
            '<span class="pics">' + (pics.length > 1 ? pics.length + " photos" : "View photo") + '</span></button>'
        : '<div class="photo"><span class="noimg">?</span></div>') +
      (opts.rank ? '<span class="rank r' + Math.min(opts.rank, 4) + '">#' + opts.rank + '</span>' : '') +
      '<div class="card-body">' +
        (t.category || n ? '<div class="tags">' + (t.category ? '<span class="tag">' + esc(t.category) + '</span>' : '') +
          (n ? '<span class="tag hot">' + n + ' sold</span>' : '') + '</div>' : '') +
        '<h3>' + esc(t.name) + '</h3>' +
        (opts.why ? '<p class="why">' + esc(opts.why) + '</p>' : '') +
        (t.desc ? '<p class="desc">' + esc(t.desc) + '</p>' : '') +
        '<p class="ptime">Prints in about ' + esc(t.printTime || s.printTime) + '</p>' +
        '<div class="swatches">' + sw + '</div>' +
        '<div class="sw-label">' + (sel != null ? esc(s.colors[sel].name) : "Pick a color") + '</div>' +
        '<div class="card-foot">' +
          (p ? '<span class="price">' + esc(p) + '</span>' : '<span class="price soon">Price coming soon</span>') +
          '<button class="btn" data-act="order" data-id="' + esc(t.id) + '">' + (opts.again ? "Order again" : "Order") + '</button>' +
        '</div>' +
      '</div></article>';
  }

  function section(id, title, sub, cards) {
    return '<section class="shelf" id="' + id + '" aria-labelledby="' + id + '-h">' +
      '<div class="section-head"><h2 id="' + id + '-h">' + title + '</h2>' + (sub ? '<span class="count">' + sub + '</span>' : '') + '</div>' +
      '<div class="grid">' + cards + '</div></section>';
  }

  function render() {
    var s = state.shop, toys = state.toys;
    var recent = recentIds().map(byId).filter(Boolean);
    var shelves = "";

    var pop = popular().slice(0, 4);
    if (pop.length) shelves += section("popular", 'Most <span class="hl">popular</span>', "Best sellers right now",
      pop.map(function (t, i) { return card(t, { rank: i + 1 }); }).join(""));

    if (recent.length) {
      var rec = recommended(recent);
      if (rec.length) shelves += section("for-you", 'Recommended <span class="hl2">for you</span>', "Based on what you ordered",
        rec.map(function (t) {
          var match = t.category && recent.find(function (r) { return r.category && r.category.toLowerCase() === t.category.toLowerCase(); });
          return card(t, { why: match ? "Because you ordered " + match.name : (sold(t) ? "A customer favorite" : "") });
        }).join(""));
      shelves += section("recent", "Your recent orders", "Saved on this device only",
        recent.slice(0, 4).map(function (t) { return card(t, { again: true }); }).join(""));
    }

    var all = toys.map(function (t) { return card(t); }).join("") ||
      '<div class="empty"><strong>New toys coming soon!</strong>The printer is warming up. Check back in a little while.</div>';

    root.innerHTML =
      '<header class="hero"><div class="wrap">' +
        '<h1 class="brand">Pixel <span class="co">Toys</span></h1>' +
        '<p class="tagline">' + esc(s.tagline) + '</p>' +
        '<div class="filament" aria-hidden="true">' + s.colors.map(function (c) { return '<span style="background:' + esc(c.hex) + ';outline:1px solid #2c3430"></span>'; }).join("") + '</div>' +
      '</div></header>' +
      '<section class="wrap steps" aria-label="How ordering works">' +
        '<div class="step"><b>1</b><div><strong>Pick a toy and a color</strong><p>Choose from the toys below.</p></div></div>' +
        '<div class="step"><b>2</b><div><strong>We print it just for you</strong><p>Every toy is printed fresh, layer by layer. Each toy shows how long it takes.</p></div></div>' +
        '<div class="step"><b>3</b><div><strong>It\'s yours!</strong><p>We hand it over when it\'s ready.</p></div></div>' +
      '</section>' +
      '<main class="wrap">' + shelves +
        section("all", "All toys", toys.length + (toys.length === 1 ? " toy" : " toys"), all) +
      '</main>' +
      '<footer><div class="wrap"><span>Pixel Toys Â· Every toy is 3D printed to order</span><span>Colors: ' + s.colors.map(function (c) { return esc(c.name); }).join(", ") + '</span></div></footer>';
  }

  var galleryKeys = null;
  function closeModal() { var o = document.getElementById("overlay"); if (o) o.remove(); galleryKeys = null; }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
    else if (galleryKeys && e.key === "ArrowLeft") galleryKeys(-1);
    else if (galleryKeys && e.key === "ArrowRight") galleryKeys(1);
  });

  function openGallery(t, start) {
    var pics = photos(t), i = start || 0, s = state.shop;
    closeModal();
    var o = document.createElement("div");
    o.className = "overlay"; o.id = "overlay";
    document.body.appendChild(o);
    o.addEventListener("click", function (e) { if (e.target === o) closeModal(); });

    function draw() {
      var sel = picked[t.id], p = money(t), many = pics.length > 1;
      o.innerHTML = '<div class="modal gallery" role="dialog" aria-modal="true" aria-label="Photos of ' + esc(t.name) + '">' +
        '<button class="g-close" data-g="close" aria-label="Close">×</button>' +
        '<div class="g-stage">' +
          '<img src="' + esc(pics[i]) + '" alt="' + esc(t.name) + ', photo ' + (i + 1) + ' of ' + pics.length + '">' +
          (many ? '<button class="g-nav prev" data-g="prev" aria-label="Previous photo">‹</button><button class="g-nav next" data-g="next" aria-label="Next photo">›</button>' +
                  '<span class="g-count">' + (i + 1) + ' / ' + pics.length + '</span>' : '') +
        '</div>' +
        (many ? '<div class="g-thumbs">' + pics.map(function (src, n) {
          return '<button data-g="thumb" data-n="' + n + '" aria-label="Photo ' + (n + 1) + '" aria-current="' + (n === i) + '"><img src="' + esc(src) + '" alt=""></button>';
        }).join("") + '</div>' : '') +
        '<div class="g-info">' +
          '<h2>' + esc(t.name) + '</h2>' +
          (t.desc ? '<p class="desc">' + esc(t.desc) + '</p>' : '') +
          '<p class="ptime">Prints in about ' + esc(t.printTime || s.printTime) + '</p>' +
          '<div class="swatches">' + s.colors.map(function (c, n) {
            return '<button class="sw" style="background:' + esc(c.hex) + '" aria-pressed="' + (sel === n) + '" aria-label="' + esc(c.name) + '" data-g="color" data-n="' + n + '"></button>';
          }).join("") + '</div>' +
          '<div class="sw-label">' + (sel != null ? esc(s.colors[sel].name) : "Pick a color") + '</div>' +
          '<div class="card-foot">' +
            (p ? '<span class="price">' + esc(p) + '</span>' : '<span class="price soon">Price coming soon</span>') +
            '<button class="btn" data-g="order">Order</button>' +
          '</div>' +
        '</div></div>';
    }
    function go(d) { i = (i + d + pics.length) % pics.length; draw(); }
    galleryKeys = pics.length > 1 ? go : function () {};
    o.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      var g = b.dataset.g;
      if (g === "close") closeModal();
      else if (g === "prev") go(-1);
      else if (g === "next") go(1);
      else if (g === "thumb") { i = Number(b.dataset.n); draw(); }
      else if (g === "color") { picked[t.id] = Number(b.dataset.n); draw(); render(); }
      else if (g === "order") openOrder(t);
    });
    draw();
    o.querySelector(".g-close").focus();
  }

  function openOrder(t) {
    var s = state.shop, p = money(t);
    closeModal();
    var o = document.createElement("div");
    o.className = "overlay"; o.id = "overlay";
    o.innerHTML = '<form class="modal" role="dialog" aria-modal="true" aria-label="Order ' + esc(t.name) + '" novalidate>' +
      '<h2>Order ' + esc(t.name) + '</h2>' +
      (p ? '<p class="note">Price: <strong>' + esc(p) + '</strong> · Prints in about ' + esc(t.printTime || s.printTime) + '</p>' : '') +
      '<div class="field"><label>Color</label><div class="swatches" id="o-colors">' + s.colors.map(function (c, n) {
        return '<button type="button" class="sw" style="background:' + esc(c.hex) + '" aria-pressed="' + (picked[t.id] === n) + '" aria-label="' + esc(c.name) + '" data-n="' + n + '"></button>';
      }).join("") + '</div><span class="sw-label" id="o-color-name">' + (picked[t.id] != null ? esc(s.colors[picked[t.id]].name) : "Pick a color") + '</span></div>' +
      '<div class="field"><label for="o-name">Your name</label><input id="o-name" maxlength="80" autocomplete="name" required></div>' +
      '<div class="field"><label for="o-contact">Phone number or email</label><input id="o-contact" maxlength="120" autocomplete="tel" required><span class="hint">So we can tell you when your toy is ready.</span></div>' +
      '<div class="field"><label for="o-note">Anything else? (optional)</label><textarea id="o-note" maxlength="500" placeholder="For example: two of them, or a name on it."></textarea></div>' +
      '<p class="err" id="o-err" hidden></p>' +
      '<p class="note">' + esc(s.howToOrder) + '</p>' +
      '<div class="row"><button type="button" class="btn ghost" data-m="close">Cancel</button><button type="submit" class="btn" id="o-send">Send order</button></div>' +
      '</form>';
    o.addEventListener("click", function (e) { if (e.target === o) closeModal(); });
    document.body.appendChild(o);
    var form = o.querySelector("form"), err = o.querySelector("#o-err"), send = o.querySelector("#o-send");
    o.querySelector('[data-m="close"]').onclick = closeModal;
    o.querySelector("#o-colors").onclick = function (e) {
      var b = e.target.closest("[data-n]"); if (!b) return;
      picked[t.id] = Number(b.dataset.n);
      o.querySelectorAll("#o-colors .sw").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      o.querySelector("#o-color-name").textContent = s.colors[picked[t.id]].name;
      render();
    };
    o.querySelector("#o-name").focus();
    form.onsubmit = function (e) {
      e.preventDefault();
      var name = o.querySelector("#o-name").value.trim(), contact = o.querySelector("#o-contact").value.trim();
      var sel = picked[t.id];
      function fail(m) { err.textContent = m; err.hidden = false; }
      if (sel == null) return fail("Pick a color for your toy.");
      if (!name) return fail("Type your name so we know who the toy is for.");
      if (contact.length < 3) return fail("Add a phone number or email so we can reach you.");
      err.hidden = true; send.disabled = true; send.textContent = "Sending…";
      db.from("orders").insert({
        toy_id: t.id, toy_name: t.name, color: s.colors[sel].name,
        price: t.price === "" || t.price == null ? null : Number(t.price),
        customer_name: name, contact: contact, note: o.querySelector("#o-note").value.trim()
      }).then(function (r) {
        if (r.error) { send.disabled = false; send.textContent = "Send order"; return fail("Your order didn't send. Check your internet and try again."); }
        rememberOrder(t.id); render();
        form.innerHTML = '<h2>Order sent!</h2><p>Thanks, ' + esc(name) + '! We got your order for a <strong>' + esc(s.colors[sel].name) + ' ' + esc(t.name) + '</strong>. We’ll let you know when it’s ready.</p><div class="row"><button type="button" class="btn" data-m="done">Done</button></div>';
        form.querySelector('[data-m="done"]').onclick = closeModal;
      });
    };
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var t = state.toys.find(function (x) { return String(x.id) === b.dataset.id; });
    if (b.dataset.act === "color") { picked[t.id] = Number(b.dataset.i); render(); }
    else if (b.dataset.act === "order") openOrder(t);
    else if (b.dataset.act === "gallery") openGallery(t, 0);
  });

  function publicUrl(path) {
    return /^https?:/.test(path) ? path : db.storage.from(cfg.photoBucket).getPublicUrl(path).data.publicUrl;
  }

  Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db.from("toys").select("*").eq("hidden", false).order("sort").order("created_at"),
    db.rpc("toy_popularity")
  ]).then(function (r) {
    if (r[0].error || r[1].error) throw r[0].error || r[1].error;
    var soldMap = {};
    (r[2].data || []).forEach(function (x) { soldMap[x.toy_id] = Number(x.sold) || 0; });
    var st = r[0].data;
    state = {
      shop: { tagline: st.tagline, currency: st.currency, printTime: st.default_print_time, howToOrder: st.how_to_order, colors: st.colors },
      toys: r[1].data.map(function (t) {
        return { id: t.id, name: t.name, desc: t.description, category: t.category || "", price: t.price, printTime: t.print_time, images: (t.images || []).map(publicUrl) };
      }),
      sold: soldMap
    };
    render();
  }).catch(function () {
    root.innerHTML = '<p class="wrap" style="padding-block:40px">The shop couldn’t load. Please refresh the page.</p>';
  });
})();
