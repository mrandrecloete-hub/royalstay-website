(function () {
  // sticky bar gets a background once the page moves
  var nav = document.getElementById('nav');
  var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 12); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  // phone menu
  var burger = document.getElementById('burger'), links = document.getElementById('links');
  var setMenu = function (open) { burger.setAttribute('aria-expanded', String(open)); links.classList.toggle('open', open); };
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  links.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // screens gallery
  var tabs = [].slice.call(document.querySelectorAll('.tab'));
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      [].forEach.call(document.querySelectorAll('.pane'), function (p) { p.classList.toggle('on', p.id === t.dataset.p); });
    });
    t.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
      if (n === null) return; e.preventDefault(); var x = tabs[(n + tabs.length) % tabs.length]; x.focus(); x.click();
    });
  });

  // the little notices on the hero change like activity in a busy property
  var feeds = [['One', ['Room S301 checked in', 'Order sent to the kitchen', 'Booking confirmed: S. Nghipandulwa', 'Room S202 marked clean']], ['Two', ['Invoice ready to send', 'Max prepared 3 steps', 'Payment received, EFT', 'Low stock: Windhoek Lager']]];
  feeds.forEach(function (f, n) {
    var el = document.querySelector('.chip.' + f[0].toLowerCase()); if (!el) return;
    var txt = el.lastChild, i = 0;
    setInterval(function () { el.classList.add('swap'); setTimeout(function () { i = (i + 1) % f[1].length; txt.textContent = ' ' + f[1][i]; el.classList.remove('swap'); }, 500); }, 3600 + n * 900);
  });
  // screenshots tilt a little towards the pointer on computers
  if (window.matchMedia('(hover: hover)').matches) [].forEach.call(document.querySelectorAll('.shot'), function (s) {
    var b = s.querySelector('.browser');
    s.addEventListener('mousemove', function (e) { var r = s.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; b.style.transition = 'transform .1s'; b.style.transform = 'perspective(1600px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 6) + 'deg)'; });
    s.addEventListener('mouseleave', function () { b.style.transition = ''; b.style.transform = ''; });
  });

  // installing the app: the browser's own install prompt where there is one, clear steps where there is not
  var deferred = null, status = document.getElementById('installStatus');
  var buttons = [].slice.call(document.querySelectorAll('[data-install]'));
  var ua = navigator.userAgent || '';
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var os = ios ? 'ios' : android ? 'android' : 'desktop';
  var installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var say = function (t) { if (status) status.textContent = t; };
  var mark = function () { [].forEach.call(document.querySelectorAll('.inst'), function (e) { e.classList.toggle('hit', e.dataset.os === os); }); };
  mark();
  // the installable app manifest and its service worker belong to the app's own address (where this page is served at /welcome/).
  // On the free GitHub Pages copy of the website they do not exist, so they are only added when the page is served by the app.
  if (location.pathname.indexOf('/welcome/') === 0) {
    var mf = document.createElement('link'); mf.rel = 'manifest'; mf.href = '/manifest.webmanifest'; document.head.appendChild(mf);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
  if (installed) {
    buttons.forEach(function (b) { b.classList.add('hide'); }); say('You are already using the installed app.');
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; say('Installed. Look for the RoyalStay icon on your device.'); });
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function (r) { say(r.outcome === 'accepted' ? 'Installing now. Look for the RoyalStay icon.' : 'No problem. You can install it any time from here.'); deferred = null; });
        return;
      }
      // no prompt from the browser: show the steps for this device
      say(ios ? 'On an iPhone or iPad: open this page in Safari, press Share, then Add to Home Screen.' : 'Your browser did not offer the install window. Follow the steps for your device below, or open this page in Chrome or Edge.');
      mark(); var t = document.getElementById('get'); if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // fade things in as they come into view
  var items = [].slice.call(document.querySelectorAll('.rv'));
  if (!('IntersectionObserver' in window)) { items.forEach(function (i) { i.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach(function (i) { io.observe(i); });
})();
