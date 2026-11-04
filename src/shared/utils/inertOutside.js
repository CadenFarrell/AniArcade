// Makes everything on the page except `el` inert, and returns the undo. This is
// how Modal keeps what `aria-modal="true"` only CLAIMS.
//
// Before this, an open dialog covered the page for a pointer (its scrim is
// fixed over everything, the top bar included) and for nobody else. Tab walked
// out of the dialog into the buttons under the scrim, and a screen reader read
// the page behind it as if no dialog were open. The playtest bots found it the
// same way: their snapshot skips inert and aria-hidden subtrees but nothing
// else, so on AniWave's spectrum editor they pressed "Write your own" and the
// suggestions UNDER the dialog, and the scrim took every one of those clicks.
//
// The dialog stays where React rendered it (no portal: tests and callers find
// it inside their own container). Instead the walk goes from the dialog up to
// <body> and marks every SIBLING at each level, so the one chain of ancestors
// down to the dialog stays live and everything else does not. It is the
// standard "hide outside" technique, done with `inert` rather than aria-hidden
// because inert also takes the subtree out of focus and out of clicks.
//
// Two rules keep dialogs that stack working:
// - Only nodes this call marked are unmarked by its undo. A node that was
//   already inert (an older dialog's work, or the page's own) is left alone,
//   so closing a dialog on top hands the page back to the one underneath, not
//   to everyone.
// - A node that arrives LATER at one of the walked levels is marked too (the
//   screen behind can swap while a dialog is open: an online round moves on
//   under the rules sheet). A later node that is or holds a dialog is not
//   marked: that is a newer dialog, which isolates itself, and marking it
//   would leave nothing on the page usable.
const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);
const holdsDialog = (node) => node.matches('[aria-modal="true"]') || Boolean(node.querySelector('[aria-modal="true"]'));

export function inertOutside(el) {
  if (!el || typeof document === 'undefined') return () => {};
  const chain = new Set();
  for (let node = el; node && node !== document.body && node.parentElement; node = node.parentElement) {
    chain.add(node);
  }

  const marked = [];
  const mark = (node, { later = false } = {}) => {
    if (!(node instanceof Element) || chain.has(node) || SKIP.has(node.tagName)) return;
    if (node.hasAttribute('inert')) return;
    if (later && holdsDialog(node)) return;
    node.setAttribute('inert', '');
    marked.push(node);
  };

  const observers = [];
  for (const node of chain) {
    const parent = node.parentElement;
    for (const sibling of parent.children) mark(sibling);
    if (typeof MutationObserver !== 'undefined') {
      const watch = new MutationObserver((records) => {
        for (const r of records) for (const added of r.addedNodes) mark(added, { later: true });
      });
      watch.observe(parent, { childList: true });
      observers.push(watch);
    }
  }

  return () => {
    for (const watch of observers) watch.disconnect();
    for (const node of marked) node.removeAttribute('inert');
  };
}
