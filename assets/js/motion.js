/* THORVERK: motion layer (GSAP 3.13 + ScrollTrigger + Lenis 1.3, vendored, no network).
   Added 21 Oct 2026 on Sindri's explicit request ("scroll behaviour, scroll animations, motion,
   lenis, flow"). It sits on top of Codex's site.js and never replaces its behaviour.
   Rules carried from earlier builds (memory: scrolltrigger-once-and-smooth-scroll-gotchas,
   scrolltrigger-never-move-the-trigger, gsap-css-start-transform-stays-as-xy, masked-word-reveal-clips-accents):
   - Lenis on fine pointers only; phones keep native momentum scrolling.
   - html scroll-behavior is auto while motion runs; anchors scroll in JS to a computed pixel target.
   - A trigger never moves. Photos drift inside frames that stay put.
   - Masks keep headroom so Á Í Ó Ð Þ are never clipped.
   - Never `once`. Batches use a dataset guard, and a safety net shows anything left hidden.
   - Everything is visible without JS; reduced motion gets no movement at all. */
(function () {
  'use strict';
  var root = document.documentElement;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  function done() { root.classList.remove('motion-pre'); }
  if (!window.gsap || !window.ScrollTrigger || /[?&]static=1/.test(location.search)) { done(); return; }
  gsap.registerPlugin(ScrollTrigger);
  /* reduced motion: no smooth scroll, no movement; headings and groups only fade in as they
     arrive (comprehension), and anything still hidden at the bottom is shown */
  if (RM) {
    done();
    var rmEls = [].slice.call(document.querySelectorAll('main section h2, .product-feature, .grade-card, .document-row, .news-list > a'));
    gsap.set(rmEls, { opacity: 0 });
    ScrollTrigger.batch(rmEls, { start: 'top 92%', onEnter: function (b) { gsap.to(b, { opacity: 1, duration: 0.4, ease: 'none', overwrite: true }); } });
    function rmAll() { gsap.set(rmEls.filter(function (n) { return n.getBoundingClientRect().top < innerHeight; }), { opacity: 1 }); }
    ['change', 'click', 'scrollend'].forEach(function (t) { addEventListener(t, function () { setTimeout(rmAll, 0); }, true); });
    addEventListener('load', function () { ScrollTrigger.refresh(); rmAll(); });
    return;
  }

  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.ticker.lagSmoothing(0);
  root.classList.add('motion-on');
  var SCRUB = touch ? 0.35 : true;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var M = window.ThorverkMotion = { lenis: null };

  /* ---------- smooth scroll (desktop) ---------- */
  if (!touch && window.Lenis) {
    M.lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, autoRaf: false });
    M.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { M.lenis.raf(t * 1000); });
    root.classList.add('motion-smooth');
  }
  function headH() { var h = $('.site-head'); return h ? h.getBoundingClientRect().height : 74; }
  /* anchors land below the header as it will be on arrival: anywhere past the top it is the
     compact 74px bar (site.css .site-head.is-scrolled), not the tall one measured at click time */
  var COMPACT = 74;
  function offset() { var sub = $('.subnav'); return Math.min(headH(), COMPACT) + (sub ? sub.offsetHeight : 0) + 24; }
  /* Codex's chapter spy reads intersection entries; a fast glide can enter two chapters in one
     frame, so the link for the chapter we land on is marked once the glide ends */
  function mark(el) {
    var links = $$('.subnav a'); if (!links.length || !el.id) return;
    function set() { links.forEach(function (a) { a.getAttribute('href') === '#' + el.id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'); }); }
    /* again after the observer's last delivery for the glide, which can land a frame later */
    set(); setTimeout(set, 180);
  }
  M.scrollTo = function (el) {
    var y = Math.max(0, el.getBoundingClientRect().top + scrollY - offset());
    if (M.lenis) M.lenis.scrollTo(y, { duration: 1.15, easing: function (x) { return 1 - Math.pow(1 - x, 4); }, onComplete: function () { mark(el); } });
    else { scrollTo({ top: y, behavior: 'smooth' }); setTimeout(function () { mark(el); }, 900); }
  };
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey) return;
    var a = e.target.closest('a[href*="#"]');
    if (!a || a.classList.contains('skip') || a.closest('dialog')) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    var el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault(); M.scrollTo(el); history.pushState(null, '', url.hash);
  });
  /* dialogs lock the page: pause Lenis so the wheel scrolls the dialog, not the page behind it */
  if (M.lenis) new MutationObserver(function () { document.body.classList.contains('dialog-open') ? M.lenis.stop() : M.lenis.start(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ---------- line masks: each <br> line of a heading rises out of its own window ---------- */
  function lines(h) {
    if (!h || h.dataset.masked) return [];
    h.dataset.masked = '1';
    var groups = [[]];
    [].slice.call(h.childNodes).forEach(function (n) { if (n.nodeName === 'BR') groups.push([]); else groups[groups.length - 1].push(n); });
    h.textContent = '';
    return groups.filter(function (g) { return g.length; }).map(function (g) {
      var m = document.createElement('span'), inner = document.createElement('span');
      m.className = 'mline'; inner.className = 'mline__in';
      g.forEach(function (n, i) { if (!i && n.nodeType === 3) n.textContent = n.textContent.replace(/^\s+/, ''); inner.appendChild(n); });
      /* keep a word space between line masks so screen readers and copied text don't join the words */
      if (h.childNodes.length) h.appendChild(document.createTextNode(' '));
      m.appendChild(inner); h.appendChild(m);
      return inner;
    });
  }
  /* the copy that belongs to a heading: what follows it in the same block */
  function after(h) {
    var out = [], n = h.nextElementSibling;
    while (n && out.length < 4) { if (!/^(IMG|FIGURE|TABLE)$/.test(n.tagName) && !n.matches('.table-wrap,.grade-grid,.document-list')) out.push(n); n = n.nextElementSibling; }
    return out;
  }

  /* ---------- 1. the first screen: arrives once, then hands over to scroll ---------- */
  var hero = $('.hero'), top = $('.page-top, .species-top, .contact-top');
  /* buyers move between eight pages: the full entrance plays on the first page of a visit,
     later pages get the same moves at about half the time so navigation never waits on it */
  var again = false; try { again = sessionStorage.getItem('thv.seen') === '1'; sessionStorage.setItem('thv.seen', '1'); } catch (e) {}
  var intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  if (again) intro.timeScale(1.9);
  if (hero) {
    var hl = lines($('h1', hero));
    intro.from('.hero-copy .label', { y: 14, opacity: 0, duration: 0.7 })
      .from(hl, { yPercent: 112, duration: 1.1, stagger: 0.09 }, 0.1)
      .from('.hero-intro, .hero-copy .text-link', { y: 26, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.45)
      .fromTo('.hero-texture', { scale: 1.14 }, { scale: 1, duration: 2.2, ease: 'power2.out', immediateRender: true }, 0)
      .fromTo('.hero-window', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out', clearProps: 'clipPath' }, 0.15)
      .from('.hero-window img', { scale: 1.2, duration: 1.8, ease: 'power3.out', clearProps: 'transform' }, 0.2);
  } else if (top) {
    var tl = lines($('h1', top));
    intro.from($$('.breadcrumb, .label', top), { y: 12, opacity: 0, duration: 0.6 })
      .from(tl, { yPercent: 112, duration: 1.05, stagger: 0.08 }, 0.05)
      .from(after($('h1', top)), { y: 24, opacity: 0, duration: 0.85, stagger: 0.08, ease: 'power3.out' }, 0.35);
  }
  done();

  /* hero: the texture sinks slower than the page, the window lifts a little faster */
  if (hero) {
    gsap.fromTo('.hero-texture', { yPercent: 0 }, { yPercent: 12, ease: 'none', immediateRender: false, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: SCRUB } });
    gsap.fromTo('.hero-window', { y: 0 }, { y: -60, ease: 'none', immediateRender: false, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: SCRUB } });
  }

  /* ---------- 2. section headings and their copy ---------- */
  $$('main h2, main section h1').forEach(function (h) {
    if (h.closest('.hero, .page-top, .species-top, .contact-top, form, #enquiry-review, dialog, .mega, .notice, .empty-state, .grade-card, .product-feature, .news-list')) return;
    var trig = h.parentNode, label = trig.querySelector(':scope > .label, :scope > .chapter-number') || (trig.parentNode && trig.parentNode.querySelector(':scope > .label'));
    var tl = gsap.timeline({ scrollTrigger: { trigger: trig, start: 'top 82%' } });
    if (label && !label.dataset.shown) { label.dataset.shown = '1'; tl.from(label, { y: 12, opacity: 0, duration: 0.6, ease: 'power3.out' }); }
    tl.from(lines(h), { yPercent: 112, duration: 1.05, stagger: 0.08, ease: 'power4.out' }, 0.05);
    var rest = after(h);
    if (rest.length) tl.from(rest, { y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.3);
  });
  /* blocks whose copy is not led by an h2 in the same parent */
  $$('.intro-copy, .chapter-body > p, .source-note').forEach(function (el) {
    gsap.from(el, { y: 26, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  /* ---------- 3. photographs ---------- */
  /* framed: the frame stays, the photo drifts and settles inside it */
  $$('.process-photo img, .wide-photo img').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -5, scale: 1.16 }, { yPercent: 5, scale: 1.04, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: SCRUB } });
  });
  /* unframed: the photo opens from a smaller window as it comes up the screen */
  $$('.home-place > img, .chapter-body img, .company-location img, .grade-specimen img').forEach(function (img) {
    gsap.fromTo(img, { clipPath: 'inset(14% 9% 14% 9%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: img, start: 'top 98%', end: 'top 45%', scrub: SCRUB } });
  });
  /* product samples on the home cards turn up slowly as the cards pass */
  $$('.product-feature > img').forEach(function (img) {
    gsap.fromTo(img, { scale: 0.94 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'center 45%', scrub: SCRUB } });
  });

  /* ---------- 4. cards, rows and lists arrive in order ---------- */
  var groups = [
    ['.product-feature', { y: 80, opacity: 0 }],
    ['.grade-card', { y: 60, opacity: 0 }],
    ['.document-row', { y: 34, opacity: 0 }],
    ['.resource-links > a, .news-list > a', { y: 30, opacity: 0 }],
    ['.facts-list > *, .check-list li', { x: -24, opacity: 0 }],
    ['.grade-table tbody tr', { y: 24, opacity: 0 }],
    ['.faq-section details', { y: 24, opacity: 0 }],
    ['.enquiry-band__actions > *', { y: 24, opacity: 0 }],
    ['footer .footer-main > div', { y: 36, opacity: 0 }]
  ];
  var batched = [];
  groups.forEach(function (g) {
    var els = $$(g[0]).filter(function (n) { return !n.dataset.shown; });
    if (!els.length) return;
    batched = batched.concat(els);
    gsap.set(els, g[1]);
    ScrollTrigger.batch(els, { start: 'top 88%', onEnter: function (b) { show(b); } });
  });
  function show(b, now) {
    b = b.filter(function (n) { return !n.dataset.shown && (n.dataset.shown = '1'); });
    if (!b.length) return;
    /* a filter or form result is the answer to a click: it appears at once, like site.js renders it */
    if (now) { gsap.killTweensOf(b); gsap.set(b, { clearProps: 'transform,opacity' }); return; }
    gsap.to(b, { x: 0, y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: Math.min(0.08, 0.5 / b.length), overwrite: true, clearProps: 'transform,opacity' });
  }
  /* safety net: filters and the enquiry form move content around; anything on or above the
     screen that never got its entrance is shown now instead of staying invisible */
  function sweep(now) {
    /* at the very bottom the last rows can never reach the 88% line, so the whole screen counts */
    var limit = scrollY + innerHeight >= document.documentElement.scrollHeight - 4 ? innerHeight : innerHeight * 0.92;
    /* a row caught mid-entrance by a filter click finishes at once too (WebKit audit: it kept fading from 0.73) */
    if (now === true) batched.forEach(function (n) { if (n.dataset.shown && n.offsetParent !== null && n.getBoundingClientRect().top < limit) gsap.getTweensOf(n).forEach(function (t) { t.progress(1); }); });
    show(batched.filter(function (n) { return !n.dataset.shown && n.offsetParent !== null && n.getBoundingClientRect().top < limit; }), now === true);
  }
  ScrollTrigger.addEventListener('refresh', sweep);
  function sweepNow() { sweep(true); }
  /* filters swap cards in place, sometimes without changing the page height (no resize, no
     refresh), so every filter or form change checks straight away and again after site.js renders */
  ['change', 'input', 'click'].forEach(function (t) { document.addEventListener(t, function (e) {
    if (!e.target.closest || !e.target.closest('.filters, .filter-bar, .document-controls, form, #enquiry-review, .empty-state')) return;
    setTimeout(sweepNow, 0); setTimeout(function () { sweepNow(); ScrollTrigger.refresh(); }, 120);
  }, true); });
  addEventListener('scroll', function () { if (!sweep.q) { sweep.q = 1; requestAnimationFrame(function () { sweep.q = 0; sweep(); }); } }, { passive: true });

  /* ---------- 5. the subnav lifts a hairline shadow while it is stuck ---------- */
  var sub = $('.subnav');
  if (sub) ScrollTrigger.create({ trigger: sub, start: function () { return 'top top+=' + Math.ceil(headH() + 1); }, endTrigger: 'main', end: 'bottom top', toggleClass: { targets: sub, className: 'is-stuck' }, invalidateOnRefresh: true });

  /* ---------- 6. keep measurements true ---------- */
  var rt;
  new ResizeObserver(function () {
    if (document.body.classList.contains('dialog-open')) return;
    clearTimeout(rt); rt = setTimeout(function () { ScrollTrigger.refresh(); }, 160);
  }).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
  /* a hash on arrival (from another page) lands under the header once layout is final */
  if (location.hash) addEventListener('load', function () { var el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(function () { scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - offset())); if (M.lenis) M.lenis.scrollTo(scrollY, { immediate: true }); }, 60); });
})();
