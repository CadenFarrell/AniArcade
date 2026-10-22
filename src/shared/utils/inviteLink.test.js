import { describe, it, expect } from 'vitest';
import { buildInviteUrl, readInvite, stripInvite } from './inviteLink';

const IDS = ['aniguess', 'aniturf'];

describe('invite links', () => {
  it('round-trips a game and a code', () => {
    const url = buildInviteUrl('https://aniguess-a08f7.web.app/some/path', 'aniturf', 'ABCDE');
    expect(url).toBe('https://aniguess-a08f7.web.app/?game=aniturf&join=ABCDE');
    expect(readInvite(new URL(url).search, IDS)).toEqual({ gameId: 'aniturf', code: 'ABCDE' });
  });

  it('accepts a code typed in lower case', () => {
    expect(readInvite('?game=aniguess&join=abc23', IDS)).toEqual({ gameId: 'aniguess', code: 'ABC23' });
  });

  it('ignores a link to an unknown game, a missing code, or a code no room can have', () => {
    expect(readInvite('?game=pacman&join=ABCDE', IDS)).toBe(null);
    expect(readInvite('?game=aniguess', IDS)).toBe(null);
    expect(readInvite('?game=aniguess&join=ABCD', IDS)).toBe(null);
    // 0, O, 1 and I are not in the room-code alphabet.
    expect(readInvite('?game=aniguess&join=ABCD0', IDS)).toBe(null);
    expect(readInvite('?game=aniguess&join=ABCDI', IDS)).toBe(null);
    expect(readInvite('', IDS)).toBe(null);
  });

  it('strips only its own parameters, and reports when there was nothing to strip', () => {
    expect(stripInvite('https://x.app/?game=aniguess&join=ABCDE&utm=chat')).toBe('https://x.app/?utm=chat');
    expect(stripInvite('https://x.app/?game=aniguess&join=ABCDE')).toBe('https://x.app/');
    expect(stripInvite('https://x.app/')).toBe(null);
  });
});
