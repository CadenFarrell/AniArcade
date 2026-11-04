// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { inertOutside } from './inertOutside';

// jsdom keeps the attribute and implements none of inert's behaviour, which is
// fine here: what this module owns is WHICH nodes carry it, and when.
const page = (html) => { document.body.innerHTML = html; };
const $ = (sel) => document.querySelector(sel);
const inert = (sel) => $(sel).hasAttribute('inert');
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => { document.body.innerHTML = ''; });

describe('inertOutside', () => {
  it('marks every sibling up the chain and leaves the chain to the dialog live', () => {
    page(`
      <header id="bar"><button>Hub</button></header>
      <main id="root">
        <section id="screen"><button id="behind">Write your own</button>
          <div id="dialog" aria-modal="true"><button id="inside">Save</button></div>
        </section>
        <aside id="side"></aside>
      </main>
      <script id="s"></script>`);
    const undo = inertOutside($('#dialog'));
    expect(['#bar', '#behind', '#side'].map(inert)).toEqual([true, true, true]);
    expect(['#root', '#screen', '#dialog', '#inside'].map(inert)).toEqual([false, false, false, false]);
    expect(inert('#s')).toBe(false);
    undo();
    expect(document.querySelectorAll('[inert]').length).toBe(0);
  });

  it('leaves alone what was inert before it, so a dialog on top hands the page back to the one under it', async () => {
    page(`
      <main id="page"><button>Behind</button></main>
      <div id="old" aria-modal="true"><button>Old</button></div>`);
    const undoOld = inertOutside($('#old'));
    expect(inert('#page')).toBe(true);
    // A second dialog opens beside the first (HubScreen's rules sheet and
    // feedback box are siblings): the first leaves it alone, and its own walk
    // marks the first and skips the page, which is already inert.
    const next = document.createElement('div');
    next.id = 'new';
    next.setAttribute('aria-modal', 'true');
    document.body.appendChild(next);
    await tick();
    expect(inert('#new')).toBe(false);
    const undoNew = inertOutside($('#new'));
    expect(inert('#old')).toBe(true);
    undoNew();
    expect(inert('#old')).toBe(false);
    expect(inert('#page')).toBe(true); // still the older dialog's
    undoOld();
    expect(inert('#page')).toBe(false);
  });

  it('marks a node that arrives later, but never a newer dialog', async () => {
    page('<main id="root"><div id="dialog" aria-modal="true"></div></main>');
    const undo = inertOutside($('#dialog'));
    const screen = document.createElement('section');
    screen.id = 'swapped';
    $('#root').appendChild(screen);
    const feedback = document.createElement('div');
    feedback.id = 'feedback';
    feedback.innerHTML = '<div aria-modal="true"></div>';
    document.body.appendChild(feedback);
    await tick();
    expect(inert('#swapped')).toBe(true);
    expect(inert('#feedback')).toBe(false);
    undo();
    expect(inert('#swapped')).toBe(false);
    // Disconnected: nothing arriving after the undo is touched.
    const late = document.createElement('p');
    late.id = 'late';
    $('#root').appendChild(late);
    await tick();
    expect(inert('#late')).toBe(false);
  });
});
