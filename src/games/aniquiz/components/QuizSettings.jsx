import { POOLS, needsLists } from '../utils/pool';
import {
  ANSWER_SECONDS_RANGE, ANSWER_STYLES, CATEGORY_RANGE, FORMATS, LOCAL_ANSWERS, QUIZ_RANGE,
} from '../prefs';
import { BOARD } from '../rules';
import { ROWS, TOPICS } from '../clues';
import MoreSettings from '../../../shared/components/MoreSettings';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  GhostButton,
  Icon,
  NumberInput,
  Select,
} from '../../../shared/ui';

// The format picker and both settings cards, rendered identically by QuizSetup
// and the online lobby — AniTuneSettings' arrangement, for its reason: two
// hand-kept copies of a settings card are a promise to drift. Changes go out as
// one onChange(key, value), the convention CLAUDE.md sets for settings cards.
export default function QuizSettings({
  values, onChange, report, packStatus, onRetryPack, players, disabled = false, local = false,
}) {
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
              onClick={() => onChange('format', f.id)}
              disabled={disabled}
              aria-pressed={on}
              className={`focus-pop rounded-pop border-2 p-4 text-left transition-colors disabled:opacity-40
                ${on ? 'border-pop-red bg-pop-red/15' : 'border-line-strong bg-surface hover:border-line-loud'}`}
            >
              <span className="text-2xl text-pop-red"><Icon name={f.icon} /></span>
              <p className="mt-1 font-display text-lg font-extrabold text-fg-strong">{f.label}</p>
              <p className="mt-1 text-sm text-fg-helper">{f.blurb}</p>
            </button>
          );
        })}
      </div>

      <Card title="The game" action={<DetailToggle />} padding="lg" className="mb-6">
        <Field label="Answers" htmlFor="aniquiz-answer-style" className="mb-2">
          <Select
            id="aniquiz-answer-style"
            value={values.answerStyle}
            disabled={disabled}
            onChange={(e) => onChange('answerStyle', e.target.value)}
          >
            {ANSWER_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
        <SettingHelp className="mb-5">
          {ANSWER_STYLES.find((s) => s.id === values.answerStyle)?.blurb}
        </SettingHelp>

        {/* One device only: online everyone already has their own. With more
            than one player on a shared device this is the difference between
            a game and a hundred handoffs, so it sits up front. */}
        {local && (players?.length ?? 0) > 1 && (
          <>
            <Field label="On one device" htmlFor="aniquiz-local-answers" className="mb-2">
              <Select
                id="aniquiz-local-answers"
                value={values.localAnswers}
                disabled={disabled}
                onChange={(e) => onChange('localAnswers', e.target.value)}
              >
                {LOCAL_ANSWERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <SettingHelp className="mb-5">
              {LOCAL_ANSWERS.find((s) => s.id === values.localAnswers)?.blurb}
            </SettingHelp>
          </>
        )}

        {board ? (
          <Field label="Categories" htmlFor="aniquiz-categories">
            <NumberInput
              id="aniquiz-categories"
              ariaLabel="Categories"
              min={CATEGORY_RANGE.min}
              max={CATEGORY_RANGE.max}
              value={values.categories}
              disabled={disabled}
              onChange={(categories) => onChange('categories', categories)}
            />
          </Field>
        ) : (
          <Field label="Questions" htmlFor="aniquiz-quiz-length">
            <NumberInput
              id="aniquiz-quiz-length"
              ariaLabel="Questions"
              min={QUIZ_RANGE.min}
              max={QUIZ_RANGE.max}
              value={values.quizLength}
              disabled={disabled}
              onChange={(quizLength) => onChange('quizLength', quizLength)}
            />
          </Field>
        )}

        {/* The board's extras and the clock — set once at most tables. The
            answer style and the length stay up front. */}
        <MoreSettings about="the game">
          {board && (
            <>
              <Checkbox
                label="Daily Double"
                checked={values.dailyDouble}
                disabled={disabled}
                onChange={(e) => onChange('dailyDouble', e.target.checked)}
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
                onChange={(e) => onChange('finalRound', e.target.checked)}
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
            onChange={(e) => onChange('timed', e.target.checked)}
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
                onChange={(answerSeconds) => onChange('answerSeconds', answerSeconds)}
              />
            </Field>
          )}
        </MoreSettings>
      </Card>

      <Card title="What clues are about" padding="lg" className="mb-6">
        <Field label="Shows" htmlFor="aniquiz-pool" className="mb-2">
          <Select
            id="aniquiz-pool"
            value={values.pool}
            disabled={disabled}
            onChange={(e) => onChange('pool', e.target.value)}
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
        {report && <PoolLine report={report} pool={values.pool} players={players} topicsOff={values.topicsOff} />}
      </Card>

      <TopicSwitches values={values} onChange={onChange} report={report} disabled={disabled} />
    </>
  );
}

// One switch per topic (a board column), on by default. The value is the list
// of ids switched OFF — see enabledTopics in clues.js for why that way round.
//
// Each switch carries what the pool gives that topic — distinct subjects, a
// show or a character depending on the topic, so the card calls them
// "questions" — because a player deciding whether Theme Songs is worth turning
// back on wants to see it before pressing Start, and a topic that cannot fill a
// board column should say so instead of quietly never appearing.
function TopicSwitches({ values, onChange, report, disabled }) {
  const board = values.format === BOARD;
  const off = new Set(values.topicsOff ?? []);
  const countFor = new Map((report?.topics ?? []).map((t) => [t.id, t.clues]));
  const set = (id, on) => {
    const next = new Set(off);
    if (on) next.delete(id);
    else next.add(id);
    // Kept in TOPICS order so the stored value (and the reset link's
    // comparison against the default) does not depend on click order.
    onChange('topicsOff', TOPICS.filter((t) => next.has(t.id)).map((t) => t.id));
  };
  const enabled = TOPICS.length - off.size;

  return (
    <Card
      title="Categories"
      action={off.size ? (
        <GhostButton onClick={() => onChange('topicsOff', [])} disabled={disabled}>Switch all on</GhostButton>
      ) : null}
      padding="lg"
      className="mb-6"
    >
      {/* Every topic is on by default, and most tables never switch one off,
          so the switches fold away; the warnings below stay out of the fold. */}
      <p className="text-sm text-fg-helper">{enabled} of {TOPICS.length} categories on</p>
      <MoreSettings about="categories">
        <SettingHelp className="mb-4">
          {board
            ? 'Switch off any you’d rather skip. The board picks its columns from the ones left on.'
            : 'Switch off any you’d rather skip. Questions come from the ones left on.'}
        </SettingHelp>

        <div className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t) => {
            const count = countFor.get(t.id);
            const thin = board && count != null && count < ROWS;
            return (
              <Checkbox
                key={t.id}
                checked={!off.has(t.id)}
                disabled={disabled}
                onChange={(e) => set(t.id, e.target.checked)}
                label={(
                  <span className="min-w-0">
                    <span className="block font-bold text-fg-strong">{t.title}</span>
                    <span className="block text-sm text-fg-subtle">
                      {t.blurb}
                      {count != null && (
                        <>
                          {' · '}
                          <span className={thin ? 'text-pop-amber' : ''}>
                            {thin
                              ? `only ${count} question${count === 1 ? '' : 's'}, too few for a column`
                              : `${count} questions`}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                )}
              />
            );
          })}
        </div>
      </MoreSettings>

      {enabled === 0 && (
        <Banner tone="warning" className="mt-4">Every category is off. Switch at least one back on.</Banner>
      )}
      {/* Only once there are enough for a board at all — below two, PoolLine's
          "not enough to fill a game" already says it, louder. */}
      {board && enabled > 0 && report && report.playableTopics >= 2 && report.playableTopics < values.categories && (
        <p className="mt-4 text-sm text-fg-helper">
          Only {report.playableTopics} of these can fill a column with this pool, so the board will have
          {' '}{report.playableTopics} categories instead of {values.categories}.
        </p>
      )}
    </Card>
  );
}

// Says what the pool comes to in the pack's terms. "12 of 40 shows" is the line
// that matters: the pack covers a few hundred popular shows, so a table's
// shared list can be long and still mostly absent, and without the first
// number that looks like the game ignoring their lists.
function PoolLine({ report, pool, players, topicsOff }) {
  if (needsLists(pool) && !players?.length) return null;
  if (needsLists(pool) && report.requested === 0) {
    return (
      <Banner tone="warning">
        {pool === 'shared' && players.length > 1
          ? 'No shows in common. Pick “Shows anyone has”, or “The whole fact pack” to play without lists.'
          : 'No shows on these lists yet. Import one, or pick “The whole fact pack”.'}
      </Banner>
    );
  }
  return (
    <>
      <p className="text-base text-fg-body">
        {needsLists(pool)
          ? <><span className="font-bold text-fg-strong">{report.shows}</span> of {report.requested} show{report.requested === 1 ? '' : 's'} have facts</>
          : <><span className="font-bold text-fg-strong">{report.shows}</span> shows</>}
        {' · '}{report.characters} characters
      </p>
      {!report.playable && (
        <Banner tone="warning" className="mt-3">
          {topicsOff?.length
            ? 'That isn’t enough to fill a game. Widen the pool above, or switch more categories on below.'
            : 'That isn’t enough to fill a game. Widen the pool above.'}
        </Banner>
      )}
    </>
  );
}
