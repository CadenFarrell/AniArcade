// @vitest-environment jsdom
//
// The in-game "are you sure?"s that replaced window.confirm: PauseScreen for
// leaving a game (through HubButton's `confirm`), ConfirmDialog for the rest,
// and useConfirm's scope, which drops a question the room has moved past.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoverGameContext } from '../context/coverGameContext';
import { useConfirm } from '../hooks/useConfirm';
import HubButton from './HubButton';
import Modal from './Modal';

afterEach(cleanup);

const hub = () => screen.getByRole('button', { name: /^\s*hub\s*$/i });

describe('HubButton with a confirm', () => {
  it('leaves at once when there is nothing to lose', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HubButton onClick={onClick} />);
    await user.click(hub());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pauses the game instead of asking the browser', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const browserConfirm = vi.spyOn(window, 'confirm');
    render(
      <main>
        <HubButton onClick={onClick} confirm="This game will be lost." />
        <button>Next song</button>
      </main>,
    );
    await user.click(hub());

    const sheet = screen.getByRole('dialog', { name: 'Leave the game?' });
    expect(sheet.textContent).toContain('This game will be lost.');
    expect(onClick).not.toHaveBeenCalled();
    expect(browserConfirm).not.toHaveBeenCalled();
    // The safe answer has focus, and the game behind is out of reach.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.getByRole('button', { name: 'Next song', hidden: true }).closest('[inert]')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Next song' }).closest('[inert]')).toBeNull();

    await user.click(hub());
    await user.click(screen.getByRole('button', { name: 'Leave to the hub' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    browserConfirm.mockRestore();
  });

  it('keeps playing on Escape', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HubButton onClick={onClick} confirm="This game will be lost." />);
    await user.click(hub());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('takes a title as well as a message, and wears the open game’s ink', async () => {
    const user = userEvent.setup();
    render(
      <CoverGameContext.Provider value={{ id: 'aniwave', accent: 'purple', kana: 'アニウェーブ' }}>
        <HubButton onClick={() => {}} confirm={{ title: 'Leave the room?', message: 'You can rejoin.' }} />
      </CoverGameContext.Provider>,
    );
    await user.click(hub());
    const sheet = screen.getByRole('dialog', { name: 'Leave the room?' });
    expect(sheet.textContent).toContain('You can rejoin.');
    expect(sheet.querySelector('.bg-pop-purple')).toBeTruthy();
  });
});

// A delete asked from inside another dialog (the profile picker, an editor).
function Editor({ onDelete, onClose }) {
  const { ask, dialog } = useConfirm();
  return (
    <>
      <Modal onClose={onClose} sound={null}>
        <h2>Edit prompt</h2>
        <button
          onClick={() => ask({ title: 'Delete “Best fights”?', confirmLabel: 'Delete prompt', cancelLabel: 'Keep', onConfirm: onDelete })}
        >
          Delete
        </button>
      </Modal>
      {dialog}
    </>
  );
}

describe('ConfirmDialog over another dialog', () => {
  it('Escape closes only the dialog on top', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<Editor onDelete={onDelete} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete “Best fights”?' })).toBeTruthy();
    // Cancel is first and focused: a stray Enter keeps the prompt.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Delete “Best fights”?' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete prompt' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Delete prompt' })).toBeNull();
  });
});

// A host's question left open while the room moves on. `phase` stands in for
// the room's round and phase, which the test moves by re-rendering.
function HostControls({ phase, onAbandon }) {
  const { ask, dialog } = useConfirm(phase);
  return (
    <main>
      <button onClick={() => ask({ title: 'Abandon this round?', confirmLabel: 'Abandon round', onConfirm: onAbandon })}>
        Abandon this round
      </button>
      {dialog}
    </main>
  );
}

describe('useConfirm scope', () => {
  it('drops a question once the round it was about has moved on', async () => {
    const user = userEvent.setup();
    const onAbandon = vi.fn();
    const { rerender } = render(<HostControls phase="guess:1" onAbandon={onAbandon} />);
    await user.click(screen.getByRole('button', { name: 'Abandon this round' }));
    expect(screen.getByRole('dialog', { name: 'Abandon this round?' })).toBeTruthy();

    rerender(<HostControls phase="reveal:1" onAbandon={onAbandon} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    // And it does not come back if the scope ever matches again.
    await user.click(screen.getByRole('button', { name: 'Abandon this round' }));
    rerender(<HostControls phase="guess:2" onAbandon={onAbandon} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAbandon).not.toHaveBeenCalled();
  });
});
