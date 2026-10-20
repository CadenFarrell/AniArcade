import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ICON_TAGS, ICONS } from './icons';
import { MODES } from '../../games/anitune/modes';
import { FORMATS } from '../../games/aniquiz/prefs';
import { answerTrail } from '../../games/aniguess/utils/answerTrail';

// Every failure here is silent in the browser: <Icon> renders nothing for a
// name it cannot find, and an emoji that creeps back into a label just looks
// like an emoji.
const SRC = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.jsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const files = sourceFiles().map((p) => ({ p: p.slice(SRC.length).split('\\').join('/'), text: readFileSync(p, 'utf8') }));

describe('the icon set', () => {
  it('paints every shape, with a known tag', () => {
    for (const [name, shapes] of Object.entries(ICONS)) {
      expect(shapes.length, name).toBeGreaterThan(0);
      for (const shape of shapes) {
        expect(ICON_TAGS, name).toContain(shape.tag);
        // An unpainted SVG shape is not invisible, it is BLACK — the default
        // fill — which on an ink page looks almost right.
        expect(['stroke', 'fill'], name).toContain(shape.paint);
      }
    }
  });

  it('knows every literal <Icon name="…"> in src', () => {
    // icons.js itself only names <Icon> in its header comment.
    const used = files.filter(({ p }) => p !== 'shared/ui/icons.js').flatMap(({ p, text }) =>
      [...text.matchAll(/<Icon\b[^>]*?\bname="([^"]+)"/g)].map((m) => [p, m[1]]));
    expect(used.length).toBeGreaterThan(20);
    for (const [p, name] of used) expect(ICONS, `${p} uses "${name}"`).toHaveProperty([name]);
  });

  it('is sized by text size, never by h-/w- classes', () => {
    // Icon's own h-[1.1em] w-[1.1em] wins over h-8 w-8 in the generated CSS,
    // so a size class there does nothing — and nothing says so.
    const sized = files.flatMap(({ p, text }) =>
      [...text.matchAll(/<Icon\b[^>]*?className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
        .filter((m) => /(^|\s)[hw]-(\d|\[)/.test(m[1] ?? m[2]))
        .map((m) => `${p}: ${m[0]}`));
    expect(sized).toEqual([]);
  });

  it('knows every icon name carried as data', () => {
    // The names that reach <Icon name={…}> through a table rather than a literal.
    const log = [
      { id: 'a', type: 'question', answer: 'Yes' },
      { id: 'b', type: 'question', answer: 'No' },
      { id: 'c', type: 'guess', correct: true },
      { id: 'd', type: 'guess', correct: false },
      { id: 'e', type: 'timer' },
    ];
    const names = [...MODES, ...FORMATS].map((m) => m.icon).concat(answerTrail(log).map((c) => c.icon));
    for (const name of names) expect(ICONS).toHaveProperty([name]);
  });
});

describe('no emoji', () => {
  // The ink set replaced ~450 platform emoji, most of them decorating a label
  // that already said the same thing. Comments may still name one — several
  // explain why something is drawn instead — but nothing rendered may.
  it('appears on any rendered line in src', () => {
    const hits = [];
    for (const { p, text } of files) {
      text.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
        if (/\p{Extended_Pictographic}/u.test(line)) hits.push(`${p}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
