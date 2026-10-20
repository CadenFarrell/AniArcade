import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART } from './credits';

// Every failure here is a silent one in the browser: a print that is missing
// renders an empty panel, and a 404 under /art/ is not a console error anybody
// reads.
const PUBLIC = new URL('../../../public', import.meta.url);

describe('the prints', () => {
  it.each(Object.entries(ART))('%s ships its file and is a public-domain museum object', (_key, art) => {
    expect(existsSync(new URL(`.${art.src}`, `${PUBLIC.href}/`))).toBe(true);
    expect(art.licence).toBe('Public domain (CC0)');
    expect(art.url).toMatch(/^https:\/\/www\.metmuseum\.org\//);
  });
});
