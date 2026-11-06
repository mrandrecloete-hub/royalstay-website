/* A working sample of the app for the website. Everything is made up and kept only in this page: nothing is saved or sent.
   It follows the real app's rules in small: a room cannot be booked twice, check in is for the arrival day, a room charge goes on the guest's bill,
   and Max only acts after Confirm. */
(function () {
  var root = document.getElementById('demoRoot');
  if (!root) return;

  var RATE = { Standard: 850, Family: 1400, Deluxe: 1100 };
  var ROOMS = [['S101', 'Standard'], ['S102', 'Standard'], ['S103', 'Standard'], ['S201', 'Family'], ['S202', 'Family'], ['S301', 'Deluxe'], ['S302', 'Deluxe']];
  var MENU = [['Oryx steak', 185], ['Kapana and pap', 65], ['Biltong salad', 95], ['Malva pudding', 55], ['Windhoek Lager', 32], ['House red, glass', 45]];
  var HISTORY = [5200, 6100, 4800, 7300, 6900, 8100]; // the six days before today, for the little chart
  var S, cart, tourRun = 0;

  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || root).querySelectorAll(s)); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return 'NAD ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var base = new Date(); base.setHours(12, 0, 0, 0);
  var dayOf = function (n) { var d = new Date(base); d.setDate(d.getDate() + n); return d; };
  var short = function (n) { return dayOf(n).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  var wd = function (n) { return dayOf(n).toLocaleDateString('en-GB', { weekday: 'short' }); };
  var nightsOf = function (r) { return r.d - r.a; };
  var totalOf = function (r) { return nightsOf(r) * RATE[r.type] + r.extras.reduce(function (s, e) { return s + e.amount; }, 0); };

  function seed() {
    S = { revenue: 3400, resNo: 1, inv: 11, ticket: 20, feed: [], res: [], tickets: [] };
    var add = function (name, room, a, d, status) { var t = ROOMS.filter(function (r) { return r[0] === room; })[0][1]; S.res.push({ id: S.resNo++, name: name, room: room, type: t, a: a, d: d, status: status, extras: [], inv: null }); };
    add('Anna Haufiku', 'S301', -2, 2, 'in'); add('Pieter van Wyk', 'S201', -1, 3, 'in');
    add('Selma Nghipandulwa', 'S101', 0, 2, 'confirmed'); add('Thomas Becker', 'S302', 0, 3, 'confirmed');
    add('Lucia Amakali', 'S202', 2, 4, 'confirmed'); add('Johan Kruger', 'S102', 3, 6, 'confirmed'); add('Emma Hoffmann', 'S301', 4, 7, 'confirmed');
    S.feed = [['Breakfast service closed, 62 covers', '08:40'], ['Room S201 cleaned and inspected', '09:15']];
    cart = {};
  }

  // ---------------------------------------------------------------------------------------------- markup
  root.innerHTML =
    '<div class="demo-top"><span class="live"><i></i>Live sample</span><span class="demo-note">Made up guests. Nothing is saved or sent.</span>' +
    '<span class="demo-btns"><button class="btn primary sm" type="button" id="tourBtn">&#9654; Watch the tour</button><button class="btn ghost sm" type="button" id="resetBtn">Reset</button></span></div>' +
    '<div class="demo-frame" id="frame"><div class="demo-app">' +
    '<nav class="dnav" role="tablist" aria-label="Sample screens">' +
    '<button role="tab" data-t="dash" aria-selected="true"><svg><use href="#i-chart"/></svg><span>Dashboard</span></button>' +
    '<button role="tab" data-t="res" aria-selected="false"><svg><use href="#i-bed"/></svg><span>Reservations</span></button>' +
    '<button role="tab" data-t="cal" aria-selected="false"><svg><use href="#i-list"/></svg><span>Calendar</span></button>' +
    '<button role="tab" data-t="pos" aria-selected="false"><svg><use href="#i-fork"/></svg><span>Restaurant</span></button>' +
    '<button role="tab" data-t="max" aria-selected="false"><svg><use href="#i-spark"/></svg><span>Ask Max</span></button></nav>' +
    '<div class="dmain">' +
    '<section class="dpane on" id="d-dash"><h3>Finance and management</h3><p class="dsub">Namib Sunset Lodge (sample). Amounts include tax, in NAD.</p>' +
    '<div class="tiles" id="tiles"></div><div class="dgrid"><div class="dcard"><h4>Revenue, last 7 days</h4><div class="bars" id="bars"></div></div>' +
    '<div class="dcard"><h4>Activity</h4><ul class="feed" id="feed"></ul></div></div></section>' +
    '<section class="dpane" id="d-res"><h3>Reservations</h3><p class="dsub">Book a guest, then check them in on the day they arrive.</p>' +
    '<form class="dform" id="resForm"><label>Guest name<input id="fName" value="Roberto Van Rensburg" maxlength="40" autocomplete="off"></label>' +
    '<label>Room type<select id="fType"><option>Standard</option><option>Family</option><option>Deluxe</option></select></label>' +
    '<label>Arrives<select id="fArr"><option value="0">Today</option><option value="1">Tomorrow</option><option value="2">In 2 days</option></select></label>' +
    '<label>Nights<select id="fNights"><option>1</option><option>2</option><option>3</option></select></label>' +
    '<button class="btn primary sm" id="bookBtn">Book</button></form><p class="dmsg" id="resMsg" role="status" aria-live="polite"></p>' +
    '<div class="tbl" id="resTbl"></div></section>' +
    '<section class="dpane" id="d-cal"><h3>Calendar</h3><p class="dsub">Every room, every night. Click an empty night to book that room.</p><div class="calwrap"><div class="cal" id="cal"></div></div></section>' +
    '<section class="dpane" id="d-pos"><h3>Restaurant point of sale</h3><p class="dsub">Tap items, choose how it is paid, then place the order.</p>' +
    '<div class="posgrid"><div class="menu" id="menu"></div><div class="dcard order"><h4>Current order</h4><label class="tbl-sel">Table<select id="pTable"><option>T1</option><option>T2</option><option selected>T3</option><option>T4</option></select></label>' +
    '<div id="orderLines" class="olines"></div><div class="paychips" id="payChips"></div><label class="tbl-sel hide" id="roomPick">Charge to<select id="pRoom"></select></label>' +
    '<button class="btn primary sm block" id="placeBtn">Place order and pay</button><div class="tickets" id="tickets" aria-live="polite"></div></div></div></section>' +
    '<section class="dpane" id="d-max"><div class="chat dchat"><div class="chat-top"><img src="img/logo.png" alt=""><div><b>Max</b><span>AI assistant (sample)</span></div></div>' +
    '<div class="chatlog" id="chatlog" aria-live="polite"></div><div class="chips" id="chips"></div>' +
    '<form class="chatform" id="chatForm"><input id="chatIn" placeholder="Ask Max, for example: who arrives today?" autocomplete="off" maxlength="160"><button class="btn primary sm">Send</button></form></div></section>' +
    '</div></div><div class="toasts" id="toasts" aria-live="polite"></div><div class="cursor hide" id="cursor" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-3 6z" fill="#fff" stroke="#040a1a" stroke-width="1.5" stroke-linejoin="round"/></svg><i></i></div>' +
    '<div class="modal hide" id="modal" role="dialog" aria-modal="true" aria-label="Sample invoice"><div class="paper" id="paper"></div></div></div>';

  // ---------------------------------------------------------------------------------------------- helpers
  function toast(t) {
    var e = document.createElement('div'); e.className = 'toast'; e.textContent = t; $('#toasts').appendChild(e);
    setTimeout(function () { e.classList.add('out'); setTimeout(function () { e.remove(); }, 400); }, 2800);
  }
  function log(t) { var n = new Date(); S.feed.unshift([t, ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2)]); S.feed = S.feed.slice(0, 6); }
  function tab(name) {
    $$('.dnav button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.t === name)); });
    $$('.dpane').forEach(function (p) { p.classList.toggle('on', p.id === 'd-' + name); });
  }
  function free(room, a, d) { return !S.res.some(function (r) { return r.room === room && r.status !== 'cancelled' && r.a < d && a < r.d; }); }
  function pickRoom(type, a, d) { var m = ROOMS.filter(function (r) { return r[1] === type && free(r[0], a, d); })[0]; return m ? m[0] : null; }
  function book(name, type, a, n) {
    var d = a + n, room = pickRoom(type, a, d);
    if (!room) return { error: 'No ' + type + ' room is free from ' + short(a) + ' to ' + short(d) + '.' };
    var r = { id: S.resNo++, name: name, room: room, type: type, a: a, d: d, status: 'confirmed', extras: [], inv: null };
    S.res.push(r); log('Booked ' + name + ', ' + type + ', ' + short(a) + ' to ' + short(d)); return { res: r };
  }
  function checkIn(r) {
    if (r.status !== 'confirmed' || r.a !== 0) return false;
    r.status = 'in'; S.revenue += RATE[r.type]; log('Checked in ' + r.name + ' to room ' + r.room); return true;
  }
  function checkOut(r) { r.status = 'out'; log('Checked out ' + r.name); }
  function find(name) { var q = name.toLowerCase(); return S.res.filter(function (r) { return r.status !== 'cancelled' && r.name.toLowerCase().indexOf(q) > -1; }).sort(function (a, b) { return (b.status === 'in') - (a.status === 'in'); })[0]; }
  function invoiceNo(r) { if (!r.inv) { r.inv = 'INV-' + ('0000' + (++S.inv)).slice(-5); log('Invoice ' + r.inv + ' issued to ' + r.name); } return r.inv; }

  // ---------------------------------------------------------------------------------------------- drawing
  function count(el, to, fmt) {
    var from = Number(el.dataset.v || 0); el.dataset.v = to; if (from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 650;
    (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  function drawDash() {
    var inn = S.res.filter(function (r) { return r.status === 'in'; }).length;
    var arr = S.res.filter(function (r) { return r.status === 'confirmed' && r.a === 0; }).length;
    var occ = Math.round(inn / ROOMS.length * 1000) / 10;
    var T = $('#tiles');
    if (!T.children.length) T.innerHTML = '<div class="tile"><small>Revenue today</small><b data-k="rev">0</b><span>Rooms and restaurant</span></div><div class="tile"><small>Occupancy today</small><b data-k="occ">0</b><span id="occSub"></span></div><div class="tile"><small>In house</small><b data-k="inn">0</b><span>guests staying now</span></div><div class="tile"><small>Arriving today</small><b data-k="arr">0</b><span>waiting to check in</span></div>';
    count($('[data-k=rev]'), S.revenue, money); count($('[data-k=occ]'), occ, function (v) { return v.toFixed(1) + '%'; });
    count($('[data-k=inn]'), inn, function (v) { return String(Math.round(v)); }); count($('[data-k=arr]'), arr, function (v) { return String(Math.round(v)); });
    $('#occSub').textContent = inn + ' of ' + ROOMS.length + ' rooms';
    var all = HISTORY.concat([S.revenue]), max = Math.max.apply(null, all);
    $('#bars').innerHTML = all.map(function (v, i) { return '<div class="bar' + (i === all.length - 1 ? ' now' : '') + '" title="' + money(v) + '"><i style="height:' + Math.round(v / max * 100) + '%"></i><span>' + (i === all.length - 1 ? 'Today' : wd(i - 6)) + '</span></div>'; }).join('');
    $('#feed').innerHTML = S.feed.map(function (f, i) { return '<li class="' + (i === 0 ? 'new' : '') + '"><span>' + esc(f[0]) + '</span><time>' + f[1] + '</time></li>'; }).join('');
  }
  function drawRes() {
    var rows = S.res.slice().sort(function (a, b) { return a.a - b.a || a.id - b.id; }).map(function (r) {
      var st = r.status === 'in' ? '<span class="pill g">Checked in</span>' : r.status === 'out' ? '<span class="pill n">Checked out</span>' : r.a === 0 ? '<span class="pill y">Arrives today</span>' : '<span class="pill b">Confirmed</span>';
      var act = '';
      if (r.status === 'confirmed') act = r.a === 0 ? '<button class="btn primary xs" data-act="in" data-id="' + r.id + '">Check in</button>' : '<button class="btn ghost xs" disabled>Arrives ' + wd(r.a) + '</button>';
      else if (r.status === 'in') act = '<button class="btn ghost xs" data-act="inv" data-id="' + r.id + '">Invoice</button><button class="btn ghost xs" data-act="out" data-id="' + r.id + '">Check out</button>';
      else act = '<button class="btn ghost xs" data-act="inv" data-id="' + r.id + '">Invoice</button>';
      return '<div class="trow' + (r.fresh ? ' fresh' : '') + '"><b>' + esc(r.name) + '</b><span>' + r.room + ' &middot; ' + r.type + '</span><span>' + short(r.a) + ' to ' + short(r.d) + '</span>' + st + '<em>' + money(totalOf(r)) + '</em><div class="acts">' + act + '</div></div>';
    });
    $('#resTbl').innerHTML = '<div class="thead"><span>Guest</span><span>Room</span><span>Stay</span><span>Status</span><span>Total</span><span></span></div>' + rows.join('');
    S.res.forEach(function (r) { r.fresh = false; });
  }
  var DAYS = 10;
  function drawCal() {
    var h = '<div class="c-h" style="grid-row:1;grid-column:1"></div>';
    for (var i = -1; i < DAYS - 1; i++) h += '<div class="c-h' + (i === 0 ? ' today' : '') + '" style="grid-row:1;grid-column:' + (i + 3) + '">' + wd(i) + '<br><b>' + dayOf(i).getDate() + '</b></div>';
    ROOMS.forEach(function (rm, ri) {
      h += '<div class="c-room" style="grid-row:' + (ri + 2) + ';grid-column:1"><b>' + rm[0] + '</b><small>' + rm[1] + '</small></div>';
      for (var c = 0; c < DAYS; c++) h += '<button class="c-cell" aria-label="Book ' + rm[0] + ' on ' + short(c - 1) + '" data-room="' + rm[0] + '" data-day="' + (c - 1) + '" style="grid-row:' + (ri + 2) + ';grid-column:' + (c + 2) + '"></button>';
    });
    S.res.forEach(function (r) {
      if (r.status === 'cancelled') return;
      var ri = ROOMS.map(function (x) { return x[0]; }).indexOf(r.room), s = Math.max(r.a, -1), e = Math.min(r.d, DAYS - 1);
      if (e <= s) return;
      h += '<div class="c-bar ' + r.status + '" style="grid-row:' + (ri + 2) + ';grid-column:' + (s + 3) + '/' + (e + 3) + '" title="' + esc(r.name) + '">' + esc(r.name) + '</div>';
    });
    $('#cal').innerHTML = h;
  }
  function drawPos() {
    $('#menu').innerHTML = MENU.map(function (m, i) { var q = cart[i] || 0; return '<div class="mi' + (q ? ' on' : '') + '"><span>' + (i < 4 ? (i < 3 ? 'Mains and starters' : 'Desserts') : 'Bar') + '</span><b>' + m[0] + '</b><em>' + money(m[1]) + '</em><div class="qty"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Remove one ' + m[0] + '">&minus;</button><u>' + q + '</u><button type="button" data-q="1" data-i="' + i + '" aria-label="Add one ' + m[0] + '">+</button></div></div>'; }).join('');
    var lines = Object.keys(cart).filter(function (k) { return cart[k] > 0; }), tot = 0;
    $('#orderLines').innerHTML = lines.length ? lines.map(function (k) { var v = cart[k] * MENU[k][1]; tot += v; return '<div><span>' + cart[k] + ' &times; ' + MENU[k][0] + '</span><em>' + money(v) + '</em></div>'; }).join('') + '<div class="otot"><span>Total payable</span><em>' + money(tot) + '</em></div>' : '<p class="empty">Choose items to start.</p>';
    var inn = S.res.filter(function (r) { return r.status === 'in'; });
    var pay = $('#payChips').dataset.p || 'Cash';
    $('#payChips').innerHTML = ['Cash', 'Card', 'EFT', 'Room'].map(function (p) { return '<button type="button" data-pay="' + p + '" aria-pressed="' + (pay === p) + '"' + (p === 'Room' && !inn.length ? ' disabled' : '') + '>' + p + '</button>'; }).join('');
    $('#payChips').dataset.p = pay;
    var rp = $('#roomPick'), sel = $('#pRoom'), keep = sel.value;
    rp.classList.toggle('hide', pay !== 'Room');
    sel.innerHTML = inn.map(function (r) { return '<option value="' + r.id + '">' + r.room + ' ' + esc(r.name) + '</option>'; }).join('');
    if (keep) sel.value = keep;
    $('#tickets').innerHTML = S.tickets.slice(0, 3).map(function (t) { return '<div class="tk ' + t.state + '"><b>Kitchen ticket #' + t.no + ' &middot; ' + t.table + '</b><span>' + esc(t.text) + '</span><i>' + (t.state === 'new' ? 'Received' : t.state === 'prep' ? 'Preparing' : 'Ready') + '</i></div>'; }).join('');
  }
  function drawAll() { drawDash(); drawRes(); drawCal(); drawPos(); }

  // ---------------------------------------------------------------------------------------------- invoice
  function openInvoice(r) {
    var no = invoiceNo(r), n = nightsOf(r), rate = RATE[r.type];
    var lines = []; for (var i = 0; i < n; i++) lines.push([short(r.a + i), 'Accommodation, ' + r.type + ' room ' + r.room, 1, rate, rate]);
    r.extras.forEach(function (e) { lines.push([short(0), e.desc, 1, e.amount, e.amount]); });
    var gross = totalOf(r), tax = Math.round(gross * 15 / 115 * 100) / 100;
    $('#paper').innerHTML = '<div class="p-h"><b>NAMIB SUNSET LODGE</b><small>Sample business, Windhoek</small></div><hr>' +
      '<div class="p-top"><div><h2>INVOICE</h2><small>BILL TO</small><b>' + esc(r.name) + '</b><span>Room ' + r.room + '</span></div>' +
      '<dl><dt>Invoice No</dt><dd>' + no + '</dd><dt>Date</dt><dd>' + short(0) + '</dd><dt>Stay</dt><dd>' + short(r.a) + ' to ' + short(r.d) + '</dd></dl></div>' +
      '<table><thead><tr><th>Date</th><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>' +
      lines.map(function (l) { return '<tr><td>' + l[0] + '</td><td>' + esc(l[1]) + '</td><td>' + l[2] + '</td><td>' + money(l[3]) + '</td><td>' + money(l[4]) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="p-tot"><div><span>Subtotal</span><em>' + money(gross - tax) + '</em></div><div><span>Tax included (15%)</span><em>' + money(tax) + '</em></div><div class="big"><span>Total amount</span><em>' + money(gross) + '</em></div><div class="big"><span>Balance due</span><em>' + money(gross) + '</em></div></div>' +
      '<p class="p-note">Sample invoice made on this page. In the app it is numbered, kept unchanged, and can be printed, saved as PDF or sent to the guest.</p><button class="btn primary sm" type="button" id="closeInv">Close</button>';
    $('#modal').classList.remove('hide'); $('#closeInv').focus(); drawAll();
  }

  // ---------------------------------------------------------------------------------------------- Max
  var chat = $('#chatlog'), pending = null;
  function say(who, html) { var m = document.createElement('div'); m.className = 'msg ' + (who === 'me' ? 'me' : 'ai'); m.innerHTML = html; chat.appendChild(m); chat.scrollTop = chat.scrollHeight; return m; }
  function typing() { var m = say('ai', '<span class="dots"><i></i><i></i><i></i></span>'); return m; }
  var STOP = /^(Book|Invoice|Add|Check|Make|Who|What|Is|Show|Please|Max|Can|Could|Walk|Issue|Create)$/;
  function nameIn(t) {
    var re = /\b([A-Z][a-z]+(?:\s+(?:van|de|der|du|von|Van|De)\s+)?(?:\s*[A-Z][a-z]+){0,2})/g, m;
    while ((m = re.exec(t))) { var w = m[1].trim().split(/\s+/); if (w.length >= 2 && !STOP.test(w[0])) return w.join(' '); }
    return null;
  }
  function ask(q) {
    say('me', esc(q)); var t = typing(), low = q.toLowerCase();
    return sleep(750 + Math.random() * 350).then(function () {
      t.remove();
      var name = nameIn(q), known = name && find(name);
      if (/who.*(arriv|coming)|arrivals?/.test(low)) {
        var a = S.res.filter(function (r) { return r.status === 'confirmed' && r.a === 0; });
        return reply(a.length ? 'Arriving today: ' + a.map(function (r) { return esc(r.name) + ' (' + r.room + ')'; }).join(', ') + '.' : 'Nobody else is arriving today.');
      }
      if (/revenue|sales|takings/.test(low)) return reply('Revenue posted today is ' + money(S.revenue) + ', from rooms and the restaurant.');
      if (/occupan/.test(low)) { var n = S.res.filter(function (r) { return r.status === 'in'; }).length; return reply('Occupancy today is ' + (n / ROOMS.length * 100).toFixed(1) + '%: ' + n + ' of ' + ROOMS.length + ' rooms.'); }
      if (/invoice/.test(low) && name) {
        if (known && known.status === 'in' || known && known.status === 'out') return plan('Here is the step for you to check:', [{ k: 'inv', r: known, t: 'Issue an invoice to ' + esc(known.name) + ', room ' + known.room + ': ' + money(totalOf(known)) + '.' }]);
        if (known && known.status === 'confirmed' && known.a === 0) return plan('I have prepared two steps for you to check:', [{ k: 'in', r: known, t: 'Check in ' + esc(known.name) + ' to room ' + known.room + '. Room charges go on the bill.' }, { k: 'inv', r: known, t: 'Issue an invoice to ' + esc(known.name) + '.' }]);
        if (known) return reply(esc(known.name) + ' arrives on ' + short(known.a) + ' and is not checked in, so there is no bill yet.');
      }
      if (name && /(walk|book|add|reserve|check)/.test(low)) {
        if (known && known.status !== 'out') return reply(esc(known.name) + ' is already on the list (room ' + known.room + '). Ask me for an invoice or a check in instead.');
        var type = /family/.test(low) ? 'Family' : /deluxe/.test(low) ? 'Deluxe' : 'Standard', nn = Number((/(\d)\s*nights?/.exec(low) || [0, 1])[1]);
        var room = pickRoom(type, 0, nn);
        if (!room) return reply('No ' + type + ' room is free tonight. In the app I can add them to the waiting list.');
        var steps = [{ k: 'book', name: name, type: type, n: nn, t: 'Book ' + esc(name) + ' (new guest) into a ' + type + ' room, tonight, ' + nn + ' night' + (nn > 1 ? 's' : '') + '.' }];
        if (/check|walk/.test(low)) steps.push({ k: 'in', by: name, t: 'Check ' + esc(name.split(' ')[0]) + ' in to a ready room. Room charges go on the bill.' });
        if (/invoice/.test(low)) steps.push({ k: 'inv', by: name, t: 'Issue an invoice to ' + esc(name) + '.' });
        return plan('I have prepared ' + (steps.length === 1 ? 'one step' : steps.length + ' steps') + ' for you to check:', steps);
      }
      return reply('In the real app I answer this from your own bookings, guests, stock and documents. In this sample, try one of the suggestions below, or ask who arrives today, about revenue or occupancy.');
    });
  }
  function reply(html) { return say('ai', html); }
  function plan(intro, steps) {
    var m = say('ai', intro + '<div class="plan">' + steps.map(function (s, i) { return '<div data-s="' + i + '"><em>' + (i + 1) + '</em><span>' + s.t + '</span></div>'; }).join('') + '</div><div class="plan-actions"><button class="btn primary xs" type="button" data-go>Confirm</button><button class="btn ghost xs" type="button" data-no>Cancel</button></div><p class="chat-note" style="margin:10px 0 0;text-align:left">Nothing happens until you press Confirm.</p>');
    pending = { steps: steps, el: m };
  }
  function run(p) {
    var by, out = $('.plan-actions', p.el); out.innerHTML = '<span class="working">Working on it...</span>'; var chain = Promise.resolve(), last, fail = null;
    p.steps.forEach(function (s, i) {
      chain = chain.then(function () { return sleep(650); }).then(function () {
        if (fail) return;
        var row = $('[data-s="' + i + '"]', p.el), r;
        if (s.k === 'book') { var b = book(s.name, s.type, 0, s.n); if (b.error) { fail = b.error; row.classList.add('bad'); return; } r = last = b.res; }
        else { r = s.r || last || find(s.by); if (s.k === 'in' && !checkIn(r)) { fail = 'That guest cannot be checked in today.'; row.classList.add('bad'); return; } if (s.k === 'inv') { invoiceNo(r); last = r; } }
        last = r; row.classList.add('done'); drawAll();
      });
    });
    return chain.then(function () {
      if (fail) { out.innerHTML = ''; reply('I stopped: ' + esc(fail)); return; }
      out.innerHTML = '';
      var inv = last && last.inv, msg = reply('Done. ' + (inv ? 'Invoice ' + inv + ' is ready.' : 'The changes are made.') + (inv ? ' <button class="btn ghost xs" type="button" data-view="' + last.id + '">View invoice</button>' : ''));
      toast('Done by Max'); return msg;
    });
  }
  function chips() {
    var c = ['Roberto Van Rensburg just walked in. Book him a Standard room tonight, check him in and make his invoice.', 'Who arrives today?', 'What is our revenue today?', 'Invoice for Anna Haufiku'];
    $('#chips').innerHTML = c.map(function (t) { return '<button type="button" class="chip-btn">' + esc(t) + '</button>'; }).join('');
  }

  // ---------------------------------------------------------------------------------------------- events
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) return tab(b.dataset.t);
    if (b.dataset.act) {
      var r = S.res.filter(function (x) { return x.id === Number(b.dataset.id); })[0];
      if (b.dataset.act === 'in' && checkIn(r)) { toast('Checked in. First night posted to the bill.'); }
      if (b.dataset.act === 'out') { checkOut(r); toast('Checked out'); }
      if (b.dataset.act === 'inv') return openInvoice(r);
      return drawAll();
    }
    if (b.dataset.q) { var i = Number(b.dataset.i), v = (cart[i] || 0) + Number(b.dataset.q); cart[i] = Math.max(0, Math.min(9, v)); return drawPos(); }
    if (b.dataset.pay) { $('#payChips').dataset.p = b.dataset.pay; return drawPos(); }
    if (b.id === 'placeBtn') return place();
    if (b.classList.contains('c-cell')) return cellBook(b);
    if (b.classList.contains('chip-btn')) return ask(b.textContent);
    if (b.dataset.view) { var rr = S.res.filter(function (x) { return x.id === Number(b.dataset.view); })[0]; return openInvoice(rr); }
    if (b.hasAttribute('data-go') && pending) { var p = pending; pending = null; return run(p); }
    if (b.hasAttribute('data-no') && pending) { $('.plan-actions', pending.el).innerHTML = ''; pending = null; return reply('Cancelled. Nothing was changed.'); }
    if (b.id === 'closeInv') return $('#modal').classList.add('hide');
    if (b.id === 'tourBtn') return tour();
    if (b.id === 'resetBtn') { stopTour(); seed(); chat.innerHTML = ''; opening(); drawAll(); tab('dash'); toast('The sample is back to the start.'); }
  });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') $('#modal').classList.add('hide'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('#modal').classList.add('hide'); });
  $('#resForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#fName').value.trim().replace(/\s+/g, ' '), msg = $('#resMsg');
    if (name.length < 3 || name.indexOf(' ') < 0) { msg.textContent = 'Please give the first and last name.'; msg.className = 'dmsg bad'; return; }
    var r = book(name, $('#fType').value, Number($('#fArr').value), Number($('#fNights').value));
    if (r.error) { msg.textContent = r.error; msg.className = 'dmsg bad'; return; }
    r.res.fresh = true; msg.textContent = 'Booked ' + name + ' into room ' + r.res.room + '.'; msg.className = 'dmsg ok'; toast('Reservation created'); drawAll();
  });
  function cellBook(c) {
    var room = c.dataset.room, day = Number(c.dataset.day), type = ROOMS.filter(function (r) { return r[0] === room; })[0][1];
    if (day < 0) return toast('That night has passed.');
    if (!free(room, day, day + 1)) return toast('That night is already taken.');
    var name = (window.prompt ? window.prompt('Guest name for room ' + room + ' on ' + short(day) + ' (first and last name):', 'Maria Shikongo') : null);
    if (!name || name.trim().indexOf(' ') < 0) return;
    var r = { id: S.resNo++, name: name.trim().slice(0, 40), room: room, type: type, a: day, d: day + 1, status: 'confirmed', extras: [], inv: null };
    S.res.push(r); log('Booked ' + r.name + ', ' + type + ', ' + short(day)); toast('Booked ' + r.name + ' in ' + room); drawAll();
  }
  function place() {
    var lines = Object.keys(cart).filter(function (k) { return cart[k] > 0; });
    if (!lines.length) return toast('Choose items first.');
    var tot = 0, text = lines.map(function (k) { tot += cart[k] * MENU[k][1]; return cart[k] + ' x ' + MENU[k][0]; }).join(', '), pay = $('#payChips').dataset.p;
    if (pay === 'Room') {
      var r = S.res.filter(function (x) { return x.id === Number($('#pRoom').value); })[0];
      if (!r) return toast('No guest is in house to charge.');
      r.extras.push({ desc: 'Restaurant: ' + text, amount: tot });
    }
    S.revenue += tot; var t = { no: ++S.ticket, table: $('#pTable').value, text: text, state: 'new' }; S.tickets.unshift(t);
    log('Order sent to the kitchen, ' + t.table + ', ' + money(tot) + ' (' + pay.toLowerCase() + ')'); toast('Kitchen ticket #' + t.no + ' sent'); cart = {};
    setTimeout(function () { t.state = 'prep'; drawPos(); }, 1600); setTimeout(function () { t.state = 'ready'; drawPos(); drawDash(); }, 4200);
    drawAll();
  }
  $('#chatForm').addEventListener('submit', function (e) { e.preventDefault(); var v = $('#chatIn').value.trim(); if (!v) return; $('#chatIn').value = ''; ask(v); });

  // ---------------------------------------------------------------------------------------------- guided tour
  function stopTour() { tourRun++; $('#cursor').classList.add('hide'); $('#tourBtn').innerHTML = '&#9654; Watch the tour'; }
  async function tour() {
    if ($('#tourBtn').dataset.on === '1') return;
    var id = ++tourRun, ok = function () { return id === tourRun; }, cur = $('#cursor'), frame = $('#frame');
    $('#tourBtn').dataset.on = '1'; $('#tourBtn').innerHTML = 'Touring... click anywhere to stop';
    seed(); chat.innerHTML = ''; opening(); drawAll(); tab('dash'); $('#modal').classList.add('hide'); cur.classList.remove('hide');
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var stop = function () { if (ok()) stopTour(); };
    frame.addEventListener('pointerdown', stop, { once: true });
    var go = async function (el, wait) { if (!ok() || !el) return false; var f = frame.getBoundingClientRect(), r = el.getBoundingClientRect(); cur.style.transform = 'translate(' + (r.left - f.left + r.width / 2) + 'px,' + (r.top - f.top + r.height / 2) + 'px)'; await sleep(wait || 750); return ok(); };
    var click = async function (el, wait) { if (!(await go(el))) return false; cur.classList.add('tap'); await sleep(160); cur.classList.remove('tap'); el.click(); await sleep(wait || 500); return ok(); };
    var type = async function (inp, text) { if (!(await go(inp))) return false; inp.focus(); inp.value = ''; for (var i = 0; i < text.length; i++) { if (!ok()) return false; inp.value += text[i]; await sleep(45); } return true; };
    try {
      cur.style.transform = 'translate(40px,60px)'; await sleep(1100); if (!ok()) return;
      if (!(await click($('[data-t=res]')))) return;
      if (!(await type($('#fName'), 'Roberto Van Rensburg'))) return;
      if (!(await click($('#bookBtn'), 1300))) return;
      var row = $$('.trow').filter(function (r) { return r.textContent.indexOf('Roberto') > -1; })[0];
      if (!(await click(row && $('[data-act=in]', row), 1400))) return;
      if (!(await click($('[data-t=pos]')))) return;
      if (!(await click($('[data-q="1"][data-i="0"]', root), 350))) return; if (!(await click($('[data-q="1"][data-i="0"]', root), 350))) return; if (!(await click($('[data-q="1"][data-i="4"]', root), 500))) return;
      if (!(await click($('[data-pay=Room]'), 600))) return;
      if (!(await click($('#placeBtn'), 1800))) return;
      if (!(await click($('[data-t=max]')))) return;
      var chip = $$('.chip-btn').filter(function (c) { return /Invoice for/.test(c.textContent); })[0];
      $('#chatIn').value = ''; if (!(await type($('#chatIn'), 'Invoice for Roberto Van Rensburg'))) return;
      if (!(await click($('#chatForm .btn'), 1900))) return;
      if (!(await click($('[data-go]'), 2600))) return;
      if (!(await click($('[data-view]'), 3200))) return;
      if (!(await click($('#closeInv'), 500))) return;
      if (!(await click($('[data-t=dash]'), 600))) return;
      await go($('[data-k=rev]'), 1800);
      if (ok()) toast('That was a sample. Now try it yourself.');
    } finally { if (ok()) { stopTour(); } $('#tourBtn').dataset.on = '0'; $('#tourBtn').innerHTML = '&#9654; Watch the tour'; frame.removeEventListener('pointerdown', stop); }
  }

  function opening() { reply('Hello, I am Max. Ask me something, or pick one of the suggestions below. I prepare changes for you and nothing happens until you press <b>Confirm</b>.'); chips(); }

  seed(); opening(); drawAll();

  // start the dashboard numbers when the demo scrolls into view
  if ('IntersectionObserver' in window) { var seen = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { root.classList.add('seen'); seen.disconnect(); } }); }, { threshold: 0.2 }); seen.observe(root); }
})();
