// @vitest-environment jsdom
//
// The card both AniGuess setup screens render. What it must get right is the
// split between them — the timer and talk mode exist only on a shared device,
// and the lobby carries the host note instead — plus reporting every change as
// one (key, value) the screens can spread into the settings they start with.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AniGuessSettings from './AniGuessSettings';
import { DEFAULT_PREFS } from '../prefs';
import { openMoreSettings, renderArcade } from '../../../shared/testing/arcade';

afterEach(cleanup);

const LOCAL_ONLY = [/enable timer/i, /talk it out/i];

function mount(props) {
  const onChange = vi.fn();
  renderArcade(
    <AniGuessSettings values={DEFAULT_PREFS} onChange={onChange} onReset={() => {}} {...props} />
  );
  return onChange;
}

describe('AniGuessSettings', () => {
  it('offers the timer and talk mode on a shared device, with no host note', () => {
    mount({ local: true });
    for (const label of LOCAL_ONLY) expect(screen.getByRole('checkbox', { name: label })).toBeTruthy();
    expect(screen.queryByText(/you're the host/i)).toBeNull();
  });

  it('drops them online and tells the host their settings apply to everyone', () => {
    mount({ local: false });
    for (const label of LOCAL_ONLY) expect(screen.queryByRole('checkbox', { name: label })).toBeNull();
    expect(screen.getByText(/you're the host/i)).toBeTruthy();
  });

  it('shows the seconds stepper only while the timer is on', () => {
    mount({ local: true });
    expect(screen.queryByRole('textbox', { name: /timer seconds/i })).toBeNull();
    cleanup();
    mount({ local: true, values: { ...DEFAULT_PREFS, timerEnabled: true } });
    expect(screen.getByRole('textbox', { name: /timer seconds/i })).toBeTruthy();
  });

  it('reports each option as one key and value', async () => {
    const user = userEvent.setup();
    const onChange = mount({ local: false });
    await user.click(screen.getByRole('checkbox', { name: /shared shows only/i }));
    expect(onChange).toHaveBeenLastCalledWith('sharedShowsOnly', !DEFAULT_PREFS.sharedShowsOnly);
    // The randomizer lives under the fold (shared/components/MoreSettings).
    await openMoreSettings(user);
    await user.click(screen.getByRole('checkbox', { name: /anime-first/i }));
    expect(onChange).toHaveBeenLastCalledWith('twoStepRandom', !DEFAULT_PREFS.twoStepRandom);
  });

  it('writes a points slot into a fresh array, leaving the others alone', async () => {
    const user = userEvent.setup();
    const before = [...DEFAULT_PREFS.pointsPerPosition];
    const onChange = mount({ local: false });
    await openMoreSettings(user);
    await user.click(screen.getByRole('button', { name: /increase points for 2nd place/i }));
    const [key, value] = onChange.mock.lastCall;
    expect(key).toBe('pointsPerPosition');
    expect(value).toEqual([before[0], before[1] + 1, before[2], before[3]]);
    // The screens hold DEFAULT_PREFS' array in state after a reset; writing into
    // it would change the defaults for the rest of the session.
    expect(DEFAULT_PREFS.pointsPerPosition).toEqual(before);
  });
});
