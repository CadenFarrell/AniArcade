// What a bot "sees": one serializable description of the current screen.
//
// THIS FUNCTION MUST STAY SELF-CONTAINED — no imports, no closures over module
// scope, no helpers defined outside it. The browser layer runs it inside the
// page with `page.evaluate(snapshotDom)`, which ships the function's SOURCE
// TEXT and re-parses it there, so anything it references from outside simply
// does not exist on the other side. That is the price of one definition of a
// "screen" shared by jsdom and real Chrome, and sharing it is the point: a
// strategy written against this shape plays both without knowing which it is in.
//
// Each control is tagged with a fresh `data-bot-id` on every call, and actions
// name controls by that id. Ids are reassigned each snapshot on purpose: a
// stale id from two screens ago must miss rather than land on whatever control
// now happens to carry the old number.
//
// `opts.root` (an element, jsdom only) or `opts.rootSelector` scopes the
// snapshot to one subtree, and `opts.prefix` namespaces the ids: the online
// runner mounts several devices into one jsdom document, each in its own
// container, and two devices' c0 must never be the same control.
export function snapshotDom(opts = {}) {
  const doc = document;
  const root = opts.root ?? (opts.rootSelector ? doc.querySelector(opts.rootSelector) : doc.body);
  const prefix = opts.prefix ?? 'c';
  // jsdom applies no CSS and implements no layout, so it cannot answer "is this
  // visible" — it would call every element zero-sized. Chrome can. jsdom
  // identifies itself in the user agent, which is the cleanest switch.
  const isJsdom = /jsdom/i.test(navigator.userAgent);
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

  function hiddenByTree(el) {
    for (let n = el; n && n !== root; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true' || n.inert) return true;
      if (n.style && n.style.display === 'none') return true;
    }
    return false;
  }

  function visible(el) {
    if (hiddenByTree(el)) return false;
    if (isJsdom) return true;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function labelText(el) {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? '').join(' ');
      if (clean(t)) return clean(t);
    }
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    if (el.labels && el.labels.length) return clean([...el.labels].map((l) => l.textContent).join(' '));
    const wrap = el.closest('label');
    if (wrap) return clean(wrap.textContent);
    return '';
  }

  function nameOf(el, role) {
    if (['textbox', 'combobox', 'spinbutton', 'slider', 'listbox'].includes(role)) {
      return labelText(el) || clean(el.getAttribute('placeholder')) || clean(el.getAttribute('title'));
    }
    return labelText(el) || clean(el.textContent) || clean(el.getAttribute('title')) || clean(el.value);
  }

  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'range') return 'slider';
      if (t === 'number') return 'spinbutton';
      if (['button', 'submit', 'reset'].includes(t)) return 'button';
      if (t === 'hidden' || t === 'file') return null;
      return 'textbox';
    }
    return null;
  }

  function disabledOf(el) {
    if (el.disabled) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;
    const fs = el.closest('fieldset');
    return Boolean(fs && fs.disabled);
  }

  for (const old of root.querySelectorAll('[data-bot-id]')) old.removeAttribute('data-bot-id');

  const selector = [
    'button', 'a[href]', 'input', 'textarea', 'select',
    '[role=button]', '[role=radio]', '[role=checkbox]', '[role=switch]',
    '[role=slider]', '[role=option]', '[role=tab]', '[role=menuitem]',
  ].join(',');
  const controls = [];
  let n = 0;
  for (const el of root.querySelectorAll(selector)) {
    const role = roleOf(el);
    if (!role || !visible(el)) continue;
    const id = `${prefix}${n++}`;
    el.setAttribute('data-bot-id', id);
    const c = { id, role, name: nameOf(el, role), disabled: disabledOf(el) };
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      c.type = (el.getAttribute('type') || 'text').toLowerCase();
      c.value = el.value;
      // "Is this box asking for a number" — a numeric text box is a textbox to
      // the accessibility tree and only these two say otherwise.
      c.numeric = el.inputMode === 'numeric' || el.getAttribute('inputmode') === 'numeric'
        || /number/i.test(el.getAttribute('placeholder') ?? '');
      if (el.min !== '') c.min = Number(el.min);
      if (el.max !== '') c.max = Number(el.max);
    }
    if (role === 'checkbox' || role === 'radio' || role === 'switch') {
      c.checked = el.checked ?? el.getAttribute('aria-checked') === 'true';
    }
    if (role === 'slider' && el.tagName !== 'INPUT') {
      c.value = el.getAttribute('aria-valuenow');
      c.min = Number(el.getAttribute('aria-valuemin'));
      c.max = Number(el.getAttribute('aria-valuemax'));
    }
    if (el.tagName === 'SELECT') {
      c.value = el.value;
      c.options = [...el.options].filter((o) => !o.disabled).map((o) => o.value);
    }
    if (el.getAttribute('aria-pressed') != null) c.pressed = el.getAttribute('aria-pressed') === 'true';
    if (el.getAttribute('aria-selected') != null) c.selected = el.getAttribute('aria-selected') === 'true';
    controls.push(c);
  }

  // innerText respects CSS visibility in Chrome; jsdom does not implement it at
  // all, and textContent is the closest it can offer (both blurb homes and all).
  const text = clean(isJsdom ? root.textContent : root.innerText);
  // The numbers on screen, for the online "every device agrees" check. Read
  // per text node, because `text` runs neighbours together ("0 pts" beside
  // "4 players" reads "04"). Live regions are skipped: a status line is about
  // THIS device — the host's results bar says "4 players" where a guest's says
  // "Waiting for the host…" — not about the result the devices must share.
  // A count-up's moving copy (`data-count-up`, shared/components/CountUp.jsx)
  // is skipped too: it is mid-count on one phone and settled on another, and
  // its sr-only twin beside it already holds the final number.
  const tally = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('[aria-live], [role=status], [data-count-up], script, style') || !visible(el)) continue;
    tally.push(...(n.nodeValue.match(/-?\d+/g) ?? []));
  }

  const headingEl = [...root.querySelectorAll('h1, h2, h3, [role=heading]')].find(visible);
  const heading = clean(headingEl?.textContent);
  const dialog = Boolean(root.querySelector('[role=dialog], dialog[open]'));

  // `screen` is what coverage counts: the heading with digits folded out, so
  // "Round 3 of 5" and "Round 4 of 5" are one screen (the driver folds player
  // names out too, since it knows them). `signature` is what progress
  // detection compares: everything, values included, so typing into a box
  // counts as something having happened.
  const screenId = (heading || '(no heading)').replace(/\d+/g, '#').slice(0, 80);
  const signature = `${text.length}:${text.slice(0, 400)}|${controls.map((c) => `${c.name}=${c.value ?? ''}${c.disabled ? '!' : ''}${c.checked ? '*' : ''}`).join(',')}`;

  return { heading, text, controls, dialog, screen: screenId, signature, tally };
}
