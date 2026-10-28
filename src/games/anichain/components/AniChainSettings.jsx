import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Field, Select } from '../../../shared/ui';
import { CAP_OPTIONS, DEFAULT_PREFS, POOL_OPTIONS, ROUNDS_OPTIONS, SHAPE_OPTIONS } from '../prefs';
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
 * online lobby. `host` adds the lobby's "your settings apply to everyone".
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device. Every option reaches the game through
 * rules.startGame (the pool too: online the first giver's device deals).
 */
export default function AniChainSettings({ values, onChange, onReset, host = false }) {
  const help = SHAPE_HELP[values.shape] ?? SHAPE_HELP.pair;
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

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
