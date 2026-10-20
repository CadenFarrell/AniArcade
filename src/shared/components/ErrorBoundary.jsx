import { Component } from 'react';
import { storage } from '../services/storage';
import { keysToClear } from '../utils/resetKeys';
import Button from '../ui/Button';
import Screen from '../ui/Screen';
import { Icon, Kana } from '../ui';
import { KANA } from '../ui/kanaText';

// Both screens are one panel of the page — WaitingScreen's ink-ruled frame,
// with the mark stamped in an ink block — so a crash looks like part of the
// arcade rather than the bare column it was before the restyle. The stamp's
// ink is the meaning: amber (warning) for a download that failed, crimson
// (wrong) for a real crash. Still no texture utility and no Backdrop: the
// boundary must render with as little as possible, since whatever crashed may
// be something the rest of the page is built from.
function ErrorPanel({ icon, tone, title, children }) {
  return (
    <Screen center width="md" className="text-center">
      <div className="border-2 border-ink bg-surface px-6 py-8 shadow-pop">
        <div
          className={`mx-auto mb-5 grid size-16 place-items-center border-2 border-ink text-4xl text-paper
            shadow-pop-sm ${tone}`}
        >
          <Icon name={icon} />
        </div>
        <h2 className="mb-3 font-display text-3xl font-bold uppercase tracking-wide text-fg-strong">
          {title} <Kana className="ml-1 text-base text-fg-subtle">{KANA.error}</Kana>
        </h2>
        {children}
      </div>
    </Screen>
  );
}

// The one deliberate exception to "no class components" — React requires
// a class component for componentDidCatch/getDerivedStateFromError.
//
// Mounted twice, and the two do different jobs. The root one (main.jsx) is the
// last resort: nothing is left to return to, so it only offers the reset. The
// per-game one (HubScreen) wraps a single <Game>, so it can offer the menu
// instead — one game's render crash used to blank the whole arcade with no way
// back, which turned any bug in the newest game into a bug in all of them.
export default class ErrorBoundary extends Component {
  state = { hasError: false, loadFailed: false };

  // `gameLoad` is lazyGame's tag for a game whose code never downloaded — a
  // dropped connection, or a tab left open across a deploy, whose old chunk
  // filenames no longer exist. That is not a crash, and the screen must not
  // treat it as one: a reload fixes it, and Reset would throw away saved rooms,
  // tier lists and settings for nothing.
  static getDerivedStateFromError(error) {
    return { hasError: true, loadFailed: Boolean(error?.gameLoad) };
  }

  componentDidCatch(error, info) {
    console.error('AniArcade crashed:', error, info);
  }

  // Clears everything except the player's imported profiles — see
  // resetKeys.js for why the list is inverted rather than enumerating the
  // game keys, which is what left this clearing one stale name for three games.
  handleReset = () => {
    for (const key of keysToClear(storage.keys())) storage.removeItem(key);
    window.location.reload();
  };

  render() {
    if (this.state.loadFailed) {
      const { onBack } = this.props;
      return (
        <ErrorPanel icon="warning" tone="bg-pop-amber" title="Couldn't load this game">
          <p className="text-fg-body text-lg mb-8">
            Check your connection and reload. If the arcade was just updated, reloading picks
            up the new version.
          </p>
          <Button variant="primary" size="xl" fullWidth onClick={() => window.location.reload()} className="mb-4">
            Reload
          </Button>
          {onBack && (
            <Button variant="neutral" size="lg" fullWidth onClick={onBack}>
              Back to the hub
            </Button>
          )}
        </ErrorPanel>
      );
    }

    if (this.state.hasError) {
      const { onBack } = this.props;
      return (
        // No <Backdrop /> here: the boundary catches render crashes, so it has
        // to stay as close to plain markup as possible.
        <ErrorPanel icon="burst" tone="bg-pop-red" title="Something went wrong">
          <p className="text-fg-body text-lg mb-8">
            {onBack
              ? 'This game hit an unexpected error. The rest of the arcade is fine — head back to the menu, or reset if it keeps happening.'
              : 'AniArcade hit an unexpected error. Resetting your in-progress game usually fixes it.'}
          </p>
          {/* Leaving is offered first and styled as the primary action: it is
              the one that costs nothing. Reset discards every saved room, tier
              list and setting on the device, so it should not be the button
              someone hits on the way past. Profiles survive either way. */}
          {onBack && (
            <Button variant="primary" size="xl" fullWidth onClick={onBack} className="mb-4">
              Back to the hub
            </Button>
          )}
          <Button
            variant={onBack ? 'danger' : 'primary'}
            size="lg"
            fullWidth
            onClick={this.handleReset}
          >
            Reset Game &amp; Reload
          </Button>
          {onBack && (
            <p className="mt-4 text-sm text-fg-subtle">
              Reset clears saved rooms, tier lists and settings. Your profiles and
              imported lists are kept.
            </p>
          )}
        </ErrorPanel>
      );
    }
    return this.props.children;
  }
}
