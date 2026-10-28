import { useEffect, useRef, useState } from 'react';
import { useInvite } from '../context/inviteContext';
import { playSound } from '../services/sound';
import { accentBg } from '../ui/accents';
import { splitTitle } from '../utils/splitTitle';
import { Banner, Button, Card } from '../ui';
import WaitingScreen from './WaitingScreen';

// Next game, same table (shared/utils/handoff.js): the two screens of it that
// live in the room the table is leaving. Both read `room.handoff`, which every
// game's room hook passes through from useRoomCore.

// How long a follower waits on the host's new room before being offered a way
// back. Creating one is a handful of writes, so this is long past a slow
// phone: past it the host's device has most likely gone.
export const FOLLOW_PATIENCE_MS = 20000;

/**
 * The panel under a room's final results. The host gets a button per game,
 * each in that game's ink with the hub tile's split title, so it reads as the
 * board; everyone else gets the line saying who decides. Pressing one writes
 * the pick into this room and then leaves it for the new game, whose
 * RoomSetup makes the room.
 */
export function NextGamePicker({ room }) {
  const invite = useInvite();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const choices = invite?.nextGames ?? [];
  // No hub around the game (a component test) or nothing else to play.
  if (!invite?.follow || !room.handoff || choices.length === 0) return null;

  if (!room.isHost) {
    return (
      <Card title="Next game" className="mb-6">
        <p className="text-fg-body">Waiting for the host to pick the next game.</p>
      </Card>
    );
  }

  const pick = async (game) => {
    setBusy(game.id);
    setError('');
    try {
      await room.handoff.start(game.id);
    } catch (e) {
      setError(e?.message || 'Could not reach the room. Check your connection and try again.');
      setBusy(null);
      return;
    }
    playSound('select');
    invite.follow({ gameId: game.id, from: room.roomCode, leave: room.leaveRoom });
  };

  return (
    <Card title="Next game" className="mb-6">
      <p className="mb-4 text-sm text-fg-body">
        Pick another game and everyone here moves with you. No new code to share.
      </p>
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {choices.map((game) => {
          const title = splitTitle(game.title);
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => pick(game)}
              disabled={busy != null}
              // Named in words, for the playtest bots and a screen reader alike;
              // the split title is drawn for eyes only, as on the hub's tiles.
              aria-label={`Play ${game.title} next`}
              className={`btn-pop focus-pop flex min-h-16 flex-col justify-center border-ink px-3 py-2 text-left
                uppercase leading-none text-paper disabled:opacity-60 ${accentBg(game.accent)}`}
            >
              <span aria-hidden="true">
                {title.prefix && <span className="block text-[11px] tracking-[0.3em]">{title.prefix}</span>}
                <span className="block text-xl tracking-wide">
                  {busy === game.id ? 'Opening…' : title.word}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * What everyone but the host sees once a pick is in: a wait while the new room
 * is made, then — the moment its code lands — this device leaves the room and
 * the hub opens the new game, which joins by itself (the invite path). It
 * replaces whatever screen the room was on, so a follower cannot start
 * anything in a room the table is leaving.
 */
export function FollowScreen({ room, next }) {
  const invite = useInvite();
  const game = invite?.nextGames?.find((g) => g.id === next.gameId) ?? null;
  const [patient, setPatient] = useState(true);

  // Once per code: the follow swaps this whole game out, but a re-render in
  // between must not leave the room twice.
  const followed = useRef(null);
  useEffect(() => {
    if (!next.code || !invite?.follow || followed.current === next.code) return;
    followed.current = next.code;
    // Refused (and nothing left) for a game this build lacks, which is the
    // "Update needed" screen below.
    invite.follow({ gameId: next.gameId, code: next.code, leave: room.leaveRoom });
  }, [next.code, next.gameId, invite, room.leaveRoom]);

  useEffect(() => {
    if (next.code) return undefined;
    const id = setTimeout(() => setPatient(false), FOLLOW_PATIENCE_MS);
    return () => clearTimeout(id);
  }, [next.code]);

  const who = next.byName || 'The host';
  // A pick this build has never heard of: the host is on a newer one.
  if (invite && !game) {
    return (
      <WaitingScreen
        icon="warning"
        title="Update needed"
        subtitle={`${who} picked a game this device does not have yet. Reload the page to update, then join with the code ${next.code ?? 'they share'}.`}
      />
    );
  }

  return (
    <WaitingScreen
      title={`On to ${game?.title ?? 'the next game'}`}
      subtitle={`${who} is opening the room. You'll join it by yourself.`}
    >
      {!patient && !next.code && (
        // Anyone may take the pick back out: a host whose phone died after
        // pressing it would otherwise hold the whole table on this screen.
        <Button variant="secondary" fullWidth onClick={() => room.handoff.cancel(room.roomCode).catch(() => {})}>
          Back to the results
        </Button>
      )}
    </WaitingScreen>
  );
}
