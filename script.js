// Call-to-action buttons: scroll gently to the form and put the cursor in the name field (map 2, section 7).
const contactSection = document.getElementById('contact');
const nameInput = document.getElementById('name');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('a[href="#contact"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    contactSection.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    nameInput.focus({ preventScroll: true });
  });
});

// Demo form: it never sends or stores anything (rules.md). The thank-you message is added in stage 8.
document.querySelector('.contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
});
