/* ============================================================
   FREE RANGE TUTORS — main.js
   Minimal JavaScript. Only for essential interactions.
   No frameworks. No dependencies.
   ============================================================ */


/* ============================================================
   MOBILE NAVIGATION TOGGLE
   ============================================================ */

(function () {
  const toggle  = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');

  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', function () {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';

    toggle.setAttribute('aria-expanded', String(!isOpen));
    mobileNav.hidden = isOpen;

    // Animate the hamburger bars into an X
    const bars = toggle.querySelectorAll('.nav-toggle-bar');
    if (!isOpen) {
      bars[0].style.transform = 'translateY(6.5px) rotate(45deg)';
      bars[1].style.opacity  = '0';
      bars[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
    } else {
      bars[0].style.transform = '';
      bars[1].style.opacity  = '';
      bars[2].style.transform = '';
    }
  });

  // Close mobile nav when a link is tapped
  mobileNav.querySelectorAll('.mobile-nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
      const bars = toggle.querySelectorAll('.nav-toggle-bar');
      bars[0].style.transform = '';
      bars[1].style.opacity  = '';
      bars[2].style.transform = '';
    });
  });

})();


/* ============================================================
   RESOURCE FILTER STRIP
   Purely visual state for the shell — no actual filtering yet.
   Each button becomes active on click; only one active at a time.
   ============================================================ */

(function () {
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) {
        b.classList.remove('filter-btn--active');
      });
      btn.classList.add('filter-btn--active');
    });
  });

})();


/* ============================================================
   MARK ACTIVE NAV LINK
   Simple path matching — marks current section in desktop nav.
   ============================================================ */

(function () {
  const navLinks = document.querySelectorAll('.nav-link');
  const path = window.location.pathname;

  navLinks.forEach(function (link) {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });

})();
