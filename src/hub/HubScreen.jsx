import { Suspense, useEffect, useMemo, useState } from 'react';
import { games } from './registry';
import CreditsModal from './CreditsModal';
import GameLoading from './GameLoading';
import { readInvite, stripInvite } from '../shared/utils/inviteLink';
import PanelWipe from './PanelWipe';
import RecordScreen from './RecordScreen';
import RecordStrip from './RecordStrip';
import TitleScreen from './TitleScreen';
import { drawTileCharacters } from './tileCharacters';
import { splitTitle } from '../shared/utils/splitTitle';
import { useUniformCaptions } from './useUniformCaptions';
import { markTitleSeen, readTitleSeen } from './titleSeen';
import { useWipe } from './useWipe';
import ErrorBoundary from '../shared/components/ErrorBoundary';
import ListManager from '../shared/components/ListManager';
import ProfileButton from '../shared/components/ProfileButton';
import ProfilePicker from '../shared/components/ProfilePicker';
import TopBar from '../shared/components/TopBar';
import { useProfileStore } from '../shared/context/profileContext';
import { InviteContext } from '../shared/context/inviteContext';
import { TileCharacterContext } from '../shared/context/tileCharacterContext';
import { useWakeLock } from '../shared/hooks/useWakeLock';
import { playSound } from '../shared/services/sound';
import { preloadGames } from '../shared/utils/lazyGame';
import { Backdrop, Badge, GhostButton, HubButton, Kana, Screen } from '../shared/ui';
import { accentBg } from '../shared/ui/accents';
import { ART } from '../shared/ui/credits';
import { KANA } from '../shared/ui/kanaText';

// Each game's ink (shared/ui/accents.js), as the solid title bar under its picture. It was a thin
// stripe for a while (and before that the whole marquee, which on paper made
// seven solid colour blocks in a row — a paint chart, not a manga page). The
// stripe was too quiet: every title starts "Ani", every panel is a greyscale
// face, and once the caption box grew over it nothing on the tile said which
// game it was at a glance. A bar under the art is colour where it sorts, and
// the art above stays greyscale. The same ink also sits behind the portrait,
// which is multiplied over it — on hover the picture's light tones take the
// game's colour while its darks stay ink, the hero's sun-disc trick.

// One game on the menu — a manga panel, not a list row. Built on `btn-pop`
// directly rather than <Button>: it needs a full-bleed panel over a two-part
// body, which the plain label-in-a-block Button API does not cover.
const GAME_IDS = games.map((g) => g.id);

// `captioned` is the BOARD's answer, not this tile's: the caption hangs half
// into the tile body, so a tile with one pushes its title down — and if only
// some tiles did, a small list would leave the titles in a row at two heights.
function GameCard({ game, character, captioned, onPick }) {
  const ink = accentBg(game.accent);
  // A portrait URL that fails (a dead link in an old import, the CDN down)
  // falls back to the bare panel rather than a broken-image box. Remembered by
  // URL, so the next draw's character gets its own chance.
  const [broken, setBroken] = useState(null);
  const shown = character && character.imageUrl !== broken ? character : null;
  const title = splitTitle(game.title);

  return (
    <button
      onClick={() => onPick(game.id)}
      disabled={!game.available}
      // p-0 because the panel bleeds to the tile's edge, and overflow-hidden is
      // what clips it back to rounded-pop. That clips descendants only, so
      // focus-pop's ring and btn-pop's shadow — both on this element — survive.
      className={`btn-pop focus-pop group flex flex-col overflow-hidden bg-surface p-0 text-left
        ${game.available ? 'border-ink' : 'border-line-strong'}`}
    >
      {/* The panel: a character from YOUR list (tileCharacters.js), drawn
          fresh each visit, so no two players' boards look alike. Greyscale
          and multiplied over the panel, so seven different studios' art sits
          together as one page of screentone and its darks stay ink.
          Greyscale + faded still marks a game as unavailable, which the
          portrait already is, so that costs nothing. No profile, or a list
          too small to fill the board, leaves a bare speed-lines panel — never
          a stand-in picture, never the same face twice.

          Square, not 4:3: AniList portraits are 2:3, so a wide panel could only
          ever show a face cut off at the chin. Square shows head and shoulders
          and still keeps the board above a laptop's fold. */}
      <span className="relative w-full">
        <span
          aria-hidden="true"
          className={`relative isolate block aspect-square w-full overflow-hidden border-b-2 border-ink
            bg-surface-2 ${game.available ? '' : 'grayscale opacity-50'}`}
        >
          <span
            className={`absolute inset-0 opacity-0 transition-opacity duration-200
              group-hover:opacity-35 group-focus-visible:opacity-35 ${ink}`}
          />
          {shown ? (
            <img
              src={shown.imageUrl}
              alt=""
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setBroken(shown.imageUrl)}
              // A 2:3 portrait in a square shows its top two thirds, framed a
              // little below the top edge so the hair is not cut. No lazy
              // loading: the board is the first thing the hub paints and
              // these are its pictures.
              className="absolute inset-0 h-full w-full object-cover object-[50%_15%] grayscale contrast-125
                mix-blend-multiply"
            />
          ) : (
            <span className="speed-lines absolute inset-0 opacity-20" />
          )}
        </span>

        {/* The pointer half of the blurb — see blurb-overlay in index.css.
            A sibling of the panel rather than a child of it, because the panel
            is aria-hidden and nesting the text inside would drop it out of the
            button's accessible name.

            Ink with paper type: a caption box laid over the panel, and the one
            pairing that reads over every game's art. */}
        {game.available && (
          <span
            className="blurb-overlay absolute inset-0 flex items-center justify-center
              bg-ink/92 px-2.5 py-1.5 font-sans text-xs font-normal normal-case leading-4
              tracking-normal text-paper
              group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {game.blurb}
          </span>
        )}

        {/* Who it is and where from: a manga narration box, paper with an ink
            rule, hung across the panel's bottom edge — half on the picture,
            half on the tile body — so it covers shoulders at most, never a
            face.
            It steps aside while the blurb is up. Decoration like the panel it
            labels, hence aria-hidden: the tile's name is the game. btn-pop sets
            everything in display caps, so the show line opts back out.

            Names WRAP, never truncate — "More Than a Married Couple, But Not
            Lovers" on a 136px tile was an ellipsis players could not read past.
            So the box's foot is pinned a fixed distance into the body (the
            translate below, matched by the bar's pt-6) and a long name grows
            it UPWARD over the picture's lower part, never down into the game
            title. overflow-wrap:anywhere breaks a single word too long for the
            line rather than letting it run out of the box. */}
        {shown && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 bottom-0 left-1.5 z-10 translate-y-[1.125rem]
              border border-ink bg-surface px-1.5 py-0.5 text-left [overflow-wrap:anywhere]
              transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0"
          >
            {/* Full tile width and the board's shared height (useUniformCaptions),
                so every box on the board is the same size whatever it holds. */}
            <span data-caption-body="" className="block min-h-[var(--caption-h,0px)]">
              <span className="block font-display text-[10px] font-bold uppercase leading-tight tracking-wide text-fg-strong">
                {shown.name}
              </span>
              {shown.show && (
                <span className="block font-sans text-[9px] font-normal normal-case leading-tight tracking-normal text-fg-helper">
                  {shown.show}
                </span>
              )}
            </span>
          </span>
        )}
      </span>

      {/* The title bar: solid game ink with paper type, the accent contract's
          fill-plus-paper pairing (see Styling in the root CLAUDE.md). A game not
          yet available keeps the plain surface, so colour still means "ready". */}
      <span
        className={`flex w-full flex-1 flex-col px-2.5 pb-2.5 ${captioned ? 'pt-6' : 'pt-2'}
          ${game.available ? `${ink} text-paper` : 'bg-surface-2 text-fg-subtle'}`}
      >
        {/* The split title is drawn for eyes only; the button is named by the
            whole word, so a screen reader hears "AniGuess", not "Ani, Guess". */}
        <span className="sr-only">{game.title}</span>
        <span aria-hidden="true" className="font-display font-bold uppercase leading-none">
          {/* Full paper, not dimmed: at 11px an opacity-80 prefix fell under
              4.5:1 on the lighter inks (axe, in the playtest's browser layer).
              Size and tracking already make it the quiet half of the title. */}
          {title.prefix && (
            <span className="block text-[11px] tracking-[0.3em]">{title.prefix}</span>
          )}
          <span className="block text-2xl tracking-wide">{title.word}</span>
        </span>
        {/* The touch half of the blurb — see blurb-inline in index.css. No
            reserved height: on a pointer this node is not displayed at all, so
            the tile is shorter there and the overlay above does the work.
            btn-pop makes everything inside display-bold, so body copy has to
            opt back out. */}
        {game.available ? (
          <span
            className="blurb-inline mt-1 line-clamp-2 font-sans text-xs font-normal
              normal-case leading-4 tracking-normal text-paper"
          >
            {game.blurb}
          </span>
        ) : (
          <span className="mt-1.5">
            <Badge className="hatch [--hatch:var(--color-line)]">Soon</Badge>
          </span>
        )}
      </span>
    </button>
  );
}

// The banner over the board: a panel cut on the diagonal, Kuniyoshi's rooftop
// battle printed into it over a vermilion sun, and the page's one h1. Height-
// capped so the board still sits above a laptop's fold — the hub's height is
// spent on games, and this is the masthead, not the content.
function Hero() {
  const print = ART.rooftop;
  return (
    <section
      className="relative isolate mb-6 h-36 overflow-hidden border-2 border-ink bg-surface
        sm:mb-8 sm:h-44 [clip-path:polygon(0_0,100%_0,100%_82%,96%_100%,0_100%)]"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 right-[14%] aspect-square h-[150%] -translate-y-1/2 rounded-full bg-pop-pink" />
        <img
          src={print.src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[55%_40%] mix-blend-multiply"
        />
        <div
          className="absolute inset-y-0 left-0 w-[78%] bg-surface sm:w-[52%]
            [clip-path:polygon(0_0,100%_0,80%_100%,0_100%)]"
        />
      </div>
      <div className="flex h-full flex-col justify-center px-5 sm:px-7">
        <Kana className="text-sm text-pop-pink">{KANA.pickGame}</Kana>
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-fg-strong sm:text-5xl">
          Pick a game
        </h1>
        {/* 12rem on a phone: the paper slab narrows to its diagonal at the
            foot, and at 15rem the line ran under the print. */}
        <p className="mt-2 max-w-[12rem] text-sm text-fg-body sm:max-w-xs">
          Party games built from your anime list.
        </p>
      </div>
    </section>
  );
}

// Top-level menu. Picks a game from the registry and hands it the whole screen;
// each game gets an onExit callback to come back here. Also the arcade's only
// frame: the title screen in front of it, the top bar around everything after,
// and the wipe between them.
export default function HubScreen() {
  // An invite link (shared/utils/inviteLink.js) opens its game straight away: no title
  // screen, no menu — the person tapping a link in a group chat wants the
  // room, and the code is already in hand. Read once, here; the effect below
  // takes it off the address bar.
  const [invite, setInvite] = useState(() => readInvite(window.location.search, GAME_IDS));
  const [titleSeen, setTitleSeen] = useState(() => invite != null || readTitleSeen());
  // gameId, not activeId — `activeId` in a profile-aware file means the main
  // profile everywhere else, and two different "active"s in one component is
  // how you end up passing the wrong one.
  const [gameId, setGameId] = useState(() => invite?.gameId ?? null);
  const [showPicker, setShowPicker] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  // Which profile's anime list is open, or null for the menu. ListManager is a
  // full-height page rather than a dialog, so it gets its own hub view instead
  // of living inside ProfilePicker.
  const [editingListId, setEditingListId] = useState(null);
  // Whose play record is open, and which way back leads: { id, from } where
  // `from` is 'hub' (the record strip) or 'picker' (a row's trophy). Null for
  // the menu. A full view for ListManager's reason.
  const [recordOf, setRecordOf] = useState(null);
  const { profiles, activeProfile, saveProfile } = useProfileStore();
  const { wipe, wipeId } = useWipe();

  // The tile characters: drawn once per visit to the menu, and again whenever
  // the main profile changes (a switch, an import, an edit). Held in state
  // rather than derived in render, so a re-render — a hover, the picker
  // opening — never reshuffles the board under the pointer. The profile check
  // is React's "adjust state while rendering" pattern, not an effect, so the
  // new board paints in the same frame as the new profile.
  const [tiles, setTiles] = useState(() => drawTileCharacters(activeProfile, GAME_IDS));
  const [tilesFor, setTilesFor] = useState(activeProfile);
  if (tilesFor !== activeProfile) {
    setTilesFor(activeProfile);
    setTiles(drawTileCharacters(activeProfile, GAME_IDS));
  }
  const captioned = Object.values(tiles).some(Boolean);
  const boardRef = useUniformCaptions([tiles]);

  // Every game's code, fetched once the menu is up and the browser is idle, so a
  // tap almost never waits on a download. See shared/utils/lazyGame.js. Once per
  // visit: HubScreen stays mounted under every game, and each preload is
  // memoized anyway. Started behind the title screen too — that screen is
  // exactly the idle time this wants.
  useEffect(() => preloadGames(games), []);

  // Off the address bar once read, so a refresh mid-game does not join the room
  // a second time. replaceState, not a navigation: nothing reloads. Skipping
  // the title is remembered too, so that refresh lands on the hub as any other
  // would. `invite` is the first render's on purpose: this runs once.
  useEffect(() => {
    const stripped = stripInvite(window.location.href);
    if (stripped) window.history.replaceState(window.history.state, '', stripped);
    if (titleSeen) markTitleSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openGame = (id) => {
    playSound('select');
    wipe(() => setGameId(id));
  };
  const backToMenu = () => wipe(() => {
    setGameId(null);
    setInvite(null);
    setTiles(drawTileCharacters(activeProfile, GAME_IDS));
  });

  const active = games.find((g) => g.id === gameId);
  // The screen stays on while a game is open: one call here covers every game,
  // local and online. See useWakeLock.js for why a dimmed phone is a dropped
  // player, not just a dark screen.
  useWakeLock(Boolean(active));
  // See shared/context/inviteContext.js. Provided for every open game, invite
  // or not, because the lobby's Share button needs the game's id either way.
  const inviteValue = useMemo(() => (active ? {
    gameId: active.id,
    code: invite?.gameId === active.id ? invite.code : null,
    routed: invite?.routed ?? false,
    markRouted: () => setInvite((i) => (i ? { ...i, routed: true } : i)),
    consume: () => setInvite(null),
  } : null), [active, invite]);
  let content;

  if (!titleSeen) {
    content = (
      <TitleScreen
        onStart={() => wipe(() => {
          markTitleSeen();
          setTitleSeen(true);
        })}
      />
    );
  } else if (active) {
    const Game = active.Component;
    // Its own boundary, so a render crash inside one game costs that game
    // rather than the arcade. Without it the root boundary caught everything
    // and the only way out was a reload — which meant any bug in the newest
    // game read to a player as the whole app being broken.
    //
    // Keyed by game id so the caught state cannot outlive the game that
    // produced it; going back to the menu unmounts the boundary anyway, and
    // the key makes that true even if this branch is ever reused.
    content = (
      <TopBar title={active.title} kana={active.kana}>
        <ErrorBoundary key={active.id} onBack={backToMenu}>
          {/* Inside the boundary, so a game whose code never arrives lands on the
              boundary's reload screen rather than taking down the arcade. */}
          <Suspense fallback={<GameLoading title={active.title} kana={active.kana} accent={active.accent} />}>
            {/* The tapped tile's character, for the game's cover page. */}
            <TileCharacterContext.Provider value={tiles[active.id] ?? null}>
              <InviteContext.Provider value={inviteValue}>
                <Game onExit={backToMenu} />
              </InviteContext.Provider>
            </TileCharacterContext.Provider>
          </Suspense>
        </ErrorBoundary>
      </TopBar>
    );
  } else if (recordOf && profiles[recordOf.id]) {
    const fromPicker = recordOf.from === 'picker';
    content = (
      <TopBar>
        <Backdrop />
        <HubButton onClick={() => setRecordOf(null)} />
        <RecordScreen
          key={recordOf.id}
          profile={profiles[recordOf.id]}
          games={games}
          backLabel={fromPicker ? '← Profiles' : '← Hub'}
          onBack={() => { setRecordOf(null); if (fromPicker) setShowPicker(true); }}
        />
      </TopBar>
    );
  } else if (editingListId) {
    content = (
      <TopBar>
        <Backdrop />
        {/* The same bar control every in-game screen uses. "Hub" is literal
            here — this view IS inside the hub, so leaving it lands on the menu. */}
        <HubButton onClick={() => setEditingListId(null)} />
        {/* The stepping half beside it: Hub leaves the flow, this goes back one
            step to the picker whose pencil was pressed. No `origin` state like
            AniGuess's — the hub has exactly one route in, so back is always the
            picker. Own column (matching ListManager's) so it lines up with the
            heading below, and it carries the pt-20 that clears the top bar. */}
        <div className="mx-auto max-w-2xl px-5 pt-20 sm:px-6">
          <GhostButton onClick={() => { setEditingListId(null); setShowPicker(true); }}>
            ← Profiles
          </GhostButton>
        </div>
        <ListManager
          key={editingListId}
          profile={profiles[editingListId] ?? null}
          onProfileUpdated={saveProfile}
          // The row above clears the bar, so this only needs the gap.
          className="pt-4"
        />
      </TopBar>
    );
  } else {
    content = (
      <TopBar end={<ProfileButton profile={activeProfile} onOpen={() => setShowPicker(true)} />}>
        <Backdrop />
        <Screen center width="lg">
          <Hero />

          {/* The only thing left of the old full-width profile card. It points at
              the bar once and then never appears again. */}
          {!activeProfile && (
            <p className="mb-5 text-sm text-fg-body">
              No profile yet — press <span className="font-bold">Set profile</span> up top to bring
              your anime list.
            </p>
          )}

          {/* The board. Up to six across, so the roster reads at a glance instead
              of running off the bottom — a stacked column was already scrolling at
              six games and the registry is still growing. lg: is the app's first,
              deliberately: sm: and lg: are the two widths where another column
              earns its keep.

              The ladder is picked so the tile stays roughly 136–155px at every
              breakpoint instead of ballooning on desktop, which is also why
              AniList's 230px "large" portraits are sharp enough for it. */}
          <div ref={boardRef} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
            {games.map((game) => (
              <GameCard key={game.id} game={game} character={tiles[game.id]} captioned={captioned} onPick={openGame} />
            ))}
          </div>

          {/* Below the board, never above it: the hub's height is spent on
              games first (see src/hub/CLAUDE.md). */}
          <RecordStrip
            profile={activeProfile}
            games={games}
            onOpen={() => setRecordOf({ id: activeProfile.id, from: 'hub' })}
          />

          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-2 text-xs text-fg-subtle">
            <span>Characters from your own list · prints from the Met · sounds by Kenney.</span>
            <button
              type="button"
              onClick={() => setShowCredits(true)}
              // min-h-6: the 24px floor of WCAG 2.5.8, without growing the
              // text — at text-xs the bare link was 16px tall.
              className="focus-pop min-h-6 px-1 font-bold text-fg-body underline decoration-2 underline-offset-2
                hover:text-fg-strong"
            >
              Credits
            </button>
          </p>
        </Screen>

        {showPicker && (
          <ProfilePicker
            onClose={() => setShowPicker(false)}
            onEditList={(id) => { setShowPicker(false); setEditingListId(id); }}
            onOpenRecord={(id) => { setShowPicker(false); setRecordOf({ id, from: 'picker' }); }}
          />
        )}
        {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
      </TopBar>
    );
  }

  return (
    <>
      {content}
      {wipeId != null && <PanelWipe key={wipeId} />}
    </>
  );
}
