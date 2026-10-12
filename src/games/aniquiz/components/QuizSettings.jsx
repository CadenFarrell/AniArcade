import { POOLS, needsLists } from '../utils/pool';
import {
  ANSWER_SECONDS_RANGE, ANSWER_STYLES, CATEGORY_RANGE, FORMATS, QUIZ_RANGE,
} from '../prefs';
import { BOARD } from '../rules';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Banner, Button, Card, Checkbox, Field, NumberInput, Select } from '../../../shared/ui';

// The format picker and both settings cards, rendered identically by QuizSetup
// and the online lobby — AniTuneSettings' arrangement, for its reason: two
// hand-kept copies of a settings card are a promise to drift.
export default function QuizSettings({ values, onChange, report, packStatus, onRetryPack, players, disabled = false }) {
  const set = (patch) => onChange(patch);
  const board = values.format === BOARD;

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {FORMATS.map((f) => {
          const on = values.format === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ format: f.id })}
              disabled={disabled}
              aria-pressed={on}
              className={`focus-pop rounded-pop border-2 p-4 text-left transition-colors disabled:opacity-40
                ${on ? 'border-pop-red bg-pop-red/15' : 'border-line-strong bg-surface hover:border-line-loud'}`}
            >
              <span className="text-2xl">{f.icon}</span>
              <p className="mt-1 font-display text-lg font-extrabold text-white">{f.label}</p>
              <p className="mt-1 text-sm text-fg-helper">{f.blurb}</p>
            </button>
          );
        })}
      </div>

      <Card title="⚙️ The game" action={<DetailToggle />} padding="lg" className="mb-6">
        <Field label="Answers" htmlFor="aniquiz-answer-style" className="mb-2">
          <Select
            id="aniquiz-answer-style"
            value={values.answerStyle}
            disabled={disabled}
            onChange={(e) => set({ answerStyle: e.target.value })}
          >
            {ANSWER_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
        <SettingHelp className="mb-5">
          {ANSWER_STYLES.find((s) => s.id === values.answerStyle)?.blurb}
        </SettingHelp>

        {board ? (
          <Field label="Categories" htmlFor="aniquiz-categories" className="mb-5">
            <NumberInput
              id="aniquiz-categories"
              ariaLabel="Categories"
              min={CATEGORY_RANGE.min}
              max={CATEGORY_RANGE.max}
              value={values.categories}
              disabled={disabled}
              onChange={(categories) => set({ categories })}
            />
          </Field>
        ) : (
          <Field label="Questions" htmlFor="aniquiz-quiz-length" className="mb-5">
            <NumberInput
              id="aniquiz-quiz-length"
              ariaLabel="Questions"
              min={QUIZ_RANGE.min}
              max={QUIZ_RANGE.max}
              value={values.quizLength}
              disabled={disabled}
              onChange={(quizLength) => set({ quizLength })}
            />
          </Field>
        )}

        {board && (
          <>
            <Checkbox
              label="Daily Double"
              checked={values.dailyDouble}
              disabled={disabled}
              onChange={(e) => set({ dailyDouble: e.target.checked })}
              className="mb-2"
            />
            <SettingHelp
              indent
              className="mb-4"
              more="Never in the top row — a wager on the easiest clue on the board would be free money. Somebody on zero can still bet up to 1,000."
            >
              One hidden cell where whoever finds it bets on the clue, alone.
            </SettingHelp>

            <Checkbox
              label="Final round"
              checked={values.finalRound}
              disabled={disabled}
              onChange={(e) => set({ finalRound: e.target.checked })}
              className="mb-2"
            />
            <SettingHelp
              indent
              className="mb-5"
              more="Wagers go in after the category is shown and before the clue. A wrong answer loses the stake — the only place besides the Daily Double that a miss costs anything."
            >
              After the board, everyone bets on one last hard clue.
            </SettingHelp>
          </>
        )}

        <Checkbox
          label="Timed answers"
          checked={values.timed}
          disabled={disabled}
          onChange={(e) => set({ timed: e.target.checked })}
          className="mb-2"
        />
        <SettingHelp
          indent
          className="mb-3"
          more="Running out the clock counts as a blank. Online, an untimed clue waits for everyone — the host can reveal early."
        >
          A countdown on every clue.
        </SettingHelp>
        {values.timed && (
          <Field label="Seconds per clue" htmlFor="aniquiz-answer-seconds" className="ml-10">
            <NumberInput
              id="aniquiz-answer-seconds"
              ariaLabel="Seconds per clue"
              min={ANSWER_SECONDS_RANGE.min}
              max={ANSWER_SECONDS_RANGE.max}
              step={5}
              value={values.answerSeconds}
              disabled={disabled}
              onChange={(answerSeconds) => set({ answerSeconds })}
            />
          </Field>
        )}
      </Card>

      <Card title="📚 What clues are about" padding="lg" className="mb-6">
        <Field label="Shows" htmlFor="aniquiz-pool" className="mb-2">
          <Select
            id="aniquiz-pool"
            value={values.pool}
            disabled={disabled}
            onChange={(e) => set({ pool: e.target.value })}
          >
            {POOLS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <SettingHelp className="mb-4">{POOLS.find((p) => p.id === values.pool)?.blurb}</SettingHelp>

        {packStatus === 'loading' && <p className="text-sm text-fg-subtle">Loading the fact pack…</p>}
        {packStatus === 'failed' && (
          <Banner tone="danger">
            Couldn’t load the fact pack.{' '}
            <Button variant="neutral" size="sm" onClick={onRetryPack}>Try again</Button>
          </Banner>
        )}
        {report && <PoolLine report={report} pool={values.pool} players={players} />}
      </Card>
    </>
  );
}

// Says what the pool comes to in the pack's terms. "12 of 40 shows" is the line
// that matters: the pack covers a few hundred popular shows, so a table's
// shared list can be long and still mostly absent, and without the first
// number that looks like the game ignoring their lists.
function PoolLine({ report, pool, players }) {
  if (needsLists(pool) && !players?.length) return null;
  if (needsLists(pool) && report.requested === 0) {
    return (
      <Banner tone="warning">
        {pool === 'shared' && players.length > 1
          ? '⚠️ No shows in common. Pick “Shows anyone has”, or “The whole fact pack” to play without lists.'
          : '⚠️ No shows on these lists yet. Import one, or pick “The whole fact pack”.'}
      </Banner>
    );
  }
  return (
    <>
      <p className="text-base text-fg-body">
        {needsLists(pool)
          ? <><span className="font-bold text-white">{report.shows}</span> of {report.requested} show{report.requested === 1 ? '' : 's'} have facts</>
          : <><span className="font-bold text-white">{report.shows}</span> shows</>}
        {' · '}{report.characters} characters
      </p>
      {!report.playable && (
        <Banner tone="warning" className="mt-3">
          ⚠️ That isn’t enough to fill a game. Widen the pool above.
        </Banner>
      )}
    </>
  );
}
