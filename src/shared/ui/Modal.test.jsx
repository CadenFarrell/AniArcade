// @vitest-environment jsdom
//
// What an open dialog does to the page behind it, and to focus. The page goes
// inert (shared/utils/inertOutside.js has why), focus moves into the dialog
// unless something there already took it, and closing hands both back. jsdom
// keeps `inert` as an attribute and implements none of its behaviour, so these
// assert the attribute and the focused element, which are what this owns.
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import Modal from './Modal';

afterEach(cleanup);

function Page({ autoFocusInside = false }) {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button onClick={() => setOpen(true)}>Write your own</button>
      <button>Suggest</button>
      {open && (
        <Modal onClose={() => setOpen(false)} sound={null}>
          <input aria-label="Left end" autoFocus={autoFocusInside} />
          <button onClick={() => setOpen(false)}>Done</button>
        </Modal>
      )}
    </main>
  );
}

describe('Modal', () => {
  it('makes the page behind inert, takes focus, and gives both back on close', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Write your own' });
    await user.click(opener);

    expect(screen.getByRole('button', { name: 'Suggest' }).closest('[inert]')).toBeTruthy();
    expect(opener.closest('[inert]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' }).closest('[inert]')).toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('leaves focus on a field inside that took it first', async () => {
    const user = userEvent.setup();
    render(<Page autoFocusInside />);
    await user.click(screen.getByRole('button', { name: 'Write your own' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Left end' }));
  });

  it('closes on Escape and returns focus the same way', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Write your own' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
