import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Field, Select } from '../../../shared/ui';
import { CAP_OPTIONS, DEFAULT_PREFS, POOL_OPTIONS, ROUNDS_OPTIONS, SHAPE_OPTIONS, WORD_CLOCK_OPTIONS, WORDS_OPTIONS } from '../prefs';
import { MIN_PLAYERS } from '../rules';

const SHAPE_HELP = {
  pair: {
    text: 'Two clue-givers, everyone else guesses. The pair moves one seat each round.',
    more: 'Whoever gets it scores the word’s value and each giver scores half, so the givers want it guessed even while each is pulling the sentence their own way.',
  },
  rivals: {
    text: 'One giver from each team, sharing one sentence. After your word, only your team may guess.',
    more: 'So a word that sets the answer up hands the other team the next guess — say just enough for your own side.',
  },
  teams: {
    text: 'Teams take turns. Each team’s pair gives to its own guessers while the other team watches.',
    more: 'The steadiest of the three: nobody is pulling against you except your own partner.',
  },
};

/**
 * AniChain's Settings card, rendered by both the local setup screen and the
 * online lobby. `host` adds the lobby's "your settings apply to everyone";
 * `local` adds the word clock and spoken-or-typed words, which online has no
 * use for: there the guess window already paces the chain, and every word is
 * typed.
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device. Every option reaches the game through
 * rules.startGame (the pool too: online the first giver's device deals).
 */
export default function AniChainSettings({ values, onChange, onReset, host = false, local = false }) {
  const help = SHAPE_HELP[values.shape] ?? SHAPE_HELP.pair;
  // The footer compares against what this screen can reach: in the lobby the
  // local options are not on the card, so a saved local clock or typed words
  // must not read as "changed".
  const shown = local ? values : { ...values, wordClock: DEFAULT_PREFS.wordClock, words: DEFAULT_PREFS.words };
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Table" htmlFor="anichain-shape" className="mb-2">
        <Select id="anichain-shape" value={values.shape} onChange={(e) => onChange('shape', e.target.value)}>
          {SHAPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label} ({MIN_PLAYERS[o.value]}+)</option>
          ))}
        </Select>
      </Field>
      <SettingHelp className="mb-5" more={help.more}>{help.text}</SettingHelp>

      <Field label="Word cap" htmlFor="anichain-cap" className="mb-2">
        <Select id="anichain-cap" value={String(values.cap)} onChange={(e) => onChange('cap', Number(e.target.value))}>
          {CAP_OPTIONS.map((n) => <option key={n} value={String(n)}>{n} words</option>)}
        </Select>
      </Field>
      <SettingHelp className="mb-5" more="A right guess after word 1 is worth the cap, one less for every word after it. A short cap is a sprint; a long one leaves room for the sentence to wander off and come back.">
        The longest a sentence can get before the turn is over.
      </SettingHelp>

      {local && (
        <>
          <Field label="Words" htmlFor="anichain-words" className="mb-2">
            <Select id="anichain-words" value={values.words} onChange={(e) => onChange('words', e.target.value)}>
              {WORDS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <SettingHelp className="mb-5" more="Typed, the two givers pass the phone between them for every word, and nobody else needs to look away: the screen shows the sentence, never the character. A banned word is refused as it is typed. Guesses are still said out loud.">
            {values.words === 'typed'
              ? 'The givers type each word, and the sentence builds up on screen.'
              : 'The givers say each word out loud, and the phone counts them.'}
          </SettingHelp>

          <Field label="Word clock" htmlFor="anichain-clock" className="mb-2">
            <Select id="anichain-clock" value={String(values.wordClock)} onChange={(e) => onChange('wordClock', Number(e.target.value))}>
              {WORD_CLOCK_OPTIONS.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
            </Select>
          </Field>
          <SettingHelp className="mb-5" more="A word not given in time is lost: it still counts toward the cap, and the other giver goes next. The word’s time starts again after the givers peek or the table checks who got it.">
            {values.words === 'typed'
              ? 'How long each giver has to type a word and add it.'
              : 'How long each giver has to say a word and press Next word.'}
          </SettingHelp>
        </>
      )}

      <Field label="Rounds" htmlFor="anichain-rounds" className="mb-2">
        <Select id="anichain-rounds" value={String(values.rounds)} onChange={(e) => onChange('rounds', Number(e.target.value))}>
          {ROUNDS_OPTIONS.map((n) => <option key={n} value={String(n)}>{n} rounds</option>)}
        </Select>
      </Field>
      <SettingHelp className="mb-2" more="In team pairs a round is both teams’ turns, so it takes twice as long.">
        One character a round.
      </SettingHelp>

      {host && (
        <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
      )}

      <MoreSettings>
        <Field label="Characters" htmlFor="anichain-pool" className="mb-2">
          <Select id="anichain-pool" value={values.pool} onChange={(e) => onChange('pool', e.target.value)}>
            {POOL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <SettingHelp more="Supporting characters make for much harder sentences. Either way the deal looks first for someone a giver and a guesser both have on their lists.">
          Who the secret character can be.
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={shown} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
