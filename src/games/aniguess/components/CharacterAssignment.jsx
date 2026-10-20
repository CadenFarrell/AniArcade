import { useState } from 'react';
import { getAssignableAnimeList, pickRandomCharacter } from '../utils/characterPool';
import AnimeBrowser from './AnimeBrowser';
import { Avatar, Button, Card, Icon, Screen, Wordmark } from '../../../shared/ui';
import Handoff from '../../../shared/components/Handoff';

const NO_SHARED_HELP = "Go back and either add a matching anime title to each player's list, "
  + 'or turn off "Shared shows only" in Setup.';

export default function CharacterAssignment({ guesser, allPlayers, sharedShowsOnly = true, twoStepRandom = false, onCharacterAssigned, assignmentNumber, totalPlayers }) {
  const [step, setStep] = useState('lookaway');
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [browseMode, setBrowseMode] = useState(false);

  const filteredAnimeList = getAssignableAnimeList(guesser, allPlayers, sharedShowsOnly);

  const pickRandom = () => {
    const character = pickRandomCharacter(filteredAnimeList, twoStepRandom);
    if (!character) { setStep('noSharedShows'); return; }
    setSelectedCharacter(character);
    setStep('confirm');
  };

  const pickManual = (character) => {
    setSelectedCharacter(character);
    setStep('confirm');
  };

  // Swaps in another random character without leaving the confirm screen.
  const reroll = () => {
    const next = pickRandomCharacter(filteredAnimeList, twoStepRandom, selectedCharacter);
    if (next) setSelectedCharacter(next);
  };

  return (
    <Screen center width="md">
      {/* Progress */}
      <p className="mb-8 text-center text-base text-fg-subtle">
        Assigning characters — {assignmentNumber} of {totalPlayers}
      </p>

      {step === 'lookaway' && (
        // The pass-the-device panel run the other way: the device stays put and
        // the one person whose face is on it turns round.
        <Handoff
          player={guesser}
          kicker="Look away"
          note={`Everyone else — get ready to pick a character for ${guesser.name}.`}
          cta={`${guesser.name} is looking away — Ready!`}
          onReady={() => setStep('assign')}
        />
      )}

      {step === 'assign' && !browseMode && (
        <div className="text-center">
          {/* "Pick a character for <name>" is one heading, so the lead-in is a
              plain line and the name carries the <h2>. */}
          <p className="mb-4 font-display text-3xl font-extrabold text-fg-strong">
            Pick a character for
          </p>
          <Wordmark tone="pink" size="md" level={2} className="mb-10">
            {guesser.name}
          </Wordmark>
          <div className="flex flex-col gap-5">
            <Button variant="info" size="xl" fullWidth onClick={pickRandom}>
              Pick Random
            </Button>
            <Button variant="secondary" size="xl" fullWidth onClick={() => setBrowseMode(true)}>
              Pick Manually
            </Button>
          </div>
        </div>
      )}

      {step === 'assign' && browseMode && (
        <AnimeBrowser
          animeList={filteredAnimeList}
          guesserName={guesser.name}
          sharedShowsOnly={sharedShowsOnly}
          actionLabel="Pick"
          onSelect={pickManual}
          onBack={() => setBrowseMode(false)}
          emptyMessage={`No shared anime found between players. ${NO_SHARED_HELP}`}
        />
      )}

      {step === 'noSharedShows' && (
        <div className="text-center">
          <div className="mb-5 text-6xl text-pop-amber"><Icon name="warning" /></div>
          <h2 className="mb-4 font-display text-3xl font-extrabold text-fg-strong">
            No shared anime found
          </h2>
          <p className="mb-10 text-lg text-fg-body">
            {guesser.name} doesn&apos;t share any anime titles with the other players.{' '}
            {NO_SHARED_HELP}
          </p>
          <Button variant="neutral" size="lg" fullWidth onClick={() => setStep('assign')}>
            ← Back
          </Button>
        </div>
      )}

      {step === 'confirm' && selectedCharacter && (
        <div className="text-center">
          <h2 className="mb-8 font-display text-3xl font-extrabold text-fg-strong">
            Confirm this character?
          </h2>
          <Card padding="lg" className="mb-8 border-pop-purple">
            <div className="mb-4 flex justify-center">
              <Avatar src={selectedCharacter.imageUrl} alt={selectedCharacter.name} size="lg" />
            </div>
            <h3 className="font-display text-3xl font-extrabold text-fg-strong">
              {selectedCharacter.name}
            </h3>
            <p className="text-lg text-fg-body">from {selectedCharacter.series}</p>
            <p className="mt-1 text-base text-fg-subtle">
              {[selectedCharacter.gender, selectedCharacter.role].filter(Boolean).join(' · ')}
            </p>
          </Card>
          {filteredAnimeList.length > 0 && (
            <Button variant="info" size="lg" fullWidth className="mb-4" onClick={reroll}>
              Re-roll
            </Button>
          )}
          <div className="flex gap-4">
            <Button
              variant="neutral"
              size="lg"
              className="flex-1"
              onClick={() => { setStep('assign'); setSelectedCharacter(null); }}
            >
              ← Pick Again
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              onClick={() => onCharacterAssigned(selectedCharacter)}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}
