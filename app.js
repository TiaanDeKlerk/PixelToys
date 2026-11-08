// Pixel Toys shop page. Toys, settings and orders live in Supabase (see config.js and supabase/*.sql).
(function () {
  var state = null;
  var root = document.getElementById("root");
  var cfg = window.PIXEL_TOYS;
  var db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hasPrice(t) { return !(t.price === "" || t.price == null); }
  function fmt(n) { return state.shop.currency + Number(n).toFixed(Number(n) % 1 ? 2 : 0); }
  function money(t) { return hasPrice(t) ? fmt(t.price) : ""; }
  function byId(id) { return state.toys.find(function (t) { return t.id === id; }); }
  function sold(t) { return state.sold[t.id] || 0; }

  // ---------- Saved on this device only ----------

  function load(key) {
    try { var v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  var RECENT_KEY = "pixeltoys.recent", CART_KEY = "pixeltoys.cart";
  function recentIds() { return load(RECENT_KEY); }
  function rememberOrder(id) {
    var r = recentIds().filter(function (x) { return x !== id; });
    r.unshift(id);
    save(RECENT_KEY, r.slice(0, 12));
  }

  // Cart lines: { id, color, qty }. Lines for toys no longer in the shop are dropped.
  var cart = [];
  function saveCart() { save(CART_KEY, cart); }
  function cartLines() { return cart.map(function (l) { return { line: l, toy: byId(l.id) }; }).filter(function (x) { return x.toy; }); }
  function cartCount() { return cartLines().reduce(function (n, x) { return n + x.line.qty; }, 0); }
  function cartTotal() { return cartLines().reduce(function (n, x) { return n + (hasPrice(x.toy) ? x.toy.price * x.line.qty : 0); }, 0); }
  function addToCart(id, color, qty) {
    var l = cart.find(function (x) { return x.id === id && x.color === color; });
    if (l) l.qty = Math.min(20, l.qty + qty); else cart.push({ id: id, color: color, qty: qty });
    saveCart();
  }

  // ---------- Shelves ----------

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

  // Small card: picture on top, name and price below. Tapping it opens the product view.
  function card(t, opts) {
    opts = opts || {};
    var pic = t.images[0], p = money(t);
    return '<article class="card"><button class="card-hit" data-act="open" data-id="' + esc(t.id) + '" aria-label="' + esc(t.name) + (p ? ", " + esc(p) : "") + '">' +
      '<span class="photo">' + (pic ? '<img src="' + esc(pic) + '" alt="" loading="lazy">' : '<span class="noimg">?</span>') + '</span>' +
      (opts.rank ? '<span class="rank r' + Math.min(opts.rank, 4) + '">#' + opts.rank + '</span>' : '') +
      '<span class="card-body">' +
        '<span class="card-name">' + esc(t.name) + '</span>' +
        (opts.why ? '<span class="why">' + esc(opts.why) + '</span>' : '') +
        (p ? '<span class="price">' + esc(p) + '</span>' : '<span class="price soon">Price coming soon</span>') +
      '</span></button></article>';
  }

  function section(id, title, sub, cards) {
    return '<section class="shelf" id="' + id + '" aria-labelledby="' + id + '-h">' +
      '<div class="section-head"><h2 id="' + id + '-h">' + title + '</h2>' + (sub ? '<span class="count">' + sub + '</span>' : '') + '</div>' +
      '<div class="grid">' + cards + '</div></section>';
  }

  function cartButton() {
    var n = cartCount();
    return '<button class="cart-btn" data-act="cart" aria-label="Cart, ' + n + (n === 1 ? " item" : " items") + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg>' +
      'Cart' + (n ? '<span class="cart-count">' + n + '</span>' : '') + '</button>';
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
        recent.slice(0, 4).map(function (t) { return card(t); }).join(""));
    }

    var all = toys.map(function (t) { return card(t); }).join("") ||
      '<div class="empty"><strong>New toys coming soon!</strong>The printer is warming up. Check back in a little while.</div>';

    root.innerHTML =
      '<header class="hero"><div class="wrap">' +
        '<div class="hero-top"><h1 class="brand">Pixel <span class="co">Toys</span></h1>' + cartButton() + '</div>' +
        '<p class="tagline">' + esc(s.tagline) + '</p>' +
        '<div class="filament" aria-hidden="true">' + s.colors.map(function (c) { return '<span style="background:' + esc(c.hex) + ';outline:1px solid #2c3430"></span>'; }).join("") + '</div>' +
      '</div></header>' +
      '<section class="wrap steps" aria-label="How ordering works">' +
        '<div class="step"><b>1</b><div><strong>Pick a toy and a color</strong><p>Tap a toy to see it up close.</p></div></div>' +
        '<div class="step"><b>2</b><div><strong>We print it just for you</strong><p>Every toy is printed fresh, layer by layer.</p></div></div>' +
        '<div class="step"><b>3</b><div><strong>It\'s yours!</strong><p>We hand it over when it\'s ready.</p></div></div>' +
      '</section>' +
      '<main class="wrap">' + shelves +
        section("all", "All toys", toys.length + (toys.length === 1 ? " toy" : " toys"), all) +
      '</main>' +
      '<footer><div class="wrap"><span>Pixel Toys · Every toy is 3D printed to order</span><span>Colors: ' + s.colors.map(function (c) { return esc(c.name); }).join(", ") + '</span></div></footer>';
  }

  // ---------- Popups ----------

  var keys = null;
  function closeModal() { var o = document.getElementById("overlay"); if (o) o.remove(); keys = null; }
  function overlay(cls, label) {
    closeModal();
    var o = document.createElement("div");
    o.className = "overlay"; o.id = "overlay";
    o.innerHTML = '<div class="modal ' + cls + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"></div>';
    o.addEventListener("click", function (e) { if (e.target === o) closeModal(); });
    document.body.appendChild(o);
    return o;
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
    else if (keys && e.key === "ArrowLeft") keys(-1);
    else if (keys && e.key === "ArrowRight") keys(1);
  });

  // Product view: big picture, more detail, bigger price, Add to cart.
  function openProduct(t) {
    var s = state.shop, pics = t.images, i = 0, color = null, qty = 1;
    var o = overlay("product", t.name), box = o.firstChild;

    function draw() {
      var many = pics.length > 1, n = sold(t);
      box.innerHTML =
        '<button class="g-close" data-g="close" aria-label="Close">×</button>' +
        '<div class="g-stage">' +
          (pics.length ? '<img src="' + esc(pics[i]) + '" alt="' + esc(t.name) + ', photo ' + (i + 1) + ' of ' + pics.length + '">' : '<span class="noimg">?</span>') +
          (many ? '<button class="g-nav prev" data-g="prev" aria-label="Previous photo">‹</button><button class="g-nav next" data-g="next" aria-label="Next photo">›</button>' +
                  '<span class="g-count">' + (i + 1) + ' / ' + pics.length + '</span>' : '') +
        '</div>' +
        (many ? '<div class="g-thumbs">' + pics.map(function (src, k) {
          return '<button data-g="thumb" data-n="' + k + '" aria-label="Photo ' + (k + 1) + '" aria-current="' + (k === i) + '"><img src="' + esc(src) + '" alt=""></button>';
        }).join("") + '</div>' : '') +
        '<div class="g-info">' +
          (t.category || n ? '<div class="tags">' + (t.category ? '<span class="tag">' + esc(t.category) + '</span>' : '') +
            (n ? '<span class="tag hot">' + n + ' sold</span>' : '') + '</div>' : '') +
          '<h2>' + esc(t.name) + '</h2>' +
          (hasPrice(t) ? '<p class="big-price">' + esc(money(t)) + '</p>' : '<p class="price soon">Price coming soon</p>') +
          (t.desc ? '<p class="desc">' + esc(t.desc) + '</p>' : '') +
          '<p class="ptime">Prints in about ' + esc(t.printTime || s.printTime) + '</p>' +
          '<div class="field"><span class="label">Color: <strong>' + (color != null ? esc(s.colors[color].name) : "pick one") + '</strong></span><div class="swatches">' +
            s.colors.map(function (c, k) {
              return '<button class="sw" style="background:' + esc(c.hex) + '" aria-pressed="' + (color === k) + '" aria-label="' + esc(c.name) + '" data-g="color" data-n="' + k + '"></button>';
            }).join("") + '</div></div>' +
          '<div class="buy-row">' +
            '<div class="qty" role="group" aria-label="How many"><button data-g="minus" aria-label="One less">−</button><span aria-live="polite">' + qty + '</span><button data-g="plus" aria-label="One more">+</button></div>' +
            '<button class="btn add" data-g="add"' + (hasPrice(t) ? '' : ' disabled') + '>Add to cart</button>' +
          '</div>' +
          '<p class="err" id="p-err" hidden></p>' +
        '</div>';
    }
    function go(d) { if (pics.length > 1) { i = (i + d + pics.length) % pics.length; draw(); } }
    keys = go;
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      var g = b.dataset.g;
      if (g === "close") closeModal();
      else if (g === "prev") go(-1);
      else if (g === "next") go(1);
      else if (g === "thumb") { i = Number(b.dataset.n); draw(); }
      else if (g === "color") { color = Number(b.dataset.n); draw(); }
      else if (g === "minus") { qty = Math.max(1, qty - 1); draw(); }
      else if (g === "plus") { qty = Math.min(20, qty + 1); draw(); }
      else if (g === "add") {
        if (color == null) { var err = box.querySelector("#p-err"); err.textContent = "Pick a color first."; err.hidden = false; return; }
        addToCart(t.id, s.colors[color].name, qty);
        render();
        box.querySelector(".buy-row").outerHTML = '<div class="added"><span>Added ' + qty + ' × ' + esc(s.colors[color].name) + ' ' + esc(t.name) + '</span>' +
          '<div class="row"><button class="btn ghost" data-g="close">Keep shopping</button><button class="btn cyan" data-g="to-cart">View cart</button></div></div>';
      }
      else if (g === "to-cart") openCart();
    });
    draw();
    box.querySelector(".g-close").focus();
  }

  function openCart() {
    var s = state.shop;
    var o = overlay("cart", "Your cart"), box = o.firstChild;
    function draw() {
      var lines = cartLines();
      box.innerHTML = '<button class="g-close" data-c="close" aria-label="Close">×</button><h2>Your cart</h2>' +
        (lines.length ? '<ul class="cart-list">' + lines.map(function (x, k) {
          var t = x.toy, l = x.line;
          return '<li><span class="c-pic">' + (t.images[0] ? '<img src="' + esc(t.images[0]) + '" alt="">' : '?') + '</span>' +
            '<span class="c-info"><strong>' + esc(t.name) + '</strong><span>' + esc(l.color) + '</span>' +
              '<span class="qty small"><button data-c="minus" data-k="' + k + '" aria-label="One less">−</button><span>' + l.qty + '</span><button data-c="plus" data-k="' + k + '" aria-label="One more">+</button></span></span>' +
            '<span class="c-right"><b>' + (hasPrice(t) ? esc(fmt(t.price * l.qty)) : "") + '</b><button class="link" data-c="remove" data-k="' + k + '">Remove</button></span></li>';
        }).join("") + '</ul>' +
          '<div class="cart-total"><span>Total</span><b>' + esc(fmt(cartTotal())) + '</b></div>' +
          '<div class="row"><button class="btn ghost" data-c="close">Keep shopping</button><button class="btn" data-c="checkout">Check out</button></div>'
        : '<p class="note">Your cart is empty. Tap a toy and choose "Add to cart".</p><div class="row"><button class="btn" data-c="close">Start shopping</button></div>');
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]"); if (!b) return;
      var c = b.dataset.c, lines = cartLines(), l = b.dataset.k != null ? lines[Number(b.dataset.k)].line : null;
      if (c === "close") return closeModal();
      if (c === "checkout") return openCheckout();
      if (c === "minus") l.qty = Math.max(1, l.qty - 1);
      if (c === "plus") l.qty = Math.min(20, l.qty + 1);
      if (c === "remove") cart.splice(cart.indexOf(l), 1);
      saveCart(); draw(); render();
    });
    draw();
  }

  function openCheckout() {
    var s = state.shop, lines = cartLines();
    var o = overlay("checkout", "Check out"), box = o.firstChild;
    box.innerHTML = '<form novalidate><h2>Check out</h2>' +
      '<ul class="sum">' + lines.map(function (x) {
        return '<li><span>' + x.line.qty + ' × ' + esc(x.line.color) + ' ' + esc(x.toy.name) + '</span><b>' + esc(fmt(x.toy.price * x.line.qty)) + '</b></li>';
      }).join("") + '<li class="tot"><span>Total</span><b>' + esc(fmt(cartTotal())) + '</b></li></ul>' +
      '<div class="field"><label for="o-name">Your name</label><input id="o-name" maxlength="80" autocomplete="name" required></div>' +
      '<div class="field"><label for="o-contact">Phone number or email</label><input id="o-contact" maxlength="120" autocomplete="tel" required><span class="hint">So we can tell you when your toys are ready.</span></div>' +
      '<div class="field"><label for="o-note">Anything else? (optional)</label><textarea id="o-note" maxlength="500" placeholder="For example: a name on it."></textarea></div>' +
      '<p class="err" id="o-err" hidden></p>' +
      '<p class="note">' + esc(s.howToOrder) + '</p>' +
      '<div class="row"><button type="button" class="btn ghost" data-m="back">Back to cart</button><button type="submit" class="btn" id="o-send">Send order</button></div></form>';
    var form = box.querySelector("form"), err = box.querySelector("#o-err"), send = box.querySelector("#o-send");
    box.querySelector('[data-m="back"]').onclick = openCart;
    box.querySelector("#o-name").focus();
    form.onsubmit = function (e) {
      e.preventDefault();
      var name = box.querySelector("#o-name").value.trim(), contact = box.querySelector("#o-contact").value.trim();
      var note = box.querySelector("#o-note").value.trim();
      function fail(m) { err.textContent = m; err.hidden = false; }
      if (!name) return fail("Type your name so we know who the toys are for.");
      if (contact.length < 3) return fail("Add a phone number or email so we can reach you.");
      err.hidden = true; send.disabled = true; send.textContent = "Sending…";
      var rows = lines.map(function (x) {
        return { toy_id: x.toy.id, toy_name: x.toy.name, color: x.line.color, quantity: x.line.qty,
          price: hasPrice(x.toy) ? Number(x.toy.price) * x.line.qty : null,
          customer_name: name, contact: contact, note: note };
      });
      db.from("orders").insert(rows).then(function (r) {
        if (r.error) { send.disabled = false; send.textContent = "Send order"; return fail("Your order didn't send. Check your internet and try again."); }
        lines.forEach(function (x) { rememberOrder(x.toy.id); });
        cart = []; saveCart(); render();
        box.innerHTML = '<h2>Order sent!</h2><p>Thanks, ' + esc(name) + '! We got your order. We’ll let you know when your toys are ready.</p><div class="row"><button type="button" class="btn" id="o-done">Done</button></div>';
        box.querySelector("#o-done").onclick = closeModal;
      });
    };
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "open") openProduct(byId(b.dataset.id));
    else if (b.dataset.act === "cart") openCart();
  });

  // ---------- Load ----------

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
    cart = load(CART_KEY).filter(function (l) { return l && byId(l.id) && l.qty > 0; });
    render();
  }).catch(function () {
    root.innerHTML = '<p class="wrap" style="padding-block:40px">The shop couldn’t load. Please refresh the page.</p>';
  });
})();
