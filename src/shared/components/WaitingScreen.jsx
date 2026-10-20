import { Icon, Screen } from '../ui';

// The online "nothing to do yet" screen: a room loading, a deal landing, a
// turn somebody else is taking. Every OnlineGame renders it, which is why it
// lives here — it sat in AniGuess's folder for years and six games imported
// it from there.
//
// It wears GameLoading's frame (hub/GameLoading.jsx) — an ink-ruled paper
// panel over speed lines — so a wait reads as a panel of the page rather
// than as the bare centred column every screen was before the restyle. The
// icon is stamped in an ink block; a finished-and-waiting screen (`check`) is
// stamped in the yes ink instead, since "your dial is in" is a ready state.
//
// The h2 and its words are load-bearing: the playtest bots read the first
// heading as the screen's name ("Look away!", "Dial locked in").
//
// `children` is the escape-hatch slot: a screen that says "waiting on somebody"
// is exactly where the control that stops waiting belongs, and rendering that
// control as a sibling in the router would drop it outside the centred column.
// Optional, so every existing caller renders unchanged.
const STAMP = {
  check: 'bg-pop-lime',
};

export default function WaitingScreen({ icon = 'hourglass', title, subtitle, children }) {
  return (
    <Screen center className="text-center">
      <div className="relative overflow-hidden border-2 border-ink bg-surface px-6 py-8 shadow-pop">
        <div aria-hidden="true" className="speed-lines absolute inset-0 opacity-20" />
        {/* role=status: the subtitle changes under the player ("Still dialling:
            Ana, Ben" → "Everyone has dialled…") and a screen reader should hear
            it without the focus moving. */}
        <div role="status" className="relative">
          <div
            className={`mx-auto mb-5 grid size-16 place-items-center border-2 border-ink text-4xl text-paper
              shadow-pop-sm ${STAMP[icon] ?? 'bg-ink'}`}
          >
            <Icon name={icon} />
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-fg-strong">{title}</h2>
          {subtitle && <p className="mt-3 text-lg text-fg-body">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="mx-auto mt-8 w-full max-w-xs">{children}</div>}
    </Screen>
  );
}
