import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOWTO_KEY, markHowToSeen, readHowToSeen } from './howToSeen';

// Node has no localStorage; a Map behind the same three methods is all the
// module touches.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('howToSeen', () => {
  it('remembers each game separately, once', () => {
    expect(readHowToSeen('anipeek')).toBe(false);
    markHowToSeen('anipeek');
    markHowToSeen('anipeek');
    expect(readHowToSeen('anipeek')).toBe(true);
    expect(readHowToSeen('aniturf')).toBe(false);
    expect(JSON.parse(localStorage.getItem(HOWTO_KEY))).toEqual(['anipeek']);
  });

  it('reads a corrupt value as nothing seen, and recovers on the next mark', () => {
    localStorage.setItem(HOWTO_KEY, '{not json');
    expect(readHowToSeen('anipeek')).toBe(false);
    markHowToSeen('anipeek');
    expect(readHowToSeen('anipeek')).toBe(true);
  });

  it('shows the sheet again rather than throwing when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(readHowToSeen('anipeek')).toBe(false);
    expect(() => markHowToSeen('anipeek')).not.toThrow();
  });
});
