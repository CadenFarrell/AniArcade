import LapsSetting from '../../../shared/components/LapsSetting';
import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox, Field, NumberInput } from '../../../shared/ui';
import { CHOICES_RANGE, DEFAULT_PREFS, DRAW_SECONDS } from '../prefs';
import { DRAWER_PER_GUESSER, GUESS_MAX, GUESS_MIN } from '../rules';

/**
 * AniSketch's Settings card, rendered by both the local setup screen and the
 * online lobby. Nothing in it is local- or online-only; `host` adds the
 * lobby's "your settings apply to everyone". One `onChange(key, value)`,
 * because the lobby's settings object is what leaves the host's device.
 */
export default function AniSketchSettings({ values, playerCount, onChange, onReset, host = false }) {
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <LapsSetting id="anisketch-laps" value={values.laps} playerCount={playerCount} role="the drawer" onChange={onChange} />

      <div className="mb-2">
        <span id="anisketch-time-label" className="mb-1.5 block font-display text-sm font-bold uppercase tracking-wide text-fg-strong">
          Drawing time
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="anisketch-time-label">
          {DRAW_SECONDS.map((s) => {
            const on = values.drawSeconds === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                aria-label={`${s} seconds`}
                onClick={() => onChange('drawSeconds', s)}
                className={`focus-pop rounded-pop-sm border-2 px-3 py-1.5 font-display font-bold
                  ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface text-fg-strong hover:border-line-loud'}`}
              >
                {s}s
              </button>
            );
          })}
        </div>
      </div>
      <SettingHelp className="mb-5" more={`A right guess scores up to ${GUESS_MAX}, less the longer the clock has run (never under ${GUESS_MIN}), and the drawer scores ${DRAWER_PER_GUESSER} for everyone who names it.`}>
        How long each drawing has.
      </SettingHelp>

      <Field label="Characters to choose from" htmlFor="anisketch-choices" className="mb-2">
        <NumberInput
          id="anisketch-choices"
          ariaLabel="Characters to choose from"
          min={CHOICES_RANGE.min}
          max={CHOICES_RANGE.max}
          value={values.choices}
          onChange={(v) => onChange('choices', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more="All of them off the drawer’s own list, so they know who they are drawing. A character drawn once does not come round again this game.">
        The drawer picks one to draw.
      </SettingHelp>

      {host && <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>}

      <MoreSettings>
        <Checkbox
          label="Characters others know first"
          checked={values.sharedFirst}
          onChange={(e) => onChange('sharedFirst', e.target.checked)}
          className="mb-2"
        />
        <SettingHelp indent more="A drawing nobody could name is a turn nobody scores. When the drawer's list has too few the others know, the rest of it fills the offer.">
          Offer characters someone else at the table also has on their list.
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
