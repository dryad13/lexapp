(function () {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('navBar');
  var services = document.getElementById('navServices');
  var servicesBtn = document.getElementById('navServicesBtn');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && services) {
        services.classList.remove('is-open');
        if (servicesBtn) servicesBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (services && servicesBtn) {
    var closeTimer = null;

    function openServices() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      services.classList.add('is-open');
      servicesBtn.setAttribute('aria-expanded', 'true');
    }

    function scheduleClose() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        services.classList.remove('is-open');
        servicesBtn.setAttribute('aria-expanded', 'false');
        closeTimer = null;
      }, 180);
    }

    services.addEventListener('mouseenter', openServices);
    services.addEventListener('mouseleave', scheduleClose);

    servicesBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (services.classList.contains('is-open')) {
        services.classList.remove('is-open');
        servicesBtn.setAttribute('aria-expanded', 'false');
      } else {
        openServices();
      }
    });

    document.addEventListener('click', function (e) {
      if (!services.contains(e.target)) {
        if (closeTimer) clearTimeout(closeTimer);
        services.classList.remove('is-open');
        servicesBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();

(function () {
  function showAll() {
    var nodes = document.querySelectorAll('[data-animate], [data-animate-stagger] > *');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.opacity = '1';
      nodes[i].style.transform = 'none';
    }
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  if (typeof anime !== 'function') {
    showAll();
    return;
  }

  var motion = {
    opacity: [0, 1],
    translateY: [18, 0],
    duration: 700,
    easing: 'easeOutCubic'
  };

  function lockVisible(el) {
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  function revealOne(el, delay) {
    anime({
      targets: el,
      opacity: motion.opacity,
      translateY: motion.translateY,
      duration: motion.duration,
      easing: motion.easing,
      delay: delay || 0,
      complete: function () {
        lockVisible(el);
      }
    });
  }

  function revealStagger(container) {
    var kids = container.children;
    if (!kids.length) return;
    anime({
      targets: kids,
      opacity: motion.opacity,
      translateY: motion.translateY,
      duration: motion.duration,
      easing: motion.easing,
      delay: anime.stagger(80),
      complete: function () {
        for (var i = 0; i < kids.length; i++) {
          lockVisible(kids[i]);
        }
      }
    });
    if (container.hasAttribute('data-animate-stats')) {
      countUpStats(container);
    }
  }

  function countUpStats(container) {
    var nums = container.querySelectorAll('.stat-num[data-count]');
    for (var i = 0; i < nums.length; i++) {
      (function (el) {
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (!target) return;
        var prefix = el.getAttribute('data-count-prefix') || '';
        var suffix = el.getAttribute('data-count-suffix') || '';
        var state = { n: 0 };
        el.textContent = prefix + '0' + suffix;
        anime({
          targets: state,
          n: target,
          round: 1,
          duration: 1400,
          delay: 120,
          easing: 'easeOutCubic',
          update: function () {
            el.textContent = prefix + state.n.toLocaleString('en-GB') + suffix;
          }
        });
      })(nums[i]);
    }
  }

  function runReveal(el) {
    if (el.getAttribute('data-revealed') === '1') return;
    el.setAttribute('data-revealed', '1');
    if (el.hasAttribute('data-animate-stagger')) {
      revealStagger(el);
    } else {
      revealOne(el, 0);
    }
  }

  var heroes = document.querySelectorAll('[data-animate="hero"]');
  for (var h = 0; h < heroes.length; h++) {
    heroes[h].setAttribute('data-revealed', '1');
    revealOne(heroes[h], h * 100);
  }

  var scrollTargets = document.querySelectorAll(
    '[data-animate]:not([data-animate="hero"]), [data-animate-stagger]'
  );
  if (!scrollTargets.length) return;

  var io = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isIntersecting) continue;
        var el = entry.target;
        io.unobserve(el);
        runReveal(el);
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
  );

  function nearViewport(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * 0.96 && r.bottom > 0;
  }

  for (var s = 0; s < scrollTargets.length; s++) {
    var target = scrollTargets[s];
    if (nearViewport(target)) {
      runReveal(target);
    } else {
      io.observe(target);
    }
  }

  // Safety: never leave motion targets stuck invisible
  setTimeout(function () {
    var stuck = document.querySelectorAll(
      '[data-animate]:not([data-revealed="1"]), [data-animate-stagger]:not([data-revealed="1"])'
    );
    for (var i = 0; i < stuck.length; i++) {
      runReveal(stuck[i]);
    }
    var kids = document.querySelectorAll('[data-animate-stagger] > *');
    for (var k = 0; k < kids.length; k++) {
      if (parseFloat(getComputedStyle(kids[k]).opacity) < 0.05) {
        lockVisible(kids[k]);
      }
    }
  }, 2500);
})();
