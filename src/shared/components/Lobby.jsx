import { useState } from 'react';
import { useProfileStore } from '../context/profileContext';
import AniListImport from './AniListImport';
import { Badge, Button, Card, CardRow } from '../ui';

// The parts every online lobby draws identically: the code to share, the live
// roster, the list import, and the guest's wait card. Each game's OnlineLobby
// still owns its wordmark, its settings, its Start gates and its Start button,
// because those are the parts that genuinely differ.
//
// These were six hand-copied blocks before, and they had already drifted: two
// lobbies dropped the 🔌 and greyed "Left" while four painted it red, and only
// two truncated a long name. A copy that drifts is a change somebody made in
// one place believing it was the only place.

/** The room code, as the one thing on screen a joiner has to read aloud. */
export function RoomCode({ code }) {
  return (
    <div className="mb-8 text-center">
      <p className="mb-3 text-fg-helper">Share this code with the other players:</p>
      <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl tracking-[0.3em] text-ink">
        {code}
      </span>
    </div>
  );
}

// Literal class names rather than `text-pop-${tone}`: Tailwind only emits a
// utility it can find spelled out in the source.
const YOU_TONE = {
  amber: 'text-pop-amber',
  blue: 'text-pop-blue',
  lime: 'text-pop-lime',
  pink: 'text-pop-pink',
  purple: 'text-pop-purple',
  teal: 'text-pop-teal',
  red: 'text-pop-red',
};

/**
 * Everyone who ever joined, with the departed greyed rather than dropped — a
 * row vanishing reads as a bug, and the host needs to see who left.
 *
 * `badgeFor(player)` is the game's own row badge (shows, characters) and only
 * renders for a player who is fully here: a reconnecting row already carries a
 * badge, and a list count on somebody who left is a warning nobody can act on.
 * Omit it where nothing reads a list — AniTag, and AniWave's typed-clue mode —
 * because a "No list" badge there is a warning about nothing.
 *
 * The count and the waiting note use the ACTIVE roster, for the reason every
 * Start gate does: a ghost left by a closed tab must not make the room look
 * ready.
 */
export function PlayerRoster({ room, players, active, statuses, tone, badgeFor, minPlayers = 2 }) {
  return (
    <Card title={`Players (${active.length})`} padding="lg" className="mb-6">
      {players.map((p) => {
        const status = statuses[p.id] ?? 'active';
        const here = status === 'active' || status === 'dropping';
        return (
          <CardRow key={p.id} className={here ? '' : 'opacity-40'}>
            <span className="min-w-0 flex-1 truncate text-white">
              {p.id === room.hostId && <span title="Host">👑 </span>}
              {p.name}{' '}
              {p.id === room.myPlayerId && <span className={YOU_TONE[tone]}>(you)</span>}
            </span>
            {status === 'dropping' && <Badge tone="amber">🔌 Reconnecting…</Badge>}
            {/* Neutral, not red: red means wrong, and leaving a lobby is not. */}
            {!here && <Badge tone="neutral">Left</Badge>}
            {status === 'active' && badgeFor?.(p)}
          </CardRow>
        );
      })}
      {active.length < minPlayers && (
        <p className="mt-3 text-sm text-fg-subtle">
          Waiting for more players to join
          {minPlayers > 2 ? ` — this game needs ${minPlayers}.` : '…'}
        </p>
      )}
    </Card>
  );
}

/** The lime "N shows" / amber "No list" badge most lobbies hang on a row. */
export function ListBadge({ count, unit = 'shows', empty = '⚠️ No list' }) {
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
          🔗 Import my list from AniList
        </Button>
        {activeProfile?.anilistUsername && (
          <Button
            variant="neutral"
            size="md"
            className="flex-shrink-0 whitespace-nowrap"
            onClick={() => setImportMode('refresh')}
          >
            🔄 Refresh
          </Button>
        )}
      </div>

      {importMode && activeProfile && (
        <AniListImport
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
      <div className="mb-2 text-4xl">👑</div>
      <p className="font-display text-lg font-extrabold text-white">
        {hostName ? `${hostName} is the host` : 'Waiting for the host'}
      </p>
      <p className="mt-1 text-fg-helper">
        The host picks the settings and starts the game.
        {needsList && <> Import your list above so you&apos;re ready.</>}
      </p>
    </Card>
  );
}
