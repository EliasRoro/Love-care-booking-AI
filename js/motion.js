/* ==========================================================================
   Love-Care-Support — motion layer (vanilla, no libraries)
   - Scroll-reveal via IntersectionObserver (.reveal -> .visible)
   - Animated stat counters (data-count)
   - Subtle hero parallax (transform/opacity only, rAF-throttled)
   All disabled when the user prefers reduced motion.
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -- Scroll reveal -------------------------------------------------------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (REDUCED || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          ro.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -48px 0px" });
    revealEls.forEach(function (el) { ro.observe(el); });
  }

  /* -- Animated counters ----------------------------------------------------- */
  function setFinal(el) {
    var target = parseFloat(el.getAttribute("data-count") || "0");
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    el.querySelector(".num-val").textContent = target.toFixed(decimals);
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count") || "0");
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var dur = 1600;
    var t0 = null;
    function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.querySelector(".num-val").textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var counters = document.querySelectorAll("[data-count]");
  if (REDUCED || !("IntersectionObserver" in window)) {
    counters.forEach(setFinal);
  } else {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          co.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* -- Hero parallax (gentle content drift on scroll) ------------------------ */
  if (!REDUCED) {
    var heroContent = document.querySelector(".hero .hero-inner");
    if (heroContent) {
      var ticking = false;
      function onScroll() {
        var y = window.scrollY || window.pageYOffset;
        if (y < window.innerHeight * 1.2) {
          heroContent.style.transform = "translateY(" + (y * 0.18) + "px)";
          heroContent.style.opacity = Math.max(0, 1 - y / (window.innerHeight * 0.85));
        }
        ticking = false;
      }
      window.addEventListener("scroll", function () {
        if (!ticking) {
          window.requestAnimationFrame(onScroll);
          ticking = true;
        }
      }, { passive: true });
    }
  }
})();
