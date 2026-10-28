import { useState } from 'react';
import { useInvite } from '../context/inviteContext';
import { useProfileStore } from '../context/profileContext';
import { buildInviteUrl } from '../utils/inviteLink';
import ListImport from './ListImport';
import { canRefreshList } from '../services/listSources';
import { PlayerSlot, PlayerSlots } from './PlayerSlots';
import PortraitPicker from './PortraitPicker';
import { Badge, Button, Card, Icon } from '../ui';

// The parts every online lobby draws identically: the code to share, the live
// roster, the list import, and the guest's wait card. Each game's OnlineLobby
// still owns its wordmark, its settings, its Start gates and its Start button,
// because those are the parts that genuinely differ.
//
// These were six hand-copied blocks before, and they had already drifted: two
// lobbies dropped the 🔌 and greyed "Left" while four painted it red, and only
// two truncated a long name. A copy that drifts is a change somebody made in
// one place believing it was the only place.

/**
 * The room code, as the one thing on screen a joiner has to read aloud. A paper
 * chip, because it sits in the game-ink banner (SetupLayout's `aside`): paper on
 * ink is the loudest pairing the page has, which is right for the code.
 */
export function RoomCode({ code }) {
  return (
    <div className="text-left sm:text-right">
      {/* Full paper: at 11px, 80% paper on the game ink missed 4.5:1. */}
      <p className="mb-1 font-display text-[11px] font-bold uppercase tracking-[0.25em]">Room code</p>
      <span
        className="inline-block border-2 border-ink bg-surface px-4 py-1.5 font-display text-3xl font-bold
          tracking-[0.3em] text-fg-strong shadow-pop-sm"
      >
        {code}
      </span>
      <ShareInvite code={code} />
    </div>
  );
}

/**
 * The code as a link (shared/utils/inviteLink.js): tapping it opens this game and joins
 * this room, no typing. The phone's own share sheet where there is one — that
 * is where the group chat is — and the clipboard everywhere else.
 *
 * Renders nothing without the hub's InviteContext (a game mounted alone has no
 * game id to build a link to) or with neither way to hand a link on.
 */
function ShareInvite({ code }) {
  const invite = useInvite();
  const [note, setNote] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
  if (!invite?.gameId || (!canShare && !canCopy)) return null;

  const share = async () => {
    const url = buildInviteUrl(window.location.href, invite.gameId, code);
    if (canShare) {
      try {
        await navigator.share({ title: 'Join my AniArcade room', text: `Room ${code}`, url });
        return;
      } catch (e) {
        // Closing the sheet is a choice, not a failure. Anything else falls
        // through to the clipboard.
        if (e?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote('Link copied');
    } catch {
      setNote('Could not copy — share the code instead');
    }
  };

  return (
    <div className="mt-2 flex flex-col items-start gap-1 sm:items-end">
      <Button variant="secondary" size="sm" onClick={share}>
        <Icon name="link" /> Share invite
      </Button>
      {/* Announced, because the press changes nothing else on screen. Full
          paper, the code label's reason. */}
      <p role="status" className="min-h-4 text-xs font-bold">{note}</p>
    </div>
  );
}

// The game's own accent for the "You" badge, so a lobby's colour carries into
// the roster. Badge tones are the accent names, so this is the identity map —
// kept explicit so an accent Badge does not know about falls back visibly.
const YOU_BADGE = {
  amber: 'amber',
  blue: 'blue',
  lime: 'lime',
  pink: 'pink',
  purple: 'purple',
  teal: 'teal',
  red: 'red',
  plum: 'plum',
  slate: 'slate',
  moss: 'moss',
};

/**
 * Everyone who ever joined, as character-select slots (PlayerSlots.jsx), with
 * the departed greyed rather than dropped — a slot vanishing reads as a bug,
 * and the host needs to see who left.
 *
 * `badgeFor(player)` is the game's own badge (shows, characters) and only
 * renders for a player who is fully here: a reconnecting slot already carries a
 * badge, and a list count on somebody who left is a warning nobody can act on.
 * Omit it where nothing reads a list — AniTag, and AniWave's typed-clue mode —
 * because a "No list" badge there is a warning about nothing.
 *
 * The count and the waiting note use the ACTIVE roster, for the reason every
 * Start gate does: a ghost left by a closed tab must not make the room look
 * ready.
 *
 * Your own slot's face opens the character picker; nobody else's does, since a
 * phone can only save its own profile. The choice is saved into the PROFILE,
 * for LobbyImport's reason below, and useRepublishProfile carries it up.
 * Gated on the seat being the active profile's, the same check the republish
 * makes — a choice saved to some other profile would never reach this room.
 */
export function PlayerRoster({ room, players, active, statuses, tone, badgeFor, minPlayers = 2 }) {
  const { activeProfile, saveProfile } = useProfileStore();
  const [choosing, setChoosing] = useState(false);
  const canChoose = !!activeProfile && activeProfile.id === room.myPlayerId;
  return (
    <>
      <PlayerSlots
        count={active.length}
        players={players}
        footer={active.length < minPlayers && (
          <p className="mt-3 text-sm text-fg-subtle">
            Waiting for more players to join
            {minPlayers > 2 ? ` — this game needs ${minPlayers}.` : '…'}
          </p>
        )}
      >
        {players.map((p) => {
          const status = statuses[p.id] ?? 'active';
          const here = status === 'active' || status === 'dropping';
          return (
            <PlayerSlot
              key={p.id}
              player={p}
              dim={!here}
              onChooseFace={p.id === room.myPlayerId && canChoose ? () => setChoosing(true) : undefined}
              corner={p.id === room.hostId && (
                <span className="grid h-9 w-9 place-items-center border-2 border-ink bg-surface text-lg text-pop-amber">
                  <Icon name="crown" label="Host" />
                </span>
              )}
              badges={(
                <>
                  {p.id === room.myPlayerId && <Badge tone={YOU_BADGE[tone] ?? 'purple'}>You</Badge>}
                  {status === 'dropping' && <Badge tone="amber">Reconnecting…</Badge>}
                  {/* Neutral, not red: red means wrong, and leaving a lobby is not. */}
                  {!here && <Badge tone="neutral">Left</Badge>}
                  {status === 'active' && badgeFor?.(p)}
                </>
              )}
            />
          );
        })}
      </PlayerSlots>
      {choosing && canChoose && (
        <PortraitPicker profile={activeProfile} onClose={() => setChoosing(false)} onSave={saveProfile} />
      )}
    </>
  );
}

/** The lime "N shows" / amber "No list" badge most lobbies hang on a row. */
export function ListBadge({ count, unit = 'shows', empty = 'No list' }) {
  return (
    <Badge tone={count > 0 ? 'lime' : 'amber'}>
      {count > 0 ? `${count} ${unit}` : empty}
    </Badge>
  );
}

/**
 * Import and refresh, kept in the lobby even though the hub can import too:
 * the lobby is where you find out you have a problem — the "No list" badge and
 * the Start gates both render on this screen.
 *
 * Imports into the PROFILE, never into the room's copy of you. That copy is a
 * join-time snapshot that has been through RTDB, and merging out of it would
 * roll back any hub-side edit made since and drop the
 * anilistImportedIds/anilistImportSettings the checklist reads.
 * useRepublishProfile is what carries the result up to the room.
 */
export function LobbyImport() {
  const { activeProfile, saveProfile } = useProfileStore();
  // null | 'pick' | 'refresh' — the same shape ListManager uses, so the
  // one-tap refresh path behaves identically wherever you reach it from.
  const [importMode, setImportMode] = useState(null);

  return (
    <>
      <div className="mb-6 flex gap-3">
        <Button
          variant="neutral"
          size="md"
          fullWidth
          onClick={() => setImportMode('pick')}
          disabled={!activeProfile}
        >
          Import my list
        </Button>
        {canRefreshList(activeProfile) && (
          <Button
            variant="neutral"
            size="md"
            className="flex-shrink-0 whitespace-nowrap"
            onClick={() => setImportMode('refresh')}
          >
            Refresh
          </Button>
        )}
      </div>

      {importMode && activeProfile && (
        <ListImport
          profile={activeProfile}
          autoRefresh={importMode === 'refresh'}
          onClose={() => setImportMode(null)}
          onImported={(merged) => {
            saveProfile(merged);
            setImportMode(null);
          }}
        />
      )}
    </>
  );
}

/**
 * What a guest sees in place of the settings. Only the host picks the settings
 * and starts the game; the settings were per-device once, which read as a
 * free-for-all — whoever hit Start first silently imposed their choices on the
 * whole table.
 *
 * `needsList` adds the nudge to import, and only where the lobby offers an
 * import: telling somebody to use a button that is not on the screen is worse
 * than saying nothing.
 */
export function HostWaitCard({ hostName, needsList = false }) {
  return (
    <Card padding="lg" className="mb-6 text-center">
      <div className="mb-2 text-4xl text-pop-amber"><Icon name="crown" /></div>
      <p className="font-display text-lg font-extrabold text-fg-strong">
        {hostName ? `${hostName} is the host` : 'Waiting for the host'}
      </p>
      <p className="mt-1 text-fg-helper">
        The host picks the settings and starts the game.
        {needsList && <> Import your list above so you&apos;re ready.</>}
      </p>
    </Card>
  );
}
