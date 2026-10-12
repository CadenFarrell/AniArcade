import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox } from '../../../shared/ui';
import { SETTING_HELP, sharedOnlyHelp } from '../help';
import { DEFAULT_PREFS } from '../prefs';

/**
 * AniRank's ⚙️ Settings card, rendered by both AniRankSetup and the online
 * lobby. AniTagSettings and AniTuneSettings are the precedent: two hand-kept
 * copies of one card drift an edit at a time, invisibly until somebody plays the
 * other half.
 *
 * Only the CARD is shared. The format card and the axis state around it are
 * not, and that is deliberate rather than unfinished: local play offers three
 * formats and the lobby two (see the lobby's note on `comparing`), and the
 * blind flag is reset by an axis change on both screens, so the state has to
 * live with the axis it is coupled to.
 *
 * `tiering` hides blind and scoring rather than greying them: a tier list has
 * no deal to make blind and no answer key to score against, and a
 * visible-but-inert checkbox is worse than one that is not there. The lobby
 * never passes it — it renders this card only for a round.
 *
 * `remembered` is what the footer compares against the defaults — the id-shaped
 * prefs, never the axis spec, for resolveSavedAxis' reason.
 */
export default function AniRankSettings({
  values, onChange, noun, tiering = false, remembered, onReset, hostNote = false,
}) {
  const { sharedOnly, blind, scoring } = values;
  // Both halves depend on the pool AND the format, so they are resolved together
  // rather than branched twice at the call site. See help.js.
  const sharedHelp = sharedOnlyHelp({ noun, tiering });

  return (
    <Card title="⚙️ Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Checkbox
        label={`Shared ${noun} only`}
        checked={sharedOnly}
        onChange={(e) => onChange('sharedOnly', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp indent className="mb-4" more={sharedHelp.more}>
        {sharedHelp.short}
      </SettingHelp>

      {!tiering && (
        <>
          <Checkbox
            label="Blind ranking"
            checked={blind}
            onChange={(e) => onChange('blind', e.target.checked)}
            className="mb-2"
          />
          <SettingHelp indent className="mb-4" more={SETTING_HELP.blind.more}>
            {SETTING_HELP.blind.short}
          </SettingHelp>

          <Checkbox
            label="Keep score"
            checked={scoring}
            onChange={(e) => onChange('scoring', e.target.checked)}
            className="mb-2"
          />
          <SettingHelp indent more={SETTING_HELP.scoring.more}>
            {SETTING_HELP.scoring.short}
          </SettingHelp>
        </>
      )}

      {hostNote && (
        <p className="mt-4 text-sm text-fg-subtle">
          You&apos;re the host — your settings apply to everyone.
        </p>
      )}

      <SettingsFooter values={remembered} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
