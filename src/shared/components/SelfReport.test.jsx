// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sound', () => ({ playSound: vi.fn(), playCue: vi.fn() }));
const { default: SelfReport } = await import('./SelfReport');

const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cat' }];

afterEach(cleanup);

describe('SelfReport', () => {
  it('hands back exactly the players ticked', async () => {
    const onDone = vi.fn();
    render(<SelfReport players={players} onDone={onDone} />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Done' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /Ann got it/ }));
    await user.click(screen.getByRole('button', { name: /Cat got it/ }));
    await user.click(screen.getByRole('button', { name: /Ann got it/ }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledWith(['c']);
  });

  it('"Nobody got it" is its own answer', async () => {
    const onDone = vi.fn();
    render(<SelfReport players={players} onDone={onDone} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Nobody got it' }));
    expect(onDone).toHaveBeenCalledWith([]);
  });
});
