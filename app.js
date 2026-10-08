// Pixel Toys shop page. All shop content lives in shop.json; edit that file to add toys.
(function () {
  var state = null;
  var picked = {};
  var root = document.getElementById("root");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(t) { return t.price === "" || t.price == null ? "" : state.shop.currency + Number(t.price).toFixed(Number(t.price) % 1 ? 2 : 0); }

  function render() {
    var s = state.shop;
    var shown = state.toys.filter(function (t) { return !t.hidden; });
    var cards = shown.map(function (t) {
      var sel = picked[t.id];
      var sw = s.colors.map(function (c, i) {
        return '<button class="sw" style="background:' + esc(c.hex) + '" aria-pressed="' + (sel === i) + '" aria-label="' + esc(c.name) + '" data-act="color" data-id="' + esc(t.id) + '" data-i="' + i + '"></button>';
      }).join("");
      var p = money(t);
      return '<article class="card">' +
        '<div class="photo">' + (t.img ? '<img src="' + esc(t.img) + '" alt="' + esc(t.name) + '" loading="lazy">' : '<span class="noimg">?</span>') + '</div>' +
        '<div class="card-body">' +
          '<h3>' + esc(t.name) + '</h3>' +
          (t.desc ? '<p class="desc">' + esc(t.desc) + '</p>' : '') +
          '<div class="swatches">' + sw + '</div>' +
          '<div class="sw-label">' + (sel != null ? esc(s.colors[sel].name) : "Pick a color") + '</div>' +
          '<div class="card-foot">' +
            (p ? '<span class="price">' + esc(p) + '</span>' : '<span class="price soon">Price coming soon</span>') +
            '<button class="btn" data-act="order" data-id="' + esc(t.id) + '">Order</button>' +
          '</div>' +
        '</div></article>';
    }).join("");
    if (!shown.length) cards = '<div class="empty"><strong>New toys coming soon!</strong>The printer is warming up. Check back in a little while.</div>';

    root.innerHTML =
      '<header class="hero"><div class="wrap">' +
        '<h1 class="brand">Pixel <span class="co">Toys</span></h1>' +
        '<p class="tagline">' + esc(s.tagline) + '</p>' +
        '<div class="filament" aria-hidden="true">' + s.colors.map(function (c) { return '<span style="background:' + esc(c.hex) + ';outline:1px solid #2c3430"></span>'; }).join("") + '</div>' +
      '</div></header>' +
      '<section class="wrap steps" aria-label="How ordering works">' +
        '<div class="step"><b>1</b><div><strong>Pick a toy and a color</strong><p>Choose from the toys below.</p></div></div>' +
        '<div class="step"><b>2</b><div><strong>We print it just for you</strong><p>Every toy is printed fresh, layer by layer. Takes about ' + esc(s.printTime) + '.</p></div></div>' +
        '<div class="step"><b>3</b><div><strong>It\'s yours!</strong><p>We hand it over when it\'s ready.</p></div></div>' +
      '</section>' +
      '<main class="wrap">' +
        '<div class="section-head"><h2>The toys</h2><span class="count">' + shown.length + (shown.length === 1 ? " toy" : " toys") + '</span></div>' +
        '<div class="grid">' + cards + '</div>' +
      '</main>' +
      '<footer><div class="wrap"><span>Pixel Toys · Every toy is 3D printed to order</span><span>Colors: ' + s.colors.map(function (c) { return esc(c.name); }).join(", ") + '</span></div></footer>';
  }

  function closeModal() { var o = document.getElementById("overlay"); if (o) o.remove(); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  function openOrder(t) {
    var sel = picked[t.id];
    var color = sel != null ? state.shop.colors[sel].name : null;
    var p = money(t);
    var text = "Hi! I'd like to order from Pixel Toys:\n" + t.name + (color ? " in " + color : "") + (p ? " (" + p + ")" : "");
    closeModal();
    var o = document.createElement("div");
    o.className = "overlay"; o.id = "overlay";
    o.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
      '<h2>Order ' + esc(t.name) + '</h2>' +
      (color ? "" : '<p class="err">You haven\'t picked a color yet. Close this and tap a color dot first, or say which color you want.</p>') +
      '<div class="order-box" id="order-text">' + esc(text) + '</div>' +
      '<p class="note"><strong>How to order:</strong> ' + esc(state.shop.howToOrder) + '</p>' +
      '<div class="row"><button class="btn ghost" data-m="close">Close</button><button class="btn cyan" data-m="copy">Copy order</button></div>' +
      '</div>';
    o.addEventListener("click", function (e) { if (e.target === o) closeModal(); });
    document.body.appendChild(o);
    o.querySelector('[data-m="close"]').onclick = closeModal;
    var cb = o.querySelector('[data-m="copy"]');
    cb.focus();
    cb.onclick = function () {
      function selectIt() {
        var r = document.createRange(); r.selectNodeContents(document.getElementById("order-text"));
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); cb.textContent = "Selected, press Ctrl+C";
      }
      try { navigator.clipboard.writeText(text).then(function () { cb.textContent = "Copied!"; }, selectIt); }
      catch (e) { selectIt(); }
    };
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var t = state.toys.find(function (x) { return String(x.id) === b.dataset.id; });
    if (b.dataset.act === "color") { picked[t.id] = Number(b.dataset.i); render(); }
    else if (b.dataset.act === "order") openOrder(t);
  });

  fetch("shop.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) { state = data; render(); })
    .catch(function () { root.innerHTML = '<p class="wrap" style="padding-block:40px">The shop couldn\'t load. Please refresh the page.</p>'; });
})();
