import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, CardRow, Checkbox, NumberInput, PlaceMark } from '../../../shared/ui';
import { DEFAULT_PREFS, POSITIONS } from '../prefs';
import { DEFAULT_MATCH_ROUNDS } from '../rules';
import MatchLengthSetting from '../../../shared/components/MatchLengthSetting';

/**
 * AniGuess's Settings card, rendered by both PlayerSetup and the online
 * lobby. It was the last game still hand-keeping the card in two files, and the
 * copies had already drifted: the two screens listed the options in different
 * orders, and only local play had the detail switch. AniFakeSettings is the
 * precedent this follows.
 *
 * `local` adds the one option only a shared device can use: talk mode decides
 * which screen the hot seat sees, and there is no hot seat online. The timer is
 * on both now — online each guesser's own device runs it (OnlineGameScreen). The lobby passes
 * `local={false}` and gets the host note in their place. Its prefs are therefore
 * a SUBSET of local play's, which is why each caller's savePrefs merges.
 *
 * Draw options lead and the device-only options follow: how characters are
 * dealt is the decision every table makes, and it reads the same on both screens.
 *
 * ONE `onChange(key, value)` rather than a setter per option, for
 * AniTagSettings' reason: the lobby's `settings` object is literally what leaves
 * the host's device, and a setter per prop is the drift put back one level down.
 */
export default function AniGuessSettings({ values, onChange, local, onReset }) {
  const { rounds, sharedShowsOnly, twoStepRandom, timerEnabled, timerSeconds, talkMode, pointsPerPosition } = values;

  // NumberInput hands over an already-parsed, already-clamped number, so this
  // only writes the slot — copied, so the array in state is never mutated.
  const updatePoints = (i, n) => {
    const updated = [...pointsPerPosition];
    updated[i] = n;
    onChange('pointsPerPosition', updated);
  };

  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <MatchLengthSetting id="aniguess-rounds" value={rounds} defaultRounds={DEFAULT_MATCH_ROUNDS} onChange={onChange} />

      <Checkbox
        label="Shared shows only"
        checked={sharedShowsOnly}
        onChange={(e) => onChange('sharedShowsOnly', e.target.checked)}
        className="mb-2"
      />
      {/* "At least one other player", not "everyone": that is what
          getAssignableAnimeList checks, and it is all a round needs — one
          person who can answer about the show. */}
      <SettingHelp
        indent
        className="mb-5"
        more="Off, your character can come from a show only you have watched, and the
              table has to answer questions about someone they may never have seen."
      >
        Characters only come from shows at least one other player has too.
      </SettingHelp>

      <Checkbox
        label="Enable Timer"
        checked={timerEnabled}
        onChange={(e) => onChange('timerEnabled', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp indent className="mb-4">
        A countdown each turn. Asking your question stops it; running out ends your turn.
      </SettingHelp>

      {timerEnabled && (
        <div className="mb-5 ml-10 flex items-center gap-3 text-lg text-fg-strong">
          <span>Seconds:</span>
          {/* Steps by 15 — 30 to 300 in ones is 270 presses. */}
          <NumberInput
            size="sm"
            value={timerSeconds}
            min={30}
            max={300}
            step={15}
            ariaLabel="Timer seconds"
            onChange={(n) => onChange('timerSeconds', n)}
            className="w-44"
          />
        </div>
      )}

      {local && (
        <>
          <Checkbox
            label="Talk it out"
            checked={talkMode}
            onChange={(e) => onChange('talkMode', e.target.checked)}
            className="mb-2"
          />
          <SettingHelp
            indent
            className="mb-5"
            more="Nothing is typed, so instead of a question history you get a running row of
                  yes/no marks for each player's answers."
          >
            Ask your questions and say your guess out loud — the table taps what happened
            and the turn passes on that one tap.
          </SettingHelp>
        </>
      )}

      {/* How characters are drawn and how places pay — set once at most
          tables. Shared shows, the timer and talk mode stay up front. */}
      <MoreSettings>
        <Checkbox
          label="Anime-first randomizer"
          checked={twoStepRandom}
          onChange={(e) => onChange('twoStepRandom', e.target.checked)}
          className="mb-2"
        />
        <SettingHelp
          indent
          className="mb-5"
          more="Off, every character is equally likely, so a show with a cast of forty comes
                up far more often than one with five."
        >
          Picks a show first, then a character from it, so every show gets an equal chance.
        </SettingHelp>

        <p className="mb-1 text-base text-fg-strong">Points per position:</p>
        {/* One per row rather than four across. Four steppers sharing a row left
            the number narrower than either of its own buttons, and the online
            lobby's max-w-md screen had no width for them at all. */}
        {POSITIONS.map(({ place, label }, i) => (
          <CardRow key={label}>
            <span className="flex items-center gap-2 text-fg-strong">
              {/* aria-hidden: the label beside it already says the place */}
              <span aria-hidden="true" className="inline-flex w-7 justify-center">
                {place && <PlaceMark place={place} />}
              </span>
              {label}
            </span>
            <NumberInput
              size="sm"
              value={pointsPerPosition[i]}
              min={0}
              max={99}
              ariaLabel={`Points for ${label}`}
              onChange={(n) => updatePoints(i, n)}
              className="w-40 flex-shrink-0"
            />
          </CardRow>
        ))}
      </MoreSettings>

      {!local && (
        <p className="mt-4 text-sm text-fg-subtle">
          You&apos;re the host — your settings apply to everyone.
        </p>
      )}

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
