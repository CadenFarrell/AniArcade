import { describe, it, expect } from 'vitest';
import { autoSeat, normalizeLastTables, rankCompanions, rememberedIds } from './autoSeat';

const profile = (name, lastUsedAt = 0) => ({ id: name.toLowerCase().replace(/\s+/g, '_'), name, lastUsedAt });
const mapOf = (...list) => Object.fromEntries(list.map((p) => [p.id, p]));
const names = (seated) => seated.map((p) => p.name);

const caden = profile('Caden', 50);
const ayu = profile('Ayu', 40);
const mio = profile('Mio', 30);
const ren = profile('Ren', 20);
const all = mapOf(caden, ayu, mio, ren);

describe('autoSeat', () => {
  it('seats nobody without a main profile', () => {
    expect(autoSeat({ profiles: all, activeId: null, min: 3 })).toEqual([]);
    expect(autoSeat({ profiles: all, activeId: 'gone', min: 3 })).toEqual([]);
  });

  it('seats only the main profile when it is the only one', () => {
    expect(names(autoSeat({ profiles: mapOf(caden), activeId: 'caden', min: 3 }))).toEqual(['Caden']);
  });

  it('seats only the main profile at a minimum of one', () => {
    expect(names(autoSeat({ profiles: all, activeId: 'caden', min: 1 }))).toEqual(['Caden']);
  });

  it('restores the last table in seat order, past the minimum', () => {
    const seated = autoSeat({ profiles: all, activeId: 'caden', lastTable: ['ren', 'caden', 'ayu', 'mio'], min: 2 });
    expect(names(seated)).toEqual(['Caden', 'Ren', 'Ayu', 'Mio']);
  });

  it('skips deleted profiles in the last table and tops up to the minimum', () => {
    const seated = autoSeat({ profiles: all, activeId: 'caden', lastTable: ['deleted', 'mio'], min: 3 });
    expect(names(seated)).toEqual(['Caden', 'Mio', 'Ayu']);
  });

  it('fills to the minimum from play history first', () => {
    const history = [
      { at: 1, game: 'anifake', with: ['Ayu', 'Mio'] },
      { at: 2, game: 'anitag', with: ['Ren'] },
    ];
    expect(names(autoSeat({ profiles: all, activeId: 'caden', history, min: 3 }))).toEqual(['Caden', 'Ren', 'Ayu']);
  });

  it('seats everyone the device has when that is fewer than the minimum', () => {
    expect(names(autoSeat({ profiles: mapOf(caden, ayu), activeId: 'caden', min: 4 }))).toEqual(['Caden', 'Ayu']);
  });
});

describe('rankCompanions', () => {
  it('ranks the most recent table first, folding names to ids', () => {
    const history = [
      { at: 1, game: 'anifake', with: ['mio'] },
      { at: 2, game: 'anitag', with: ['  REN ', 'Stranger Online'] },
    ];
    expect(rankCompanions({ profiles: all, activeId: 'caden', history })).toEqual(['ren', 'mio', 'ayu']);
  });

  it('falls back to the picker order: most recently used, then name', () => {
    const profiles = mapOf(caden, profile('Zed', 0), profile('Abe', 0), profile('Kai', 99));
    expect(rankCompanions({ profiles, activeId: 'caden' })).toEqual(['kai', 'abe', 'zed']);
  });

  it('never ranks the main profile', () => {
    const history = [{ at: 1, game: 'anitag', with: ['Caden', 'Ayu'] }];
    expect(rankCompanions({ profiles: mapOf(caden, ayu), activeId: 'caden', history })).toEqual(['ayu']);
  });
});

describe('normalizeLastTables', () => {
  it('keeps clean id lists and drops everything else', () => {
    expect(normalizeLastTables({
      anifake: ['caden', 'ayu', 'ayu', 3, ''],
      anitag: 'caden',
      aniwave: [],
    })).toEqual({ anifake: ['caden', 'ayu'] });
  });

  it('returns an empty map for junk', () => {
    expect(normalizeLastTables(null)).toEqual({});
    expect(normalizeLastTables([])).toEqual({});
    expect(normalizeLastTables('x')).toEqual({});
  });
});

it('rememberedIds keeps seat order', () => {
  expect(rememberedIds([ayu, caden])).toEqual(['ayu', 'caden']);
});
