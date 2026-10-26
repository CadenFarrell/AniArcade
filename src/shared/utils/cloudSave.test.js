import { describe, expect, it } from 'vitest';
import {
  CODE_LENGTH, buildRestoreUrl, cleanSave, countNewProfiles, formatCode, hashSave, makeCode,
  mergeSaves, normalizeCode, parseSave, readRestore, serializeSave, stripRestore, syncedLabel,
} from './cloudSave';
import { CODE_CHARS } from './codeAlphabet';
import { MAX_PER_PROFILE } from './history';

const prof = (id, savedAt, extra = {}) => ({ id, name: id, animeList: [], ...(savedAt != null ? { savedAt } : {}), ...extra });
const line = (at, game = 'aniguess', fp = `fp${at}`) => ({ at, game, won: false, place: null, size: 2, with: ['X'], fp });

describe('codes', () => {
  it('makes 16 characters from the alphabet, using every byte value', () => {
    const code = makeCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect([...code].every((c) => CODE_CHARS.includes(c))).toBe(true);
    // 0..255 masked to five bits lands on every symbol.
    const bytes = (n) => Uint8Array.from({ length: n }, (_, i) => i * 17);
    expect(makeCode(bytes)).toMatch(/^[A-Z2-9]{16}$/);
  });

  it('is 32 symbols, so a masked byte has no bias', () => {
    expect(CODE_CHARS).toHaveLength(32);
  });

  it('reads a code however it was typed', () => {
    const code = 'ABCDEFGHJKLMNPQR';
    expect(normalizeCode(code)).toBe(code);
    expect(normalizeCode(formatCode(code))).toBe(code);
    expect(normalizeCode(' abcd-efgh jklm-npqr ')).toBe(code);
  });

  it('refuses anything that cannot be a code', () => {
    expect(normalizeCode('ABCDEFGHJKLMNPQ')).toBeNull(); // 15
    expect(normalizeCode('ABCDEFGHJKLMNPQRS')).toBeNull(); // 17
    expect(normalizeCode('ABCDEFGHJKLMNPQ0')).toBeNull(); // ambiguous 0
    expect(normalizeCode('ABCDEFGHJKLMNPQI')).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });

  it('groups a code in fours', () => {
    expect(formatCode('ABCDEFGHJKLMNPQR')).toBe('ABCD-EFGH-JKLM-NPQR');
  });
});

describe('restore links', () => {
  const code = 'ABCDEFGHJKLMNPQR';

  it('round-trips a code through a link', () => {
    const url = buildRestoreUrl('https://arcade.example/some/path?x=1', code);
    expect(url).toBe('https://arcade.example/?restore=ABCD-EFGH-JKLM-NPQR');
    expect(readRestore(new URL(url).search)).toBe(code);
  });

  it('reads nothing from a link without one, or with a broken one', () => {
    expect(readRestore('?game=aniturf&join=ABCDE')).toBeNull();
    expect(readRestore('?restore=nope')).toBeNull();
  });

  it('strips only the restore param', () => {
    expect(stripRestore('https://a.example/?restore=X&game=aniturf')).toBe('https://a.example/?game=aniturf');
    expect(stripRestore('https://a.example/?game=aniturf')).toBeNull();
  });
});

describe('the save string', () => {
  it('round-trips what RTDB would have mangled', () => {
    const save = {
      profiles: {
        'dr._stone/fan#1': prof('dr._stone/fan#1', 5, { animeList: [{ id: 'a', title: 'A', characters: [] }], anilistImportedIds: [] }),
      },
      activeId: 'dr._stone/fan#1',
      history: { 'dr._stone/fan#1': [line(1)] },
      deleted: {},
    };
    const back = parseSave(serializeSave(save));
    expect(back.profiles['dr._stone/fan#1'].animeList[0].characters).toEqual([]);
    expect(back.profiles['dr._stone/fan#1'].anilistImportedIds).toEqual([]);
    expect(back.activeId).toBe('dr._stone/fan#1');
    expect(back.history['dr._stone/fan#1']).toHaveLength(1);
  });

  it('serializes the same data the same way whatever order it was built in', () => {
    const one = { profiles: { a: prof('a', 1), b: prof('b', 2) }, history: {}, deleted: {} };
    const two = { profiles: { b: prof('b', 2), a: prof('a', 1) }, history: {}, deleted: {} };
    expect(serializeSave(one)).toBe(serializeSave(two));
    expect(hashSave(serializeSave(one))).toBe(hashSave(serializeSave(two)));
  });

  it('survives garbage', () => {
    expect(parseSave('not json')).toBeNull();
    expect(cleanSave({ profiles: { a: 'x', b: { id: 'wrong' }, c: prof('c', 1) }, deleted: { d: 'soon' } }))
      .toEqual({ profiles: { c: prof('c', 1) }, activeId: null, history: {}, deleted: {} });
  });

  it('hashes different saves differently', () => {
    expect(hashSave('{"a":1}')).not.toBe(hashSave('{"a":2}'));
  });
});

describe('mergeSaves', () => {
  it('keeps every profile either side has', () => {
    const merged = mergeSaves({ profiles: { a: prof('a', 1) } }, { profiles: { b: prof('b', 1) } });
    expect(Object.keys(merged.profiles).sort()).toEqual(['a', 'b']);
  });

  it('takes the newer copy of a profile both sides have, whole', () => {
    const local = { profiles: { a: prof('a', 10, { name: 'Old', portraitKey: 'k' }) } };
    const remote = { profiles: { a: prof('a', 20, { name: 'New' }) } };
    expect(mergeSaves(local, remote).profiles.a).toEqual(prof('a', 20, { name: 'New' }));
    expect(mergeSaves(remote, local).profiles.a.name).toBe('New');
  });

  it('gives a tie to the local copy', () => {
    const merged = mergeSaves({ profiles: { a: prof('a', 5, { name: 'Mine' }) } }, { profiles: { a: prof('a', 5, { name: 'Theirs' }) } });
    expect(merged.profiles.a.name).toBe('Mine');
  });

  it('reads a profile from before savedAt as oldest', () => {
    const merged = mergeSaves({ profiles: { a: prof('a', null, { name: 'Unstamped' }) } }, { profiles: { a: prof('a', 1) } });
    expect(merged.profiles.a.savedAt).toBe(1);
  });

  it('lets a delete beat every copy saved before it', () => {
    const merged = mergeSaves(
      { profiles: {}, deleted: { a: 100 } },
      { profiles: { a: prof('a', 50), b: prof('b', 50) } },
    );
    expect(Object.keys(merged.profiles)).toEqual(['b']);
    expect(merged.deleted).toEqual({ a: 100 });
  });

  it('beats a profile from before savedAt too', () => {
    expect(mergeSaves({ deleted: { a: 1 } }, { profiles: { a: prof('a', null) } }).profiles).toEqual({});
  });

  it('keeps a profile re-made after its delete', () => {
    const merged = mergeSaves({ profiles: { a: prof('a', 200) } }, { deleted: { a: 100 } });
    expect(merged.profiles.a.savedAt).toBe(200);
  });

  it('carries the later of two markers for one id', () => {
    expect(mergeSaves({ deleted: { a: 5 } }, { deleted: { a: 9 } }).deleted.a).toBe(9);
  });

  it('unions history once per line, in time order', () => {
    const merged = mergeSaves(
      { history: { a: [line(1), line(3)] } },
      { history: { a: [line(2), line(3)], b: [line(4)] } },
    );
    expect(merged.history.a.map((e) => e.at)).toEqual([1, 2, 3]);
    expect(merged.history.b).toHaveLength(1);
  });

  it('trims a merged history to the cap, newest kept', () => {
    const many = (from) => Array.from({ length: MAX_PER_PROFILE }, (_, i) => line(from + i));
    const merged = mergeSaves({ history: { a: many(0) } }, { history: { a: many(1000) } });
    expect(merged.history.a).toHaveLength(MAX_PER_PROFILE);
    expect(merged.history.a[0].at).toBe(1000);
  });

  it("keeps this device's main profile, and adopts the save's only when it has none", () => {
    const profiles = { a: prof('a', 1), b: prof('b', 1) };
    expect(mergeSaves({ profiles, activeId: 'a' }, { profiles, activeId: 'b' }).activeId).toBe('a');
    expect(mergeSaves({ activeId: null }, { profiles, activeId: 'b' }).activeId).toBe('b');
    // A pointer at a profile the merge dropped is no pointer at all.
    expect(mergeSaves({ activeId: 'a', deleted: { a: 9 } }, { profiles: { a: prof('a', 1) } }).activeId).toBeNull();
  });

  it('is stable: merging a save with itself changes nothing', () => {
    const save = { profiles: { a: prof('a', 1) }, activeId: 'a', history: { a: [line(1)] }, deleted: { z: 3 } };
    expect(serializeSave(mergeSaves(save, save))).toBe(serializeSave(save));
  });

  it('says how long ago the last backup was', () => {
    const now = 10 * 86_400_000;
    expect(syncedLabel(now - 5_000, now)).toBe('just now');
    expect(syncedLabel(now - 4 * 60_000, now)).toBe('4 min ago');
    expect(syncedLabel(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(syncedLabel(now - 3 * 86_400_000, now)).toMatch(/^on /);
    expect(syncedLabel(null, now)).toBeNull();
  });

  it('counts the profiles a restore brought', () => {
    const before = { profiles: { a: prof('a', 1) } };
    const after = { profiles: { a: prof('a', 1), b: prof('b', 1), c: prof('c', 1) } };
    expect(countNewProfiles(before, after)).toBe(2);
  });
});
