import { describe, expect, it } from 'vitest';
import { buildCrashReport, crashSignature, isOwnError } from './crashReport';
import { LIMITS, trimFields } from './reports';

const ORIGIN = 'https://aniarcade.web.app';

function errorWithStack(message, stack) {
  const e = new Error(message);
  e.stack = stack;
  return e;
}

describe('crash reports', () => {
  it('fingerprints a crash by its message and first frame, so a repeat is one report', () => {
    const a = errorWithStack('boom', `Error: boom\n    at Tile (${ORIGIN}/assets/index-abc.js:1:20)\n    at x`);
    const b = errorWithStack('boom', `Error: boom\n    at Tile (${ORIGIN}/assets/index-abc.js:1:20)\n    at y`);
    const c = errorWithStack('boom', `Error: boom\n    at Board (${ORIGIN}/assets/index-abc.js:9:4)`);
    expect(crashSignature(a)).toBe(crashSignature(b));
    expect(crashSignature(a)).not.toBe(crashSignature(c));
    // Something thrown that is not an Error still has a signature.
    expect(crashSignature('plain string')).toContain('plain string');
  });

  it('carries the page path but never the query an invite code rides in', () => {
    const fields = buildCrashReport(new Error('x'), { gameId: 'anipeek', componentStack: '\n  in Board\n' }, {
      pathname: '/',
      userAgent: 'Test/1.0',
    });
    expect(fields).toMatchObject({ message: 'x', gameId: 'anipeek', componentStack: 'in Board', path: '/', ua: 'Test/1.0' });
    expect(JSON.stringify(fields)).not.toMatch(/join=|\?/);
  });

  it('reports only errors whose stack runs through this site', () => {
    expect(isOwnError(errorWithStack('a', `at f (${ORIGIN}/assets/index-abc.js:1:1)`), ORIGIN)).toBe(true);
    expect(isOwnError(errorWithStack('a', `at f (${ORIGIN}/src/hub/HubScreen.jsx:1:1)`), ORIGIN)).toBe(true);
    expect(isOwnError(errorWithStack('a', 'at f (chrome-extension://abc/content.js:1:1)'), ORIGIN)).toBe(false);
    // No stack at all ("Script error.", a ResizeObserver notice): nothing to act on.
    expect(isOwnError({ message: 'Script error.' }, ORIGIN)).toBe(false);
    expect(isOwnError(undefined, ORIGIN)).toBe(false);
  });

  it('cuts every field to the cap its database rule enforces, and drops empty ones', () => {
    const out = trimFields({ message: 'm'.repeat(1000), stack: '', gameId: undefined, text: 't'.repeat(5000) });
    expect(out.message).toHaveLength(LIMITS.message);
    expect(out.text).toHaveLength(LIMITS.text);
    expect(out).not.toHaveProperty('stack');
    expect(out).not.toHaveProperty('gameId');
    // A field the rules do not know is dropped rather than refused by them.
    expect(trimFields({ secret: 'x' })).toEqual({});
  });
});
