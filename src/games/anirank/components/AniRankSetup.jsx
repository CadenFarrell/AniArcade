import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import AniRankSettings from './AniRankSettings';
import AxisPicker from './AxisPicker';
import FormatOption from './FormatOption';
import { useCustomPrompts } from '../hooks/useCustomPrompts';
import { eligibleItems, opinionPoolCounts } from '../utils/deck';
import { DEFAULT_PREFS, axisIdOf, resolveSavedAxis } from '../prefs';
import { AXES, axisForPool, getAxis, isOpinion } from '../axes';
import { BOARD_SIZE } from '../rules';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import descriptor from '../index';
import { Banner, Button, Card } from '../../../shared/ui';

// Local setup. Same shape as AniTuneSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function AniRankSetup({ onStart, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  // A list imported before the stats existed is repaired from the fact pack,
  // and the seated copy follows it the way it follows an import.
  usePackBackfill((p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x))));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  // Prompts are read before the axis state, not after: only an id is saved, and
  // turning that back into a spec means looking it up among them.
  const { prompts, savePrompt, deletePrompt } = useCustomPrompts();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anirank', DEFAULT_PREFS);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);
  // An axis SPEC, not an id — a string for a built-in, the stored prompt object
  // for one the player wrote. See getAxis.
  const savedAxis = resolveSavedAxis(prefs.axisId, prompts);
  const [axis, setAxis] = useState(savedAxis);
  const [scoring, setScoring] = useState(prefs.scoring);
  // 'round' | 'tiers' | 'ranked' — which half of the game Start opens.
  const [format, setFormat] = useState(prefs.format);
  // The saved `blind` is only trusted when the axis it was saved beside is the
  // one we actually got back. resolveSavedAxis falls back when a custom prompt
  // has been deleted, and a blind flag chosen for that prompt says nothing about
  // the axis standing in for it — so that case takes the new axis's default.
  const [blind, setBlind] = useState(
    () => (axisIdOf(savedAxis) === prefs.axisId ? prefs.blind : getAxis(savedAxis).defaultBlind)
  );

  // Picking a mode resets how it is dealt to that mode's default. Modes differ
  // enough here that a sticky toggle would silently carry "open" from an opinion
  // round into a fact one, where seeing all ten is a different game.
  const handleAxisChange = (spec) => {
    setAxis(spec);
    setBlind(getAxis(spec).defaultBlind);
  };

  // Switching to a tier format has to drag the axis with it when the current one
  // is a fact axis: those are hidden from the picker in tier mode (they filter
  // the pool by a stat older profiles do not carry), so leaving one selected
  // would show an empty picker while quietly ranking a fraction of the list.
  //
  // Through axisForPool, not straight to DEFAULT_PREFS.axisId: that is a *shows*
  // mode, so someone on "Character popularity" would be silently moved off their
  // characters as well as off facts. Only one of those two is the point.
  const handleFormatChange = (next) => {
    setFormat(next);
    if (next !== 'round' && getAxis(axis).kind === 'fact') {
      handleAxisChange(axisForPool(DEFAULT_PREFS.axisId, getAxis(axis).items));
    }
  };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setScoring(DEFAULT_PREFS.scoring);
    setFormat(DEFAULT_PREFS.format);
    // Through the same handler the picker uses, so `blind` lands on the default
    // axis's defaultBlind rather than on whatever the last axis wanted.
    handleAxisChange(DEFAULT_PREFS.axisId);
    resetPrefs();
  };

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  // The settings card reports every change as (key, value); the axis-coupled
  // state stays here, because an axis change resets `blind`.
  const changeSetting = (key, value) => {
    if (key === 'sharedOnly') setSharedOnly(value);
    else if (key === 'blind') setBlind(value);
    else if (key === 'scoring') setScoring(value);
  };

  const resolved = getAxis(axis);
  const opinion = isOpinion(resolved);
  const tiering = format !== 'round';
  // The id, not the spec — persisting a custom prompt's object would freeze a
  // copy of something the player can still edit or delete. See resolveSavedAxis.
  const remembered = { sharedOnly, scoring, blind, format, axisId: axisIdOf(axis) };

  // Counted for every axis, not just the selected one, so the picker can show
  // which modes this table can actually play before anyone commits to one.
  //
  // Custom prompts are all opinion, so their count depends only on shows vs
  // characters — two pool counts cover every prompt a player has written, where
  // counting them one by one would be a fresh pass over every list per prompt.
  const counts = useMemo(() => {
    const pools = opinionPoolCounts(players, { sharedOnly });
    return {
      ...Object.fromEntries(
        AXES.map((a) => [a.id, eligibleItems(players, { axis: a, sharedOnly }).length])
      ),
      ...Object.fromEntries(prompts.map((p) => [p.id, pools[p.items]])),
    };
  }, [players, sharedOnly, prompts]);

  const eligible = counts[resolved.id] ?? 0;
  // A board needs ten cards; a tier list needs two, because it is not a round —
  // there is no deck to fill and nothing to guess at.
  const need = tiering ? 2 : BOARD_SIZE;
  const enough = eligible >= need;
  const noun = resolved.items === 'characters' ? 'characters' : 'shows';
  // The subject is the answer key, so someone has to be guessing at them. A tier
  // list has no answer key at all, so one person is a full table.
  const enoughPlayers = opinion && scoring && !tiering ? players.length >= 2 : players.length >= 1;
  const canStart = enoughPlayers && enough;

  const status = !enoughPlayers
    ? (players.length === 0 ? 'Seat at least one player.' : 'An opinion round needs a second player.')
    : !enough ? `Need ${need} ${noun} — found ${eligible}.`
      : `${players.length} player${players.length === 1 ? '' : 's'} · ${eligible} ${eligible === 1 ? noun.replace(/s$/, '') : noun} to draw from${
        sharedOnly && players.length > 1 ? ' (shared)' : ''}`;

  return (
    <>
      <SetupLayout
        game={descriptor}
        // True of both deals. The old "one at a time, no takebacks" described
        // blind mode, but the default axis deals open.
        tagline={tiering ? 'Your whole list, best at the top' : 'Ten cards, one board, best at the top'}
        onBack={onBack}
        left={(
          <>
            <LocalRoster
              players={players}
              activeId={activeId}
              onAdd={() => setShowPicker(true)}
              onImport={setImportTarget}
              onRemove={(id) => setPlayers((prev) => prev.filter((x) => x.id !== id))}
              onUpdate={(p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
            />

            {/* With a small shared list — or a fact axis on a profile imported
                before the stats existed — this is the ordinary outcome, not an
                edge case, so it gets a reason rather than a dead Start button. */}
            {players.length > 0 && !enough && (
              <Banner tone="warning" className="mb-4">
                Need {need} {noun} to {tiering ? 'build a list' : 'fill a board'} — found {eligible}.
                {resolved.kind === 'fact'
                  ? ' Re-import a list with the link button on a player: this mode needs stats that older saved profiles don’t carry.'
                  : sharedOnly && players.length > 1
                    ? ` Turn off “Shared ${noun} only”, or import more lists.`
                    : ' Import a bigger list with the link button on a player.'}
              </Banner>
            )}

            {players.length === 1 && opinion && scoring && !tiering && (
              <Banner tone="warning" className="mb-4">
                An opinion round needs someone to guess at the subject. Add a player, or
                turn off “Keep score” to rank on your own.
              </Banner>
            )}

            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <>
            {/* Above the mode picker because it decides how much of the picker
                applies: a tier list has no fact axes, no blind deal and no score. */}
            <Card title="Format" padding="lg" className="mb-6">
              <div className="flex flex-col gap-2">
                <FormatOption
                  active={format === 'round'}
                  onClick={() => handleFormatChange('round')}
                  title="Round of ten"
                  hint="Ten random cards, one board, scored against an answer key."
                />
                <FormatOption
                  active={format === 'tiers'}
                  onClick={() => handleFormatChange('tiers')}
                  title="Tier list"
                  hint={`Every ${noun.replace(/s$/, '')} you have, sorted into S–D rows. Saved and kept.`}
                />
                <FormatOption
                  active={format === 'ranked'}
                  onClick={() => handleFormatChange('ranked')}
                  title="Full ranking"
                  hint={`Every ${noun.replace(/s$/, '')} you have, in one strict order from 1 to N.`}
                />
              </div>
            </Card>

            <AxisPicker
              value={axis}
              onChange={handleAxisChange}
              counts={players.length ? counts : undefined}
              opinionOnly={tiering}
              minCount={need}
              prompts={prompts}
              onSavePrompt={savePrompt}
              onDeletePrompt={deletePrompt}
            />

            <AniRankSettings
              values={{ sharedOnly, blind, scoring }}
              onChange={changeSetting}
              noun={noun}
              tiering={tiering}
              remembered={remembered}
              onReset={applyDefaults}
            />
          </>
        )}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                savePrefs(remembered);
                onStart({ players, sharedOnly, axis, scoring, blind, format });
              }}
              disabled={!canStart}
            >
              {tiering ? 'Open tier lists' : 'Start Game'}
            </Button>
          </StartBar>
        )}
      />

      {showPicker && (
        <ProfilePicker
          mode="add"
          excludeIds={players.map((p) => p.id)}
          onPick={(profile) => setPlayers((prev) => [...prev, profile])}
          onClose={() => setShowPicker(false)}
        />
      )}
      {importTarget && (
        <ListImport profile={importTarget} onClose={() => setImportTarget(null)} onImported={handleImported} />
      )}
    </>
  );
}

// One format. Same treatment as AxisPicker's AxisButton so the two cards read as
// one set of choices rather than two unrelated widgets.
