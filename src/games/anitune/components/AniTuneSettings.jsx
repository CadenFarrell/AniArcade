import { hasLives, isRace } from '../rules';
import { MODES } from '../modes';
import { LOCAL_ENTRY_STYLES, LOCAL_RACE_STYLES, PLAYBACK_RATES } from '../prefs';
import { RACE } from '../rules';
import {
  eligibleEntries, SAMPLE_POINTS, YEAR_MIN, YEAR_MAX, yearRangeIsOpen,
} from '../utils/questionPool';
import {
  POPULARITY_LEVELS, getPopularityLevel, hasPopularitySignal, hasAnyPopularityData,
  MIN_POPULARITY_POOL,
} from '../utils/popularity';
import MoreSettings from '../../../shared/components/MoreSettings';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import {
  Banner,
  Card,
  Checkbox,
  Field,
  Icon,
  NumberInput,
  Select,
} from '../../../shared/ui';

// The mode picker and both settings cards, rendered identically by the local
// setup screen and the online lobby.
//
// Extracted rather than duplicated, and that is a change of approach worth
// stating: AniTune's two setup surfaces offer exactly the same options, and the
// old arrangement made adding one option a four-place edit (a useState and an
// applyDefaults line in each screen). At six settings that was tolerable; at
// seventeen it is a guarantee the two will drift. The screens now hold a single
// `settings` object and hand it here, and every change comes back as one
// onChange(key, value), the convention CLAUDE.md sets for settings cards.
//
// prefs.js is still the schema — this component never invents a default, it only
// renders what it is given.

// The pool as each dial sees it, so a warning can say what that dial cost rather
// than reporting a number the player cannot attribute to anything.
function poolStages(players, values) {
  const base = eligibleEntries(players, { sharedSongsOnly: values.sharedSongsOnly })
    .map((e) => e.anime);
  const afterYear = eligibleEntries(players, {
    sharedSongsOnly: values.sharedSongsOnly,
    yearFrom: values.yearFrom,
    yearTo: values.yearTo,
  }).map((e) => e.anime);
  const final = eligibleEntries(players, {
    sharedSongsOnly: values.sharedSongsOnly,
    yearFrom: values.yearFrom,
    yearTo: values.yearTo,
    popularity: values.popularity,
  }).map((e) => e.anime);
  return { base, afterYear, final };
}

// `local` adds the two choices only one shared device has: how a race is
// buzzed, and whether everyone types in private or says it out loud.
export default function AniTuneSettings({ players, values, onChange, disabled = false, local = false }) {
  const { base, afterYear, final } = poolStages(players, values);

  const level = getPopularityLevel(values.popularity);
  const dialIsOn = level.quantile != null;
  // Three states, not two — the distinction AniFake's pool.js exists to make.
  // "Nothing was ever fetched" and "some was" look identical to a naive check,
  // and only the second is fixed by importing more lists.
  const canMeasure = hasPopularitySignal(afterYear);
  const anyData = hasAnyPopularityData(afterYear);
  const yearNarrowed = !yearRangeIsOpen(values.yearFrom, values.yearTo);

  return (
    <>
      {/* Mode. aria-pressed rather than a radio group because these are big
          tappable blocks, not a form control. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => {
          const selected = values.mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange('mode', m.id)}
              disabled={disabled}
              aria-pressed={selected}
              className={`focus-pop rounded-pop border-2 p-4 text-left transition-colors disabled:opacity-40
                ${selected
                  ? 'border-pop-blue bg-pop-blue/15'
                  : 'border-line-strong bg-surface hover:border-line-loud'}`}
            >
              <span className="text-2xl text-pop-blue"><Icon name={m.icon} /></span>
              <p className="mt-1 font-display text-lg font-extrabold text-fg-strong">{m.label}</p>
              <p className="mt-1 text-sm text-fg-helper">{m.blurb}</p>
            </button>
          );
        })}
      </div>

      <Card title="The round" action={<DetailToggle />} padding="lg" className="mb-6">
        <Field label="Questions" htmlFor="anitune-round-size" className="mb-5">
          <NumberInput
            id="anitune-round-size"
            ariaLabel="Questions"
            min={1}
            max={50}
            value={values.roundSize}
            disabled={disabled}
            onChange={(roundSize) => onChange('roundSize', roundSize)}
          />
        </Field>

        <Checkbox
          label="Timed guesses"
          checked={values.timed}
          disabled={disabled}
          onChange={(e) => onChange('timed', e.target.checked)}
          className="mb-2"
        />
        {/* `indent` lines the note up with the label, clearing the 7-unit box
            plus its 3-unit gap — see SettingHelp. */}
        <SettingHelp
          indent
          className="mb-4"
          more="Turn it off and every correct answer is worth exactly one, with no clock at all."
        >
          A countdown per song, and the faster you answer the more the point is worth —
          up to double.
        </SettingHelp>

        {values.timed && (
          <div className="mb-5 ml-10 flex flex-col gap-4 sm:flex-row">
            <Field label="Guess time (s)" htmlFor="anitune-guess-seconds" className="flex-1">
              <NumberInput
                id="anitune-guess-seconds"
                ariaLabel="Guess time in seconds"
                min={5}
                max={60}
                value={values.guessSeconds}
                disabled={disabled}
                onChange={(guessSeconds) => onChange('guessSeconds', guessSeconds)}
              />
            </Field>
            {/* Only race has a second, shorter clock — the one that starts when
                somebody claims the song. */}
            {isRace(values.mode) && (
              <Field label="Answer time (s)" htmlFor="anitune-answer-seconds" className="flex-1">
                <NumberInput
                  id="anitune-answer-seconds"
                  ariaLabel="Answer time after buzzing, in seconds"
                  min={3}
                  max={30}
                  value={values.answerSeconds}
                  disabled={disabled}
                  onChange={(answerSeconds) => onChange('answerSeconds', answerSeconds)}
                />
              </Field>
            )}
          </div>
        )}

        {hasLives(values.mode) && (
          <Field label="Lives each" htmlFor="anitune-lives" className="mb-5">
            <NumberInput
              id="anitune-lives"
              ariaLabel="Starting lives"
              min={1}
              max={9}
              value={values.startingLives}
              disabled={disabled}
              onChange={(startingLives) => onChange('startingLives', startingLives)}
            />
          </Field>
        )}

        {/* How the clip itself plays — set once and left alone at most tables. */}
        {values.timed && (
          <>
            <Checkbox
              label="Hints"
              checked={Boolean(values.hints)}
              disabled={disabled}
              onChange={(e) => onChange('hints', e.target.checked)}
              className="mb-2"
            />
            <SettingHelp
              indent
              className="mb-5"
              more="Never the song's title. Answering before a hint already pays more, through the speed bonus."
            >
              While nobody has it: the theme's number and year a third of the way in, then whose lists it is on.
            </SettingHelp>
          </>
        )}

        {local && (players?.length ?? 0) > 1 && (values.mode === RACE ? (
          <>
            <Field label="On one device" htmlFor="anitune-local-race" className="mb-2">
              <Select
                id="anitune-local-race"
                value={values.localRace}
                disabled={disabled}
                onChange={(e) => onChange('localRace', e.target.value)}
              >
                {LOCAL_RACE_STYLES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <SettingHelp className="mb-5">{LOCAL_RACE_STYLES.find((o) => o.id === values.localRace)?.blurb}</SettingHelp>
          </>
        ) : (
          <>
            <Field label="On one device" htmlFor="anitune-local-entry" className="mb-2">
              <Select
                id="anitune-local-entry"
                value={values.localEntry}
                disabled={disabled}
                onChange={(e) => onChange('localEntry', e.target.value)}
              >
                {LOCAL_ENTRY_STYLES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <SettingHelp className="mb-5">{LOCAL_ENTRY_STYLES.find((o) => o.id === values.localEntry)?.blurb}</SettingHelp>
          </>
        ))}

        <MoreSettings about="the clip">
          <Field label="Clip length (s)" htmlFor="anitune-clip-seconds" className="mb-5">
            <NumberInput
              id="anitune-clip-seconds"
              ariaLabel="Clip length in seconds"
              min={3}
              max={30}
              value={values.clipSeconds}
              disabled={disabled}
              onChange={(clipSeconds) => onChange('clipSeconds', clipSeconds)}
            />
          </Field>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Field label="Clip starts" htmlFor="anitune-sample-point" className="flex-1">
              <Select
                id="anitune-sample-point"
                value={values.samplePoint}
                disabled={disabled}
                onChange={(e) => onChange('samplePoint', e.target.value)}
              >
                {SAMPLE_POINTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Speed" htmlFor="anitune-playback-rate" className="flex-1">
              <Select
                id="anitune-playback-rate"
                value={String(values.playbackRate)}
                disabled={disabled}
                onChange={(e) => onChange('playbackRate', Number(e.target.value))}
              >
                {PLAYBACK_RATES.map((r) => (
                  <option key={r} value={r}>{r === 1 ? 'Normal' : `${r}×`}</option>
                ))}
              </Select>
            </Field>
          </div>
          {/* Already a single line, but routed through SettingHelp so every note on
              the card carries one weight — the drift between three of them is half
              of what made these cards read as a wall. */}
          <SettingHelp className="mt-2">
            {SAMPLE_POINTS.find((s) => s.id === values.samplePoint)?.blurb}
          </SettingHelp>
        </MoreSettings>
      </Card>

      {/* No switch on this card: every note in it is already one line and has no
          second tier to reveal, so the control would be inert. The rule is that a
          card carries the switch when it has something to show. */}
      <Card title="The song pool" padding="lg" className="mb-6">
        <Checkbox
          label="Shared songs only"
          checked={values.sharedSongsOnly}
          disabled={disabled}
          onChange={(e) => onChange('sharedSongsOnly', e.target.checked)}
          className="mb-2"
        />
        <SettingHelp indent>
          Only use shows every player has on their list, so nobody is guessing blind.
        </SettingHelp>

        {/* What the songs are drawn from, beyond whose lists: kinds, fame,
            years, and how many per show. */}
        <MoreSettings about="the songs">
          <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
            <Checkbox
              label="Openings"
              checked={values.includeOpenings}
              disabled={disabled}
              onChange={(e) => onChange('includeOpenings', e.target.checked)}
            />
            <Checkbox
              label="Endings"
              checked={values.includeEndings}
              disabled={disabled}
              onChange={(e) => onChange('includeEndings', e.target.checked)}
            />
          </div>

          <Field label="How well known" htmlFor="anitune-popularity" className="mb-2">
            <Select
              id="anitune-popularity"
              value={values.popularity}
              disabled={disabled}
              onChange={(e) => onChange('popularity', e.target.value)}
            >
              {POPULARITY_LEVELS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <SettingHelp className="mb-3">{level.blurb}</SettingHelp>
          <div className="mb-2 flex flex-col gap-4 sm:flex-row">
            <Field label="From year" htmlFor="anitune-year-from" className="flex-1">
              <NumberInput
                id="anitune-year-from"
                ariaLabel="Earliest release year"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={values.yearFrom}
                disabled={disabled}
                onChange={(yearFrom) => onChange('yearFrom', yearFrom)}
              />
            </Field>
            <Field label="To year" htmlFor="anitune-year-to" className="flex-1">
              <NumberInput
                id="anitune-year-to"
                ariaLabel="Latest release year"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={values.yearTo}
                disabled={disabled}
                onChange={(yearTo) => onChange('yearTo', yearTo)}
              />
            </Field>
          </div>
          <SettingHelp className="mb-5">
            {yearNarrowed
              ? `Shows with no release date on file are left out while this is narrowed${
                afterYear.length < base.length ? ` — ${base.length - afterYear.length} dropped.` : '.'}`
              : 'Leave at the full range to include everything, dated or not.'}
          </SettingHelp>

          <Field label="Max songs per show" htmlFor="anitune-max-per-anime">
            <NumberInput
              id="anitune-max-per-anime"
              ariaLabel="Maximum songs from any one show"
              min={1}
              max={5}
              value={values.maxPerAnime}
              disabled={disabled}
              onChange={(maxPerAnime) => onChange('maxPerAnime', maxPerAnime)}
            />
          </Field>
        </MoreSettings>

        {/* After the fold, never inside it: a warning about a folded-away
            setting would be a problem with no visible cause. */}
        {/* Warn, never gate. A small pool is a valid answer to what was asked,
            and silently overriding a setting someone just picked is what makes
            one feel broken. The two dead ends are separated because only one of
            them is worth importing for. */}
        {dialIsOn && !canMeasure && (
          <Banner tone="warning" className="mt-4">
            {anyData
              ? 'Too few of these shows have popularity data to rank them — re-import your lists to fill it in. Using every show for now.'
              : 'None of these shows have popularity data — it arrived after your lists did. Re-import to enable this. Using every show for now.'}
          </Banner>
        )}
        {dialIsOn && canMeasure && final.length > 0 && final.length < MIN_POPULARITY_POOL && (
          <Banner tone="warning" className="mt-4">
            That leaves only {final.length} show{final.length === 1 ? '' : 's'} — expect
            repeats. Loosen it or import more lists.
          </Banner>
        )}
      </Card>
    </>
  );
}
