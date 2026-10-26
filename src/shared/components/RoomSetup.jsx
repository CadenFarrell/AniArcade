import { useEffect, useState } from 'react';
import { useInvite } from '../context/inviteContext';
import { useProfileStore } from '../context/profileContext';
import ListImport from './ListImport';
import OnlineIdentityCard from './OnlineIdentityCard';
import ProfilePicker from './ProfilePicker';
import {
  Backdrop, Badge, Banner, Button, Card, Input, Screen, Wordmark,
} from '../ui';

// Create/join a room. One screen for every online game — they differ only in
// their accent and in which number they put on the identity card (AniGuess
// cares how many characters you have, AniTune how many shows), so those are
// props rather than two near-identical files.
//
//   tone  the game's accent, for the wordmark and the identity card
//   stat  (profile) => string, the one-line summary under the player's name.
//         OPTIONAL, and AniWave is why: it is the one game whose default mode
//         draws no cards, so no number about your list says anything about
//         whether you can play. Omitting it used to crash this screen on
//         `stat(profile)` before a single pixel of the online path rendered —
//         so the default is a function, not a bare guard at the call site,
//         because a required-by-accident prop is exactly what happened here.
//   game  the game's descriptor, for the menus' cover backdrop (Backdrop.jsx).
//         Not a stand-in for `tone`: AniGuess's online wordmark is purple, not
//         its pink. Optional; without it the page is the plain sheet.
//
// No name box: the hub already asked. This screen only ever wanted to know
// "who am I", and typing that answer fresh each time is what quietly created
// empty duplicate profiles. The profile itself is shared by every game.
export default function RoomSetup({ room, onBack, tone = 'purple', stat = () => null, game = null }) {
  const { activeProfile: profile, saveProfile, selectProfile } = useProfileStore();
  // An invite link's code (shared/utils/inviteLink.js), typed in for the player.
  const invite = useInvite();
  const inviteCode = invite?.code ?? null;
  const [codeInput, setCodeInput] = useState(() => inviteCode ?? '');
  const [showImport, setShowImport] = useState(false);
  // With an invite but no profile, the profile is the one thing between this
  // player and the room, so ask for it at once rather than leave them to find
  // the button.
  const [showPicker, setShowPicker] = useState(() => inviteCode != null && !profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      await room.createRoom(profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const joinCode = async (code) => {
    setBusy(true);
    setError('');
    try {
      await room.joinRoom(code, profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = () => {
    if (codeInput.trim()) joinCode(codeInput);
  };

  // An invite joins by itself, once there is somebody to join as. It waits for
  // `room.uid` because that is when useRoomCore has decided about a SAVED room:
  // restoring one sets the code in the same step, and a device already sitting
  // in a room stays there (leaving it brings this screen back, and the invite
  // with it). Consumed before the attempt, so a refused join — a full room, a
  // dead code — shows its error once instead of retrying on every render.
  useEffect(() => {
    if (!inviteCode || !profile || !room.uid || room.roomCode) return;
    invite.consume();
    joinCode(inviteCode);
    // joinCode is a fresh closure each render; the guards above are what keep
    // this to one attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, profile, room.uid, room.roomCode]);

  return (
    <>
      <Backdrop game={game} />
      <Screen onBack={onBack}>
        <Wordmark tone={tone} size="md" level={2} className="mb-8">
          Play Online
        </Wordmark>

        {/* Connection-level problems (sign-in failure, a saved room that
            vanished). Dismissible — the join form below still works. */}
        {room.error && (
          <Banner tone="danger" onDismiss={room.dismissError} className="mb-5">
            {room.error}
          </Banner>
        )}

        {!profile && (
          <Card className="mb-6 text-center">
            <p className="mb-4 text-fg-body">
              Set your main profile before joining a room — it&apos;s the name and anime
              list you bring to every online game.
            </p>
            <Button variant="primary" size="lg" fullWidth onClick={() => setShowPicker(true)}>
              Choose profile
            </Button>
          </Card>
        )}

        {profile && (
          <div>
            <OnlineIdentityCard
              profile={profile}
              stat={stat(profile)}
              tone={tone}
              onSwitch={() => { setShowPicker(true); setError(''); }}
              onImport={() => setShowImport(true)}
            />

            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

            <Button
              variant="success"
              size="lg"
              fullWidth
              className="mb-4"
              onClick={handleCreate}
              disabled={busy}
            >
              {busy ? 'Creating…' : 'Create Room'}
            </Button>

            <div className="flex gap-3">
              <Input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && codeInput.trim() && handleJoin()}
                placeholder="Room code"
                maxLength={5}
                aria-label="Room code"
                className="flex-1 text-center text-lg font-display font-extrabold tracking-widest"
              />
              <Button
                variant="secondary"
                size="lg"
                onClick={handleJoin}
                disabled={busy || !codeInput.trim()}
              >
                Join
              </Button>
            </div>
          </div>
        )}

        {room.roomCode && (
          <p className="mt-6 text-center text-fg-body">
            Room code:{' '}
            <Badge tone="lime" className="ml-1 text-lg tracking-widest">{room.roomCode}</Badge>
          </p>
        )}

        {showPicker && (
          <ProfilePicker
            onClose={() => setShowPicker(false)}
            // No ListManager route from inside a game — the import dialog is
            // the one that matters here, and it is already wired up below.
            // Select first: the row whose pencil you tapped is not necessarily the
            // active one, and importing into someone else's profile is worse
            // than useless.
            onEditList={(id) => { selectProfile(id); setShowPicker(false); setShowImport(true); }}
          />
        )}

        {showImport && profile && (
          <ListImport
            profile={profile}
            onClose={() => setShowImport(false)}
            onImported={(merged) => {
              saveProfile(merged);
              setShowImport(false);
            }}
          />
        )}
      </Screen>
    </>
  );
}
