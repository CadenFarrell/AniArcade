// @vitest-environment jsdom
//
// The backup code's screen half, over a hand-made context value: the sync
// itself is the smoke suite's (smoke/cloudSave.smoke.test.js), which runs it
// against the emulator's real rules.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackupPanel from './BackupPanel';
import { CloudSaveContext } from '../context/cloudSaveContext';

afterEach(cleanup);

const cloud = (over = {}) => ({
  available: true, code: null, status: 'off', lastSyncedAt: null, version: 0,
  enable: vi.fn(), restore: vi.fn(), disconnect: vi.fn(), ...over,
});

const mount = (value, props = {}) => render(
  <CloudSaveContext.Provider value={value}><BackupPanel {...props} /></CloudSaveContext.Provider>
);

describe('BackupPanel', () => {
  it('draws nothing in a build with nowhere to keep a backup', () => {
    const { container } = mount(cloud({ available: false }));
    expect(container.innerHTML).toBe('');
  });

  it('draws nothing outside a provider, too', () => {
    const { container } = render(<BackupPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('turns backup on', async () => {
    const value = cloud();
    mount(value);
    await userEvent.click(screen.getByRole('button', { name: 'Turn on backup' }));
    expect(value.enable).toHaveBeenCalledOnce();
  });

  it('shows the code grouped in fours, with how long ago it last backed up', () => {
    mount(cloud({ code: 'ABCDEFGHJKLMNPQR', status: 'ok', lastSyncedAt: Date.now() }));
    expect(screen.getByText('ABCD-EFGH-JKLM-NPQR')).toBeTruthy();
    expect(screen.getByText('Backed up just now')).toBeTruthy();
    expect(screen.queryByLabelText('Have a backup code?')).toBeNull();
  });

  it('says why a code was refused', async () => {
    const user = userEvent.setup();
    const value = cloud({ restore: vi.fn(async () => ({ status: 'not-found' })) });
    mount(value);
    await user.type(screen.getByLabelText('Have a backup code?'), 'abcd-efgh-jklm-npqr');
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(value.restore).toHaveBeenCalledWith('abcd-efgh-jklm-npqr');
    expect((await screen.findByRole('alert')).textContent).toMatch(/no backup under that code/);
  });

  it('hands a good restore on', async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    mount(cloud({ restore: vi.fn(async () => ({ status: 'ok', restored: 2 })) }), { showEnable: false, onRestored });
    expect(screen.queryByRole('button', { name: 'Turn on backup' })).toBeNull();
    await user.type(screen.getByLabelText('Have a backup code?'), 'ABCDEFGHJKLMNPQR{Enter}');
    expect(onRestored).toHaveBeenCalledWith({ status: 'ok', restored: 2 });
    expect(screen.getByText('Restored — 2 profiles added.')).toBeTruthy();
  });
});
