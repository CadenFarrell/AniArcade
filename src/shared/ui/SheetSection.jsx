// One section of a reference dialog: an ink tab for its title over a list. The
// Credits dialog drew this first; the How to play sheet is the second, so it
// lives here rather than as two copies of the same tab.
//
// `children` are the list items. The tab is an h3 because both dialogs carry
// an h2 of their own.
export default function SheetSection({ title, children, className = 'mb-5' }) {
  return (
    <section className={className}>
      <h3 className="mb-2 inline-block bg-ink px-2 py-0.5 font-display text-xs font-bold uppercase tracking-[0.18em] text-paper">
        {title}
      </h3>
      <ul className="space-y-2 text-sm text-fg-strong">{children}</ul>
    </section>
  );
}
