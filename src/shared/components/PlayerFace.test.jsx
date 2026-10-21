// @vitest-environment jsdom
//
// A row's face is the one the table's share-out gave that seat — found by id,
// so a list that only carries `{ id, name }` still shows it.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import PlayerFace from './PlayerFace';
import TablePortraits from './TablePortraits';

const pic = (name, favourites) => ({ name, favourites, imageUrl: `https://img.test/${name}.jpg` });
const players = [
  { id: 'ann', name: 'Ann', portraitKey: 'power', animeList: [{ title: 'S', characters: [pic('Makima', 9), pic('Power', 5)] }] },
  { id: 'ben', name: 'Ben', animeList: [{ title: 'S', characters: [pic('Power', 5), pic('Aki', 4)] }] },
];

afterEach(cleanup);

describe('a face beside a name', () => {
  it("is the seat's face, looked up by id alone", () => {
    const { container } = render(
      <TablePortraits players={players}>
        <PlayerFace player={{ id: 'ann', name: 'Ann' }} />
        <PlayerFace player={{ id: 'ben', name: 'Ben' }} />
      </TablePortraits>,
    );
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    // Ann chose Power; Ben's Power is taken, so he wears Aki — exactly as his seat does.
    expect(srcs).toEqual(['https://img.test/Power.jpg', 'https://img.test/Aki.jpg']);
  });

  it('is hidden from screen readers, and draws nothing with no player', () => {
    const { container } = render(
      <TablePortraits players={players}>
        <PlayerFace player={{ id: 'ann', name: 'Ann' }} />
        <PlayerFace player={null} />
      </TablePortraits>,
    );
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild.getAttribute('aria-hidden')).toBe('true');
  });
});
