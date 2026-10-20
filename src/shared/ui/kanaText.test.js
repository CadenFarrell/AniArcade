import { describe, expect, it } from 'vitest';
import { KANA, KANA_GLYPHS } from './kanaText';
import { games } from '../../hub/registry';

// public/fonts/delagothicone-kana.woff2 holds ONLY these glyphs, and a character
// outside the set does not fail — the browser silently draws it in a system
// font, mid-word. This is the only place that can notice.
const missing = (text) => [...text].filter((ch) => !KANA_GLYPHS.includes(ch));

describe('kana glyph coverage', () => {
  it.each(Object.entries(KANA))('KANA.%s is fully covered by the font cut', (_key, text) => {
    expect(missing(text)).toEqual([]);
  });

  it.each(games.map((g) => [g.id, g.kana]))('%s has a covered katakana name', (_id, kana) => {
    expect(typeof kana).toBe('string');
    expect(kana.length).toBeGreaterThan(0);
    expect(missing(kana)).toEqual([]);
  });

  it('matches the unicode-range the font was cut with', () => {
    // The katakana block plus べ を 中 選 — the @font-face rule
    // in index.css declares exactly this range; growing one without the other
    // leaves the new glyph out of the file.
    expect(KANA_GLYPHS).toHaveLength(0x30ff - 0x30a0 + 1 + 4);
  });
});
