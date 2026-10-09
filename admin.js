// Pixel Toys "Edit shop" page: sign in, manage toys and photos, read orders, change settings.
(function () {
  var cfg = window.PIXEL_TOYS;
  var db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  var bucket = db.storage.from(cfg.photoBucket);
  var root = document.getElementById("root");
  var S = { tab: "toys", filter: "open", user: null, settings: null, toys: [], orders: [] };
  var OPEN = ["new", "printing", "ready"];
  var STATUS = { "new": "New", printing: "Printing", ready: "Ready to hand over", done: "Done", cancelled: "Cancelled" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cur() { return S.settings ? S.settings.currency : "R"; }
  function money(n) { return n == null || n === "" ? "" : cur() + Number(n).toFixed(Number(n) % 1 ? 2 : 0); }
  function money2(n) { return cur() + Number(n).toFixed(2); }
  function url(path) { return /^https?:/.test(path) ? path : bucket.getPublicUrl(path).data.publicUrl; }
  function num(v) { v = String(v).trim().replace(",", "."); return v === "" ? null : Math.max(0, Number(v)); }
  function hoursText(h) {
    if (!h) return "";
    if (h < 1) return Math.round(h * 60) + " minutes";
    return (Math.round(h * 2) / 2) + (h === 1 ? " hour" : " hours");
  }
  function when(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function toast(msg, bad) {
    var t = document.createElement("div");
    t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg; t.setAttribute("role", "status");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 5000 : 2500);
  }
  function closeModal() { var o = document.getElementById("overlay"); if (o) { if (o.onclose) o.onclose(); o.remove(); } }
  function modal(html) {
    closeModal();
    var o = document.createElement("div");
    o.className = "overlay"; o.id = "overlay";
    o.innerHTML = '<form class="modal" novalidate role="dialog" aria-modal="true">' + html + '</form>';
    document.body.appendChild(o);
    return o;
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  // ---------- Sign in ----------

  function shell(inner) {
    root.innerHTML =
      '<header class="a-top"><div class="wrap"><h1 class="a-brand">Pixel <span class="co">Toys</span><small>Edit shop</small></h1>' +
      (S.user ? '<div class="who"><span>' + esc(S.user.email) + '</span><a class="btn ghost small" href="./" target="_blank" rel="noopener">View shop</a><button class="btn ghost small" data-act="signout">Sign out</button></div>' : '') +
      '</div></header>' + inner;
  }

  function renderLogin(msg) {
    S.user = null;
    shell('<main class="wrap"><form class="modal login" id="login" novalidate>' +
      '<h2>Sign in</h2>' +
      '<p class="note">Only the shop owner can edit Pixel Toys.</p>' +
      '<div class="field"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="username" required></div>' +
      '<div class="field"><label for="l-pass">Password</label><input id="l-pass" type="password" autocomplete="current-password" required></div>' +
      '<p class="err" id="l-err"' + (msg ? '' : ' hidden') + '>' + esc(msg || "") + '</p>' +
      '<div class="row"><button class="btn" id="l-go" type="submit">Sign in</button></div>' +
      '</form></main>');
    var f = document.getElementById("login");
    f.onsubmit = function (e) {
      e.preventDefault();
      var err = document.getElementById("l-err"), go = document.getElementById("l-go");
      go.disabled = true; go.textContent = "Signing in…";
      db.auth.signInWithPassword({ email: f.querySelector("#l-email").value.trim(), password: f.querySelector("#l-pass").value }).then(function (r) {
        if (r.error) {
          go.disabled = false; go.textContent = "Sign in";
          err.textContent = "That email and password don't match. Check them and try again."; err.hidden = false;
          return;
        }
        start(r.data.user);
      });
    };
    document.getElementById("l-email").focus();
  }

  function start(user) {
    S.user = user;
    shell('<main class="wrap a-main"><p class="note">Loading your shop…</p></main>');
    db.rpc("is_admin").then(function (r) {
      if (r.error || !r.data) {
        shell('<main class="wrap a-main"><div class="panel-box"><h3>This account can\'t edit the shop yet</h3>' +
          '<p class="note">You\'re signed in, but this account isn\'t on the list of shop owners. In Supabase, run <strong>make-me-admin.sql</strong> in the SQL Editor, then sign in again.</p></div></main>');
        return;
      }
      loadAll();
    });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.dataset.act;
    if (a === "signout") db.auth.signOut().then(function () { renderLogin(); });
    else if (a === "tab") { S.tab = b.dataset.tab; render(); }
    else if (a === "filter") { S.filter = b.dataset.f; render(); }
    else if (a === "add-toy") openToy(null);
    else if (a === "edit-toy") openToy(S.toys.find(function (t) { return t.id === b.dataset.id; }));
    else if (a === "del-order") deleteOrder(b);
  });
  root.addEventListener("change", function (e) {
    if (e.target.matches("select.status")) setStatus(e.target.dataset.id, e.target.value, e.target);
  });

  // ---------- Data ----------

  function loadAll() {
    return Promise.all([
      db.from("settings").select("*").eq("id", 1).single(),
      db.from("toys").select("*").order("sort").order("created_at"),
      db.from("orders").select("*").order("created_at", { ascending: false })
    ]).then(function (r) {
      var bad = r.find(function (x) { return x.error; });
      if (bad) { toast("Couldn't load the shop. Refresh the page to try again.", true); return; }
      S.settings = r[0].data; S.toys = r[1].data; S.orders = r[2].data;
      render();
    });
  }

  // ---------- Layout ----------

  function render() {
    var fresh = S.orders.filter(function (o) { return o.status === "new"; }).length;
    var tabs = [["toys", "Toys"], ["orders", "Orders"], ["settings", "Settings"]].map(function (t) {
      return '<button class="tab" role="tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] +
        (t[0] === "orders" && fresh ? '<span class="badge">' + fresh + ' new</span>' : '') + '</button>';
    }).join("");
    var body = S.tab === "toys" ? toysView() : S.tab === "orders" ? ordersView() : '<div id="settings-slot"></div>';
    shell('<nav class="wrap tabs" role="tablist">' + tabs + '</nav><main class="wrap a-main">' + body + '</main>');
    if (S.tab === "settings") settingsView(document.getElementById("settings-slot"));
  }

  function toysView() {
    var rows = S.toys.map(function (t) {
      var pic = t.images && t.images[0];
      return '<div class="a-row">' +
        (pic ? '<img class="thumb" src="' + esc(url(pic)) + '" alt="">' : '<span class="thumb">?</span>') +
        '<div><h3>' + esc(t.name) + '</h3><div class="meta">' +
          (t.price != null ? '<b>' + esc(money(t.price)) + '</b>' : '<span>No price yet</span>') +
          (t.print_time ? '<span>' + esc(t.print_time) + '</span>' : '') +
          '<span>' + (t.images ? t.images.length : 0) + ' photo' + ((t.images || []).length === 1 ? '' : 's') + '</span>' +
          (t.hidden ? '<span class="tag">Hidden</span>' : '') +
        '</div></div>' +
        '<button class="btn small cyan" data-act="edit-toy" data-id="' + t.id + '">Edit</button></div>';
    }).join("");
    return '<div class="a-head"><h2>Toys</h2><button class="btn" data-act="add-toy">+ Add a toy</button></div>' +
      (rows ? '<div class="a-list">' + rows + '</div>' : '<div class="empty"><strong>No toys yet</strong>Tap "Add a toy" to put your first toy in the shop.</div>');
  }

  // ---------- Toy editor ----------

  function openToy(t) {
    var isNew = !t;
    var d = t ? JSON.parse(JSON.stringify(t)) : { id: crypto.randomUUID(), name: "", description: "", price: null, grams: null, print_hours: null, print_time: "", images: [], hidden: false };
    var uploaded = [], removed = [], busy = 0, saved = false;
    var o = modal(
      '<h2>' + (isNew ? "Add a toy" : "Edit toy") + '</h2>' +
      '<div class="field"><label>Photos</label><div class="pics-edit" id="t-pics"></div><span class="hint">Use your own photos. The one marked "Cover" shows on the shop card.</span></div>' +
      '<div class="field"><label for="t-name">Toy name</label><input id="t-name" maxlength="80" value="' + esc(d.name) + '" placeholder="Flexi dragon"></div>' +
      '<div class="field"><label for="t-desc">Short description</label><textarea id="t-desc" maxlength="400" placeholder="Wiggly, bendy and about as long as your hand.">' + esc(d.description) + '</textarea></div>' +
      '<div class="panel-box" style="padding:14px"><h3>Price calculator</h3>' +
        '<div class="two">' +
          '<div class="field"><label for="t-grams">Filament (grams)</label><input id="t-grams" inputmode="decimal" value="' + esc(d.grams == null ? "" : d.grams) + '" placeholder="83"></div>' +
          '<div class="field"><label for="t-hours">Print time (hours)</label><input id="t-hours" inputmode="decimal" value="' + esc(d.print_hours == null ? "" : d.print_hours) + '" placeholder="9"></div>' +
        '</div><span class="hint">Copy both numbers from Bambu Studio after slicing.</span><div id="t-calc"></div></div>' +
      '<div class="two">' +
        '<div class="field"><label for="t-price">Price (' + esc(cur()) + ')</label><input id="t-price" inputmode="decimal" value="' + esc(d.price == null ? "" : d.price) + '"><span class="hint">Leave empty to show "Price coming soon".</span></div>' +
        '<div class="field"><label for="t-ptime">Print time shown to customers</label><input id="t-ptime" maxlength="40" value="' + esc(d.print_time) + '" placeholder="9 hours"></div>' +
      '</div>' +
      '<label class="check"><input type="checkbox" id="t-hidden"' + (d.hidden ? " checked" : "") + '> Hide this toy from customers for now</label>' +
      '<p class="err" id="t-err" hidden></p>' +
      '<div class="row">' + (isNew ? "" : '<button type="button" class="btn danger" id="t-del">Delete toy</button>') +
        '<button type="button" class="btn ghost" id="t-cancel">Cancel</button><button type="submit" class="btn" id="t-save">' + (isNew ? "Add toy" : "Save changes") + '</button></div>'
    );
    var $ = function (s) { return o.querySelector(s); };
    var err = $("#t-err");
    function fail(m) { err.textContent = m; err.hidden = false; }

    // Throw away photos uploaded in an editor that was never saved.
    o.onclose = function () { if (!saved && uploaded.length) bucket.remove(uploaded); };

    function drawPics() {
      $("#t-pics").innerHTML = d.images.map(function (p, i) {
        return '<div class="pic' + (i === 0 ? " cover" : "") + '"><img src="' + esc(url(p)) + '" alt="Photo ' + (i + 1) + '">' +
          '<button type="button" class="x" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">×</button>' +
          '<button type="button" class="star" data-cover="' + i + '">' + (i === 0 ? "Cover" : "Make cover") + '</button></div>';
      }).join("") +
        (busy ? '<div class="pic busy">Uploading…</div>' : '') +
        '<label class="add-pic">+ Add photos<input type="file" id="t-file" accept="image/*" multiple></label>';
      $("#t-file").onchange = function (e) { addFiles([].slice.call(e.target.files)); };
    }
    $("#t-pics").onclick = function (e) {
      var rm = e.target.closest("[data-rm]"), cv = e.target.closest("[data-cover]");
      if (rm) { var p = d.images.splice(Number(rm.dataset.rm), 1)[0]; if (uploaded.indexOf(p) >= 0) { uploaded.splice(uploaded.indexOf(p), 1); bucket.remove([p]); } else removed.push(p); drawPics(); }
      else if (cv) { var i = Number(cv.dataset.cover); d.images.unshift(d.images.splice(i, 1)[0]); drawPics(); }
    };
    function addFiles(files) {
      files.filter(function (f) { return /^image\//.test(f.type); }).forEach(function (f) {
        busy++; drawPics();
        shrink(f).then(function (blob) {
          var path = d.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + ".jpg";
          return bucket.upload(path, blob, { contentType: "image/jpeg" }).then(function (r) {
            if (r.error) throw r.error;
            uploaded.push(path); d.images.push(path);
          });
        }).catch(function () { toast("A photo didn't upload. Try a JPG or PNG under 10 MB.", true); })
          .then(function () { busy--; drawPics(); });
      });
    }
    drawPics();

    function drawCalc() {
      var g = num($("#t-grams").value), h = num($("#t-hours").value);
      if (g == null && h == null) { $("#t-calc").innerHTML = ""; return; }
      var c = window.pixelPrice(g, h, S.settings), s = S.settings;
      $("#t-calc").innerHTML = '<div class="calc">' +
        '<div class="line"><span>Plastic: ' + (g || 0) + ' g × ' + esc(money2(s.price_per_kg / 1000)) + '</span><span>' + money2(c.plastic) + '</span></div>' +
        '<div class="line"><span>Printing: ' + (h || 0) + ' h × ' + esc(money(s.rate_per_hour)) + '</span><span>' + money2(c.printing) + '</span></div>' +
        '<div class="line total"><span>Cost</span><span>' + money2(c.cost) + '</span></div>' +
        '<div class="line"><span>Profit (' + s.profit_pct + '%)</span><span>' + money2(c.profit) + '</span></div>' +
        '<div class="line"><span>Electricity (' + s.electricity_pct + '%)</span><span>' + money2(c.electricity) + '</span></div>' +
        '<div class="line total"><span>Total</span><span>' + money2(c.exact) + '</span></div>' +
        '<div class="line final"><span>Price</span><span>' + esc(money(c.price)) + '</span></div>' +
        '<button type="button" class="btn small yellow use" id="t-use">Use ' + esc(money(c.price)) + '</button></div>';
      $("#t-use").onclick = function () {
        $("#t-price").value = c.price;
        if (!$("#t-ptime").value.trim() && h) $("#t-ptime").value = hoursText(h);
      };
    }
    $("#t-grams").oninput = drawCalc; $("#t-hours").oninput = drawCalc; drawCalc();

    $("#t-cancel").onclick = closeModal;
    o.addEventListener("click", function (e) { if (e.target === o) closeModal(); });

    var del = $("#t-del");
    if (del) del.onclick = function () {
      if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "Tap again to delete"; return; }
      del.disabled = true;
      db.from("toys").delete().eq("id", d.id).then(function (r) {
        if (r.error) { del.disabled = false; return fail("Couldn't delete the toy. Try again."); }
        var all = (t.images || []).concat(uploaded);
        if (all.length) bucket.remove(all);
        saved = true; closeModal(); toast("Toy deleted"); loadAll();
      });
    };

    $("form").onsubmit = function (e) {
      e.preventDefault();
      if (busy) return fail("Wait for the photos to finish uploading.");
      var name = $("#t-name").value.trim();
      if (!name) return fail("Give the toy a name first.");
      var row = {
        id: d.id, name: name, description: $("#t-desc").value.trim(),
        price: num($("#t-price").value), grams: num($("#t-grams").value), print_hours: num($("#t-hours").value),
        print_time: $("#t-ptime").value.trim(), images: d.images, hidden: $("#t-hidden").checked
      };
      var btn = $("#t-save"); btn.disabled = true; btn.textContent = "Saving…";
      var q = isNew ? db.from("toys").insert(row) : db.from("toys").update(row).eq("id", d.id);
      q.then(function (r) {
        if (r.error) { btn.disabled = false; btn.textContent = isNew ? "Add toy" : "Save changes"; return fail("Couldn't save. Check your internet and try again."); }
        saved = true;
        if (removed.length) bucket.remove(removed);
        closeModal(); toast(isNew ? "Toy added to the shop" : "Toy saved"); loadAll();
      });
    };
    $("#t-name").focus();
  }

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), src = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1400, k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var g = c.getContext("2d"); g.fillStyle = "#1d231f"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(src);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("encode")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(src); reject(new Error("load")); };
      img.src = src;
    });
  }

  // ---------- Orders ----------

  function ordersView() {
    var f = S.filter;
    var list = S.orders.filter(function (o) { return f === "all" ? true : f === "open" ? OPEN.indexOf(o.status) >= 0 : o.status === f; });
    var filters = [["open", "To do"], ["done", "Done"], ["cancelled", "Cancelled"], ["all", "All"]].map(function (x) {
      return '<button class="tab" data-act="filter" data-f="' + x[0] + '" aria-selected="' + (f === x[0]) + '">' + x[1] + '</button>';
    }).join("");
    var cards = list.map(function (o) {
      return '<article class="order' + (o.status === "new" ? " is-new" : "") + '">' +
        '<div class="top"><h3>' + esc(o.toy_name) + (o.color ? ' · ' + esc(o.color) : '') + '</h3><span class="when">' + esc(when(o.created_at)) + '</span></div>' +
        '<dl><dt>Customer</dt><dd>' + esc(o.customer_name) + '</dd>' +
          '<dt>Contact</dt><dd class="contact">' + esc(o.contact) + '</dd>' +
          (o.price != null ? '<dt>Price</dt><dd>' + esc(money(o.price)) + '</dd>' : '') +
          (o.note ? '<dt>Note</dt><dd>' + esc(o.note) + '</dd>' : '') + '</dl>' +
        '<div class="actions"><select class="status" data-id="' + o.id + '" aria-label="Order status">' +
          Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + '>' + STATUS[k] + '</option>'; }).join("") +
        '</select><button class="btn small ghost" data-act="del-order" data-id="' + o.id + '">Delete</button></div></article>';
    }).join("");
    return '<div class="a-head"><h2>Orders</h2><div class="filters">' + filters + '</div></div>' +
      '<p class="note">Customer names and contact details are private. Only shop owners can see them.</p>' +
      (cards ? '<div class="a-list">' + cards + '</div>' : '<div class="empty"><strong>' + (f === "open" ? "No orders to do" : "Nothing here") + '</strong>New orders from the shop show up here.</div>');
  }

  function setStatus(id, status, el) {
    el.disabled = true;
    db.from("orders").update({ status: status }).eq("id", id).then(function (r) {
      el.disabled = false;
      if (r.error) { toast("Couldn't change the status. Try again.", true); return; }
      var o = S.orders.find(function (x) { return x.id === id; }); if (o) o.status = status;
      toast("Marked as " + STATUS[status].toLowerCase()); render();
    });
  }

  function deleteOrder(b) {
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Tap again to delete"; return; }
    b.disabled = true;
    db.from("orders").delete().eq("id", b.dataset.id).then(function (r) {
      if (r.error) { b.disabled = false; toast("Couldn't delete the order. Try again.", true); return; }
      S.orders = S.orders.filter(function (x) { return x.id !== b.dataset.id; });
      toast("Order deleted"); render();
    });
  }

  // ---------- Settings ----------

  function settingsView(slot) {
    var s = JSON.parse(JSON.stringify(S.settings));
    slot.innerHTML = '<form id="set" class="a-main" style="padding:0" novalidate>' +
      '<div class="panel-box"><h3>Shop</h3>' +
        '<div class="field"><label for="s-tag">Tagline</label><input id="s-tag" maxlength="80" value="' + esc(s.tagline) + '"></div>' +
        '<div class="two"><div class="field"><label for="s-cur">Money sign</label><input id="s-cur" maxlength="4" value="' + esc(s.currency) + '"></div>' +
        '<div class="field"><label for="s-time">Default print time</label><input id="s-time" maxlength="40" value="' + esc(s.default_print_time) + '"><span class="hint">Used when a toy has no print time of its own.</span></div></div>' +
        '<div class="field"><label for="s-how">Message on the order form</label><textarea id="s-how" maxlength="300">' + esc(s.how_to_order) + '</textarea></div>' +
      '</div>' +
      '<div class="panel-box"><h3>Pricing</h3>' +
        '<div class="two">' +
          '<div class="field"><label for="s-kg">Filament price per kg (' + esc(s.currency) + ')</label><input id="s-kg" inputmode="decimal" value="' + s.price_per_kg + '"></div>' +
          '<div class="field"><label for="s-hr">Charge per print hour (' + esc(s.currency) + ')</label><input id="s-hr" inputmode="decimal" value="' + s.rate_per_hour + '"></div>' +
          '<div class="field"><label for="s-profit">Profit (%)</label><input id="s-profit" inputmode="decimal" value="' + s.profit_pct + '"></div>' +
          '<div class="field"><label for="s-elec">Electricity (%)</label><input id="s-elec" inputmode="decimal" value="' + s.electricity_pct + '"></div>' +
        '</div><p class="note" id="s-example"></p>' +
        '<span class="hint">Changing these doesn\'t change prices you already set. Open a toy and tap "Use" in its calculator to update it.</span>' +
      '</div>' +
      '<div class="panel-box"><h3>Filament colors</h3><div class="a-list" id="s-colors"></div>' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="btn small ghost" id="s-addc">+ Add a color</button></div></div>' +
      '<p class="err" id="s-err" hidden></p>' +
      '<div class="row"><button type="submit" class="btn" id="s-save">Save settings</button></div></form>';
    var $ = function (q) { return slot.querySelector(q); };

    function drawColors() {
      $("#s-colors").innerHTML = s.colors.map(function (c, i) {
        return '<div class="color-row"><input type="color" value="' + esc(c.hex) + '" data-hex="' + i + '" aria-label="Color for ' + esc(c.name) + '">' +
          '<div class="field"><input value="' + esc(c.name) + '" maxlength="30" data-name="' + i + '" aria-label="Color name"></div>' +
          '<button type="button" class="btn small ghost" data-rmc="' + i + '">Remove</button></div>';
      }).join("");
    }
    $("#s-colors").oninput = function (e) {
      if (e.target.dataset.hex != null) s.colors[e.target.dataset.hex].hex = e.target.value;
      if (e.target.dataset.name != null) s.colors[e.target.dataset.name].name = e.target.value;
    };
    $("#s-colors").onclick = function (e) {
      var b = e.target.closest("[data-rmc]"); if (!b) return;
      s.colors.splice(Number(b.dataset.rmc), 1); drawColors();
    };
    $("#s-addc").onclick = function () { s.colors.push({ name: "New color", hex: "#ffffff" }); drawColors(); };
    drawColors();

    function example() {
      var t = { price_per_kg: num($("#s-kg").value), rate_per_hour: num($("#s-hr").value), profit_pct: num($("#s-profit").value), electricity_pct: num($("#s-elec").value) };
      var c = window.pixelPrice(83, 9, t);
      $("#s-example").textContent = "Example: an 83 g toy that prints in 9 hours costs " + $("#s-cur").value.trim() + c.price + ".";
    }
    ["#s-kg", "#s-hr", "#s-profit", "#s-elec", "#s-cur"].forEach(function (q) { $(q).oninput = example; });
    example();

    $("#set").onsubmit = function (e) {
      e.preventDefault();
      var err = $("#s-err");
      var row = {
        tagline: $("#s-tag").value.trim() || s.tagline, currency: $("#s-cur").value.trim(),
        default_print_time: $("#s-time").value.trim() || s.default_print_time, how_to_order: $("#s-how").value.trim() || s.how_to_order,
        price_per_kg: num($("#s-kg").value), rate_per_hour: num($("#s-hr").value),
        profit_pct: num($("#s-profit").value), electricity_pct: num($("#s-elec").value),
        colors: s.colors.filter(function (c) { return c.name.trim(); }).map(function (c) { return { name: c.name.trim(), hex: c.hex }; }),
        updated_at: new Date().toISOString()
      };
      if ([row.price_per_kg, row.rate_per_hour, row.profit_pct, row.electricity_pct].some(function (v) { return v == null || isNaN(v); })) {
        err.textContent = "Fill in all four pricing numbers."; err.hidden = false; return;
      }
      if (!row.colors.length) { err.textContent = "Keep at least one color."; err.hidden = false; return; }
      var btn = $("#s-save"); btn.disabled = true; btn.textContent = "Saving…";
      db.from("settings").update(row).eq("id", 1).select().single().then(function (r) {
        btn.disabled = false; btn.textContent = "Save settings";
        if (r.error) { err.textContent = "Couldn't save. Check your internet and try again."; err.hidden = false; return; }
        S.settings = r.data; err.hidden = true; toast("Settings saved"); render();
      });
    };
  }

  // ---------- Start ----------

  db.auth.getSession().then(function (r) {
    var sess = r.data && r.data.session;
    if (sess) start(sess.user); else renderLogin();
  });
})();
