import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// No screen asks with the browser's own box. window.confirm (and alert/prompt)
// drew grey pasted-in chrome that said "OK" rather than what happens, and on a
// phone held every other device's room updates while it sat open. A leave is
// PauseScreen, anything else ConfirmDialog, both through useConfirm. This is the
// only thing that would notice a new one: jsdom's confirm only logs "not
// implemented" and answers no, so a test or a bot just sees a button that does
// nothing.
const SRC = fileURLToPath(new URL('../../', import.meta.url));
const CALL = /\bwindow\.(confirm|alert|prompt)\s*\(/;

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('no browser dialogs', () => {
  it('nothing in src/ calls window.confirm, alert or prompt', () => {
    const calls = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const code = line.trim();
        // Comments may name it — several say why it is gone.
        if (code.startsWith('//') || code.startsWith('*')) return;
        if (CALL.test(code)) calls.push(`${relative(SRC, file)}:${i + 1}`);
      });
    }
    expect(calls).toEqual([]);
  });
});
