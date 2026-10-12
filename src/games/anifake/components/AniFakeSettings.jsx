import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Banner, Card, Checkbox, Field, NumberInput, Select } from '../../../shared/ui';
import { fameReport, hasAnyFameData } from '../utils/pool';
import { FAME_LEVELS, getFame } from '../fame';
import { SETTING_HELP } from '../help';
import { DEFAULT_PREFS } from '../prefs';
import { MAX_CLUE_ROUNDS } from '../rules';

/**
 * AniFake's ⚙️ Settings card, rendered by both AniFakeSetup and the online
 * lobby. It was the same card hand-kept in both files, and the copies had
 * already drifted — help.js exists because the card-check strings were "word
 * for word identical" by convention and were not. AniTagSettings and
 * AniTuneSettings are the precedent.
 *
 * `local` adds the one option only a shared device can use: talk mode decides
 * which screen a hot seat sees, and there is no hot seat online. The lobby
 * passes `local={false}` and a host note instead. The lobby's prefs are
 * therefore a SUBSET of local play's, which is why each caller's savePrefs
 * merges rather than replaces.
 *
 * ONE `onChange(key, value)` rather than a setter per option, for AniTagSettings'
 * reason: the lobby's `settings` object is literally what leaves the host's
 * device, and a setter per prop is the drift put back one level down.
 *
 * The mode picker is deliberately NOT in here — it sits above the card on both
 * screens, as its own decision.
 */
export default function AniFakeSettings({ values, onChange, poolEntries, local, onReset }) {
  const { laps, sharedOnly, fame, allowRedeal, talkMode } = values;
  const { blind, tooTight, famous } = fameReport(poolEntries, fame);
  const fameLabel = getFame(fame).label;

  return (
    <Card title="⚙️ Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Clue rounds" htmlFor="anifake-laps" className="mb-2">
        <NumberInput
          id="anifake-laps"
          ariaLabel="Clue rounds"
          min={1}
          max={MAX_CLUE_ROUNDS}
          value={laps}
          onChange={(v) => onChange('laps', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more={SETTING_HELP.laps.more}>
        {SETTING_HELP.laps.short}
      </SettingHelp>

      <Checkbox
        label="Shared characters only"
        checked={sharedOnly}
        onChange={(e) => onChange('sharedOnly', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp indent className="mb-5" more={SETTING_HELP.sharedOnly.more}>
        {SETTING_HELP.sharedOnly.short}
      </SettingHelp>

      <Field label="How well known">
        <Select value={fame} onChange={(e) => onChange('fame', e.target.value)} className="text-lg">
          {FAME_LEVELS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </Select>
      </Field>
      {/* The short line is the level's own blurb rather than a fixed
          sentence — it is the only place the difference between the levels is
          stated, so it has to change with the Select above it. */}
      <SettingHelp className="mb-2" more={SETTING_HELP.fame.more}>
        {getFame(fame).blurb}
      </SettingHelp>
      {blind && (
        <Banner tone="warning" className="mb-5">
          {/* Which of the two causes it is decides whether a re-import helps
              at all, so the copy has to name it rather than always
              recommending one. */}
          ⚠️ {hasAnyFameData(poolEntries)
            ? `Only some of these characters have popularity data, so “${fameLabel}”
               would be judging the whole table on a handful of them.`
            : `No popularity data on these lists, so “${fameLabel}” has nothing to
               go on.`}
          {' '}The deal falls back to picking a lead. Popularity arrived after these lists
          were imported — open 🔗 and re-import the shows marked “Missing details” to fill
          it in.
        </Banner>
      )}
      {tooTight && (
        <Banner tone="warning" className="mb-5">
          ⚠️ Only {famous} character{famous === 1 ? '' : 's'} {famous === 1 ? 'is' : 'are'}{' '}
          well known enough for “{fameLabel}”, so rounds will start repeating.
          Try a broader setting, or import more lists.
        </Banner>
      )}

      <Checkbox
        label="🃏 Card check before the clues"
        checked={allowRedeal}
        onChange={(e) => onChange('allowRedeal', e.target.checked)}
        className="mb-2"
      />
      {/* "A re-deal changes the character and not the role" is deliberately
          public — it is what stops anyone trying to veto their way out of being
          the fake — but the host choosing whether to offer the phase is not
          when the table needs to hear it. It is said in full where a player is
          actually looking at a card: CardCheck.jsx and SecretReveal.jsx. */}
      <SettingHelp indent className={local ? 'mb-5' : ''} more={SETTING_HELP.allowRedeal.more}>
        {SETTING_HELP.allowRedeal.short}
      </SettingHelp>

      {local ? (
        <>
          <Checkbox
            label="🗣️ Talk it out"
            checked={talkMode}
            onChange={(e) => onChange('talkMode', e.target.checked)}
            className="mb-2"
          />
          <SettingHelp indent more={SETTING_HELP.talkMode.more}>
            {SETTING_HELP.talkMode.short}
          </SettingHelp>
        </>
      ) : (
        <p className="mt-4 text-sm text-fg-subtle">
          You&apos;re the host — your settings apply to everyone.
        </p>
      )}

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
