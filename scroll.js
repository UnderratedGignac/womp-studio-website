/**
 * womp-studio/scroll.js — GSAP ScrollTrigger orchestration for the Womp Studio site.
 * Feeds scroll energy to the abstract background, reveals sections, animates
 * counters, decodes eyebrows, lifts headings word-by-word, draws the trajectory
 * timeline, adds card cursor-spotlight, and velocity-skews the marquees.
 * Degrades silently without GSAP.
 * Public API: window.WompScroll = { init(), refresh() }
 */
'use strict';

(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    window.WompScroll = { init: function () {}, refresh: function () {} };
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    // Feed scroll progress to the 3D scene (rotation + dolly).
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        if (window.WompThree && window.WompThree.setScroll) window.WompThree.setScroll(self.progress);
      }
    });

    // Scroll progress bar.
    var bar = document.querySelector('.scroll-progress');
    if (bar) {
      gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) { gsap.set(bar, { scaleX: self.progress }); } });
    }

    // Section reveals: [data-reveal] fade + rise on enter (once).
    if (!reduce) {
      gsap.utils.toArray('[data-reveal]').forEach(function (el) {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          once: true,
          onEnter: function () {
            gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', overwrite: true });
          },
          onRefresh: function () {
            // ensure the hidden start state matches CSS (opacity:0; translateY(28px))
            gsap.set(el, { opacity: 0, y: 28 });
          }
        });
      });
    } else {
      gsap.utils.toArray('[data-reveal]').forEach(function (el) { gsap.set(el, { opacity: 1, y: 0 }); });
    }

    // Counters: [data-count] counts up on first reveal.
    gsap.utils.toArray('[data-count]').forEach(function (el) {
      var target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) return;
      if (reduce) { el.textContent = target.toLocaleString(); return; }
      el.textContent = '0';
      var obj = { val: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () {
          gsap.to(obj, { val: target, duration: 1.5, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(obj.val).toLocaleString(); } });
        }
      });
    });

    // Word-mask heading reveals: h2 text lifts in word by word on enter.
    if (!reduce) {
      gsap.utils.toArray('.section h2').forEach(function (h) {
        if (h.querySelector('br') || h.classList.contains('sr-only')) return;
        var words = (h.textContent || '').trim().split(/\s+/);
        if (!words.length || words.length > 14) return;
        h.textContent = '';
        words.forEach(function (w, i) {
          if (i) h.appendChild(document.createTextNode(' '));
          var s = document.createElement('span'); s.className = 'w'; s.textContent = w;
          h.appendChild(s);
        });
        ScrollTrigger.create({
          trigger: h, start: 'top 88%', once: true,
          onEnter: function () {
            gsap.to(h.querySelectorAll('.w'), { y: 0, opacity: 1, duration: 0.75, stagger: 0.07, ease: 'power4.out' });
          }
        });
      });
    }

    // Decode-scramble eyebrows (short uppercase kickers) on enter.
    if (!reduce) {
      var GLY = 'ABCDEFGHJKMNPRSTUVWXYZ0123456789#*/·';
      gsap.utils.toArray('.section .eyebrow').forEach(function (el) {
        var final = el.textContent || '';
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: function () {
            var frame = 0;
            var id = setInterval(function () {
              frame++;
              var out = '';
              for (var i = 0; i < final.length; i++) {
                if (final[i] === ' ') { out += ' '; continue; }
                out += i < frame * 1.3 ? final[i] : GLY[Math.floor(Math.random() * GLY.length)];
              }
              el.textContent = out;
              if (frame * 1.3 > final.length) { clearInterval(id); el.textContent = final; }
            }, 38);
          }
        });
      });
    }

    // Trajectory timeline: gradient line draws down with scroll; items light up.
    var timeline = document.querySelector('.timeline');
    if (timeline) {
      var fill = timeline.querySelector('.tl-fill');
      if (fill && !reduce) {
        gsap.to(fill, {
          height: '100%', ease: 'none',
          scrollTrigger: { trigger: timeline, start: 'top 75%', end: 'bottom 65%', scrub: 0.6 }
        });
      } else if (fill) { fill.style.height = '100%'; }
      gsap.utils.toArray('.tl-item').forEach(function (item) {
        ScrollTrigger.create({
          trigger: item, start: 'top 82%', once: true,
          onEnter: function () { item.classList.add('in'); }
        });
      });
    }

    // Card cursor spotlight (mode cards):
    // pointermove sets --mx/--my used by .mode::after radial highlight.
    if (!reduce && window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      gsap.utils.toArray('.mode').forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
        }, { passive: true });
      });
    }

    // Velocity-skewed marquees (bands).
    if (!reduce) {
      gsap.utils.toArray('.band .track').forEach(function (track) {
        var skew = gsap.quickTo(track, 'skewX', { duration: 0.35, ease: 'power3' });
        var reset = null;
        ScrollTrigger.create({
          trigger: track, start: 'top bottom', end: 'bottom top',
          onUpdate: function (self) {
            skew(gsap.utils.clamp(-12, 12, self.getVelocity() / 55));
            if (reset) reset.kill();
            reset = gsap.delayedCall(0.25, function () { skew(0); });
          }
        });
      });
    }

    // Magnetic buttons (subtle pull toward cursor).
    if (!reduce && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      gsap.utils.toArray('.btn').forEach(function (btn) {
        var xTo = gsap.quickTo(btn, 'x', { duration: 0.3, ease: 'power3.out' });
        var yTo = gsap.quickTo(btn, 'y', { duration: 0.3, ease: 'power3.out' });
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.18);
          yTo((e.clientY - r.top - r.height / 2) * 0.28);
        });
        btn.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
      });
    }

    // Auto-scroll loop for studio.html (gentle and smooth)
    if (!reduce) {
      var studioAutoScroll = true;
      var studioPauseTimer = 0;
      function pauseStudioAuto() {
        studioAutoScroll = false;
        clearTimeout(studioPauseTimer);
        studioPauseTimer = setTimeout(function () { studioAutoScroll = true; }, 3000);
      }
      window.addEventListener('wheel', pauseStudioAuto, { passive: true });
      window.addEventListener('touchstart', pauseStudioAuto, { passive: true });
      window.addEventListener('keydown', pauseStudioAuto, { passive: true });
      function stepStudioScroll() {
        if (studioAutoScroll) {
          var max = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight - 10;
          if (window.scrollY < max) {
            window.scrollBy(0, 0.8);
          } else if (!window._studioLoopTimer) {
            window._studioLoopTimer = setTimeout(function () {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window._studioLoopTimer = 0;
            }, 3000);
          }
        }
        requestAnimationFrame(stepStudioScroll);
      }
      requestAnimationFrame(stepStudioScroll);
    }

    // Refresh after fonts + full load; debounced resize.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    var rz;
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { ScrollTrigger.refresh(); }, 150); });
    setTimeout(function () { ScrollTrigger.refresh(); }, 100);
  }

  function refresh() { if (initialized) ScrollTrigger.refresh(); }
  window.WompScroll = { init: init, refresh: refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
