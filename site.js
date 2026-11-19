// =============================================================================
// Version A ("light in the window"): motion, photo slots, form, certificates.
// The calculator itself lives in assets/js/calc.js and is not touched here.
// Spec: site-map-3-redesign-spec, sections 5, 7.1, 8 and 9.4.
// =============================================================================
(function () {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reduce.matches;
  const hasGsap = () => typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  // ---------------------------------------------------------------------------
  // Photo slots: a slot shows its photo only once the file actually loads.
  // David uploads the file under the fixed name (_build/images.md) and it appears.
  // ---------------------------------------------------------------------------
  function initPhotoSlots() {
    document.querySelectorAll('.photo-slot .slot-img').forEach((img) => {
      const slot = img.closest('.photo-slot');
      const ok = () => { slot.classList.add('has-photo'); refresh(); };
      const fail = () => img.removeAttribute('src');
      if (img.complete && img.naturalWidth > 0) ok();
      else if (img.complete) fail();
      else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); }
    });
  }

  function refresh() {
    if (hasGsap() && root.classList.contains('js-motion')) window.ScrollTrigger.refresh();
  }

  // ---------------------------------------------------------------------------
  // Split a heading into words (not letters: separate Hebrew letters break the shape).
  // The heading keeps its full text for screen readers through aria-label.
  // ---------------------------------------------------------------------------
  function splitWords(el) {
    if (el.dataset.splitDone) return [];
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const words = [];
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const span = document.createElement('span');
            span.className = 'w';
            span.setAttribute('aria-hidden', 'true');
            span.style.setProperty('--i', i++);
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
    el.dataset.splitDone = '1';
    return words;
  }

  // ---------------------------------------------------------------------------
  // One IntersectionObserver for all "appear once" effects (M4, M9, M10, M12).
  // ---------------------------------------------------------------------------
  function revealOnView(selector) {
    const els = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in-view')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
  }

  // ---------------------------------------------------------------------------
  // Scroll-linked motion (M3, M6, M7, M8) with GSAP ScrollTrigger.
  // Plain browser scrolling: the page only reacts to it, it never takes it over.
  // ---------------------------------------------------------------------------
  function initScrollMotion() {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('has-stage');
    const mm = gsap.matchMedia();

    // M6: bridge sentence, words light up in reading order
    const bridge = document.querySelector('.bridge-text');
    if (bridge) {
      const words = Array.from(bridge.querySelectorAll('.w'));
      ScrollTrigger.create({
        trigger: bridge, start: 'top 85%', end: 'top 50%', scrub: true,
        onUpdate: (self) => {
          const lit = Math.round(self.progress * words.length);
          words.forEach((w, i) => w.classList.toggle('lit', i < lit));
        },
      });
    }

    // M8: the timeline fills with light, dots switch on
    const fill = document.querySelector('.steps-fill');
    const wrap = document.querySelector('.steps-wrap');
    if (fill && wrap) {
      gsap.fromTo(fill, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top 50%', end: 'bottom 50%', scrub: 0.6 },
      });
      document.querySelectorAll('.step-dot').forEach((dot) => {
        ScrollTrigger.create({
          trigger: dot, start: 'center 50%',
          onEnter: () => dot.classList.add('is-lit'),
          onLeaveBack: () => dot.classList.remove('is-lit'),
        });
      });
    }

    mm.add('(min-width: 900px)', () => {
      // M3: Daniel moves up slower than the text (parallax), up to 40px
      const fig = document.querySelector('.hero-figure');
      if (fig) {
        gsap.to(fig, { y: -40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      }

      // M7: the big number on the pinned stage follows the active item
      const items = Array.from(document.querySelectorAll('.bank-item'));
      const nums = Array.from(document.querySelectorAll('.stage-num'));
      const setActive = (index) => {
        items.forEach((item, i) => item.classList.toggle('is-active', i === index));
        nums.forEach((num, i) => {
          const wasActive = num.classList.contains('is-active');
          num.classList.toggle('was-active', wasActive && i !== index && i < index);
          num.classList.toggle('is-active', i === index);
        });
      };
      items.forEach((item, i) => {
        ScrollTrigger.create({
          trigger: item, start: 'top 55%', end: 'bottom 55%',
          onToggle: (self) => { if (self.isActive) setActive(i); },
        });
      });
      return () => {
        items.forEach((item, i) => item.classList.toggle('is-active', i === 0));
        nums.forEach((num, i) => { num.classList.toggle('is-active', i === 0); num.classList.remove('was-active'); });
      };
    });

    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  // ---------------------------------------------------------------------------
  // Contact form: demo only. It never sends or stores anything (rules.md, D3).
  // ---------------------------------------------------------------------------
  function initContactForm() {
    const form = document.querySelector('.contact-form');
    if (!form) return;
    const name = document.getElementById('name');
    const phone = document.getElementById('phone');
    const fields = form.querySelector('.form-fields');
    const thanks = form.querySelector('.thanks');
    const MSG = {
      name: 'חסר שם.',
      phone: 'המספר הזה לא נראה כמו מספר טלפון. תבדקו שיש בו 9 או 10 ספרות.',
    };
    const show = (input, text) => {
      const msg = document.getElementById(input.id + '-msg');
      msg.querySelector('span').textContent = text;
      msg.hidden = !text;
      input.toggleAttribute('aria-invalid', Boolean(text));
      if (text) input.setAttribute('aria-describedby', msg.id); else input.removeAttribute('aria-describedby');
    };
    [name, phone].forEach((input) => input.addEventListener('input', () => show(input, '')));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const digits = phone.value.replace(/\D/g, '');
      const nameBad = name.value.trim() === '';
      const phoneBad = digits.length < 9 || digits.length > 10;
      show(name, nameBad ? MSG.name : '');
      show(phone, phoneBad ? MSG.phone : '');
      if (nameBad) { name.focus(); return; }
      if (phoneBad) { phone.focus(); return; }

      const finish = () => {
        fields.hidden = true;
        thanks.hidden = false;
        thanks.focus();
        form.reset();
      };
      if (motionOK()) { fields.style.opacity = '0'; setTimeout(finish, 250); } else finish();
    });
  }

  // The three buttons scroll to the form card, not the top of the screen (spec 5.8).
  // calc.js already scrolls to #contact and focuses the name field; this runs after it.
  function initCtaScroll() {
    const card = document.querySelector('.contact-card');
    document.querySelectorAll('a[href="#contact"]').forEach((link) => {
      link.addEventListener('click', () => {
        card.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Certificates open large in a <dialog>. Esc closes; focus goes back to the button.
  // ---------------------------------------------------------------------------
  function initCertDialog() {
    const dialog = document.querySelector('.cert-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    const use = dialog.querySelector('.cert-large use');
    let opener = null;
    document.querySelectorAll('.cert-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        opener = btn;
        use.setAttribute('href', '#' + btn.dataset.cert);
        dialog.showModal();
      });
    });
    dialog.querySelector('.cert-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { if (opener) opener.focus(); });
  }

  // FAQ: smooth open/close only where the browser can't do it in CSS (interpolate-size).
  function initFaqAnimation() {
    if (CSS.supports('interpolate-size', 'allow-keywords') || !motionOK()) return;
    document.querySelectorAll('.faq details').forEach((d) => {
      const summary = d.querySelector('summary');
      const answer = d.querySelector('.faq-answer');
      summary.addEventListener('click', (event) => {
        event.preventDefault();
        if (d.open) {
          answer.animate([{ height: answer.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 250, easing: 'ease' })
            .onfinish = () => { d.open = false; refresh(); };
        } else {
          d.open = true;
          answer.animate([{ height: '0px', opacity: 0 }, { height: answer.offsetHeight + 'px', opacity: 1 }], { duration: 250, easing: 'ease' })
            .onfinish = refresh;
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  function initMotion() {
    // html.js-motion is set in <head> only when reduced motion is not requested.
    // Without GSAP the page stays complete: the scroll-linked states are reset to final.
    if (!root.classList.contains('js-motion')) return;
    document.querySelectorAll('[data-split]').forEach(splitWords);
    revealOnView('.reveal, .calc-screen, .step-media, .contact-screen');
    if (hasGsap()) initScrollMotion();
    else {
      document.querySelectorAll('.bridge-text .w').forEach((w) => w.classList.add('lit'));
      document.querySelectorAll('.step-dot').forEach((d) => d.classList.add('is-lit'));
      root.classList.add('no-gsap');
    }
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));
  }

  initPhotoSlots();
  initMotion();
  initContactForm();
  initCtaScroll();
  initCertDialog();
  initFaqAnimation();
})();
