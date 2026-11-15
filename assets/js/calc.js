// ---------------------------------------------------------------------------
// Calculator: "which apartment can we afford?" (D4, formula and assumptions in D12)
// ---------------------------------------------------------------------------

// Assumptions. Every number about the real world has a source (rules.md):
const RATE_AVG = 0.0489;    // Bank of Israel average, unindexed, over 25 years, Sept 2026 (effective annual)
const RATE_GAP = 0.01;      // the low end of the range uses a rate one point higher
const MONTHS = 360;         // 30 years, the Bank of Israel maximum term
const LTV = 0.75;           // a bank lends up to 75% of the price of a single home (Directive 329)
const PTI_SOFT = 0.4;       // above 40% of income banks find it hard to approve (Directive 329)

// The Bank of Israel rate is an effective annual rate, so it is converted to a monthly rate.
function monthlyRate(annual) {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

// How much can be borrowed with a fixed monthly payment (Spitzer table).
function loanFromPayment(payment, annual) {
  const i = monthlyRate(annual);
  return payment * (1 - Math.pow(1 + i, -MONTHS)) / i;
}

// The monthly payment on a given loan (Spitzer table).
function paymentFromLoan(loan, annual) {
  const i = monthlyRate(annual);
  return loan * i / (1 - Math.pow(1 + i, -MONTHS));
}

const floorTo = (value, step) => Math.floor(value / step) * step;
const roundTo = (value, step) => Math.round(value / step) * step;

// Pure calculation, no page involved. Inputs are whole shekels, all above zero.
function calculate(equity, income, payment) {
  const cap = floorTo(income * PTI_SOFT, 10);
  const capped = payment > cap;
  const usedPayment = capped ? cap : payment;

  const maxLoan = equity * LTV / (1 - LTV);   // 75% loan, 25% equity: the loan is at most 3 times the equity
  const equityPayment = roundTo(paymentFromLoan(maxLoan, RATE_AVG), 10);
  const loanHigh = Math.min(loanFromPayment(usedPayment, RATE_AVG), maxLoan);
  const loanLow = Math.min(loanFromPayment(usedPayment, RATE_AVG + RATE_GAP), maxLoan);

  // Case B: at the average rate the bank would lend more than 75% allows, so the equity sets the price.
  // Only when the payment really comes out lower, because the text says "less than what you wrote".
  if (equityPayment < usedPayment) {
    return { type: 'equity', max: floorTo(equity + maxLoan, 10000), payment: equityPayment };
  }

  // Case A: the monthly payment sets the price. Rounded down, so the estimate never promises too much.
  return {
    type: 'range',
    low: floorTo(equity + loanLow, 10000),
    high: floorTo(equity + loanHigh, 10000),
    loanLow: floorTo(loanLow, 10000),
    loanHigh: floorTo(loanHigh, 10000),
    payment: usedPayment,
    capped,
  };
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
if (typeof document !== 'undefined') {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fmt = (n) => n.toLocaleString('en-US');
  const digitsOf = (text) => text.replace(/\D/g, '');

  // Call-to-action buttons: scroll gently to the form and put the cursor in the name field (map 2, section 7).
  const contactSection = document.getElementById('contact');
  const nameInput = document.getElementById('name');

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

  // --- Calculator fields: commas while typing (1,200,000), cursor stays in place ---
  const form = document.getElementById('calc');
  const fields = ['equity', 'income', 'payment'].map((id) => document.getElementById(id));

  fields.forEach((input) => {
    input.addEventListener('input', () => {
      const caret = input.selectionStart;
      const digitsBeforeCaret = digitsOf(input.value.slice(0, caret)).length;
      const digits = digitsOf(input.value).replace(/^0+(?=\d)/, '').slice(0, 9);
      input.value = digits ? fmt(Number(digits)) : '';

      let pos = 0;
      let seen = 0;
      while (pos < input.value.length && seen < digitsBeforeCaret) {
        if (/\d/.test(input.value[pos])) seen += 1;
        pos += 1;
      }
      input.setSelectionRange(pos, pos);
      showMessage(input, '');
    });
  });

  // --- Messages under a field (copy: "הודעות כשמשהו חסר") ---
  const MSG = {
    empty: 'תכתבו כאן מספר, גם בערך.',
    noEquity: 'בלי הון עצמי הבנק לא נותן משכנתא. לדירה ראשונה צריך להביא מהבית לפחות רבע מהמחיר.',
    noPayment: 'כתבתם החזר של אפס, אז החישוב הוא בלי משכנתא, והמחיר הוא ההון העצמי שכתבתם.',
  };

  function showMessage(input, text) {
    const msg = document.getElementById(input.id + '-msg');
    msg.querySelector('span').textContent = text;
    msg.hidden = !text;
    input.setAttribute('aria-describedby', text ? `${input.id}-help ${input.id}-msg` : `${input.id}-help`);
    input.toggleAttribute('aria-invalid', Boolean(text));
  }

  // --- Result panel ---
  const panel = document.getElementById('result');
  const live = document.getElementById('result-live');
  const rangeBox = panel.querySelector('.result-range');
  const equityBox = panel.querySelector('.result-equity');
  const capLine = panel.querySelector('.result-cap');
  const out = (name) => panel.querySelector(`[data-out="${name}"]`);

  // The numbers in the result sentence count up from zero in about half a second (map 2).
  function countUp(el, target) {
    const run = (el.countRun || 0) + 1;   // a new click cancels the previous count
    el.countRun = run;
    const finish = () => {
      if (el.countRun !== run) return;    // finished already, or a newer click took over
      el.textContent = fmt(target);
      el.countRun = run + 0.5;            // stops any frame that arrives late
    };
    if (reduceMotion.matches) {
      finish();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      if (el.countRun !== run) return;
      const t = Math.min((now - start) / 500, 1);
      if (t >= 1) {
        finish();
        return;
      }
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - t, 3)) / 1000) * 1000);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, 700);              // safety net: the browser may pause animation frames
  }

  function hideResult() {
    panel.hidden = true;
    form.classList.remove('has-result');
    live.textContent = '';
  }

  function showResult(r) {
    const isRange = r.type === 'range';
    rangeBox.hidden = !isRange;
    equityBox.hidden = isRange;

    if (isRange) {
      out('low-label').textContent = fmt(r.low);
      out('high-label').textContent = fmt(r.high);
      out('loan-low').textContent = fmt(r.loanLow);
      out('loan-high').textContent = fmt(r.loanHigh);
      out('payment').textContent = fmt(r.payment);
      out('cap-payment').textContent = fmt(r.payment);
      capLine.hidden = !r.capped;
    } else {
      out('eq-payment').textContent = fmt(r.payment);
    }

    panel.hidden = false;
    form.classList.add('has-result');

    if (isRange) {
      countUp(out('low'), r.low);
      countUp(out('high'), r.high);
      live.textContent = `לפי מה שכתבתם, אתם יכולים לחפש דירה במחיר של ${fmt(r.low)} עד ${fmt(r.high)} ש"ח.`;
    } else {
      countUp(out('max'), r.max);
      live.textContent = `לפי מה שכתבתם, אתם יכולים לחפש דירה במחיר של עד ${fmt(r.max)} ש"ח.`;
    }

    panel.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const [equityIn, incomeIn, paymentIn] = fields;
    const value = (input) => (digitsOf(input.value) === '' ? null : Number(digitsOf(input.value)));
    const equity = value(equityIn);
    const income = value(incomeIn);
    const payment = value(paymentIn);

    fields.forEach((input) => showMessage(input, ''));
    let ok = true;

    if (equity === null) { showMessage(equityIn, MSG.empty); ok = false; }
    else if (equity === 0) { showMessage(equityIn, MSG.noEquity); ok = false; }

    // An income of zero gets the empty-field message, so no new text is needed (D12).
    if (income === null || income === 0) { showMessage(incomeIn, MSG.empty); ok = false; }

    if (payment === null) { showMessage(paymentIn, MSG.empty); ok = false; }
    else if (payment === 0) { showMessage(paymentIn, MSG.noPayment); ok = false; }

    if (!ok) {
      hideResult();
      const first = fields.find((input) => input.hasAttribute('aria-invalid'));
      if (first) first.focus();
      return;
    }

    showResult(calculate(equity, income, payment));
  });
}
