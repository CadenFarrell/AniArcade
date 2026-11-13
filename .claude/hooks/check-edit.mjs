// PostToolUse hook (Edit|Write): checks the ONE file Claude just changed for
// mistakes CI or the house rules would catch later, and hands them straight back.
//
// It never blocks: the edit has already happened. Exit 2 puts the findings on
// stderr in front of Claude, which fixes them; exit 0 says nothing. Any failure
// of the hook itself is swallowed (exit 0) — a broken check must never get in
// the way of editing.
//
// Three checks, each one a rule CLAUDE.md states and nothing enforced as you type:
//   1. ESLint errors (CI runs `npm run lint`; unused vars are errors here).
//   2. Import casing. Windows resolves `./playerRow` to `PlayerRow.jsx`; CI's
//      Linux does not, so the build passes here and fails there.
//   3. The styling "nevers" (.claude/rules/styling.md): min-h-screen, text-white,
//      white/N and black/N, emoji on a rendered line, and a game's Component
//      imported statically instead of through lazyGame (which pulls it into the
//      hub's startup bundle — `npm run size` catches that too, but only at build).
import fs from 'node:fs';
import path from 'node:path';

const LINT_ROOTS = ['src/', 'playtest/', 'smoke/'];
const CODE = /\.(jsx?|mjs)$/;

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

// A comment line, by the same test icons.test.js's emoji sweep uses: comments
// may name what is banned (several explain why it is), rendered code may not.
const isComment = (line) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);

async function lint(abs, root) {
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({ cwd: root });
  if (await eslint.isPathIgnored(abs)) return [];
  const [result] = await eslint.lintFiles([abs]);
  return (result?.messages ?? [])
    .filter((m) => m.severity === 2)
    .map((m) => `${m.line}:${m.column} ${m.message}${m.ruleId ? ` (${m.ruleId})` : ''}`);
}

// Walks a relative specifier segment by segment against the real directory
// listings, so a segment that only matches case-insensitively is caught even
// on a filesystem that would happily open it.
function casingProblem(fromDir, spec) {
  const parts = spec.split('/');
  let dir = fromDir;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '.' || part === '') continue;
    if (part === '..') { dir = path.dirname(dir); continue; }
    let names;
    try { names = fs.readdirSync(dir); } catch { return null; }
    const last = i === parts.length - 1;
    const wanted = last
      ? [part, ...['.js', '.jsx', '.mjs', '.json'].map((e) => part + e)]
      : [part];
    if (wanted.some((w) => names.includes(w))) {
      dir = path.join(dir, part);
      continue;
    }
    const near = names.find((n) => wanted.some((w) => w.toLowerCase() === n.toLowerCase()));
    if (near) return `"${spec}": "${part}" is "${near}" on disk — Linux CI will not find it`;
    return null; // missing outright: ESLint/the build will say so, not a casing issue
  }
  return null;
}

function importCasing(abs, text) {
  const out = [];
  const re = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const m of text.matchAll(re)) {
    const problem = casingProblem(path.dirname(abs), m[1]);
    if (problem) out.push(problem);
  }
  return out;
}

function styleRules(rel, text) {
  const out = [];
  const isTest = /\.test\.jsx?$/.test(rel);
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    const at = `${i + 1}:`;
    if (/\bmin-h-screen\b/.test(line)) out.push(`${at} min-h-screen — viewport heights are dvh (min-h-dvh)`);
    if (/\btext-white\b/.test(line)) out.push(`${at} text-white — neutral colour is a role: text-paper on a fill, fg-* on the page`);
    if (/\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:white|black)\/\d/.test(line)) {
      out.push(`${at} white/N or black/N — neutral colour is a role (fg-*, scrim, wash), never an opacity`);
    }
    if (!isTest && rel.endsWith('.jsx') && /\p{Extended_Pictographic}/u.test(line)) {
      out.push(`${at} emoji on a rendered line — use <Icon name> from shared/ui/icons.js`);
    }
  });
  if (/^src\/games\/[^/]+\/index\.js$/.test(rel)) {
    const m = text.match(/^import\s+\w+\s+from\s+['"]\.\/\w*Game['"]/m);
    if (m) out.push(`"${m[0]}" — a game's Component is lazyGame(() => import('./<Title>Game')), never a static import`);
  }
  return out;
}

async function main() {
  const input = readInput();
  const file = input?.tool_input?.file_path;
  if (!file) return 0;
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const abs = path.resolve(root, file);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (rel.startsWith('..') || !fs.existsSync(abs)) return 0;

  const inLintRoot = LINT_ROOTS.some((r) => rel.startsWith(r));
  const isCode = CODE.test(rel);
  const isStyled = rel.startsWith('src/') && /\.(jsx?|css)$/.test(rel);
  if (!(inLintRoot && isCode) && !isStyled) return 0;

  const text = fs.readFileSync(abs, 'utf8');
  const findings = [];
  if (inLintRoot && isCode) {
    for (const f of await lint(abs, root)) findings.push(`lint ${f}`);
    for (const f of importCasing(abs, text)) findings.push(`import casing ${f}`);
  }
  if (isStyled) for (const f of styleRules(rel, text)) findings.push(`style ${f}`);

  if (findings.length === 0) return 0;
  process.stderr.write(`check-edit found ${findings.length} problem(s) in ${rel}:\n${findings.map((f) => `  - ${f}`).join('\n')}\n`);
  return 2;
}

// A direct run (`node check-edit.mjs --all`) sweeps every file the hook would
// check, for a first pass over the tree or after changing a rule here.
async function sweep() {
  const root = process.cwd();
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx?|mjs|css)$/.test(e.name)) files.push(p);
    }
  };
  for (const r of LINT_ROOTS) if (fs.existsSync(r)) walk(r);
  let total = 0;
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const text = fs.readFileSync(f, 'utf8');
    const hits = [
      ...(CODE.test(rel) ? importCasing(path.resolve(f), text).map((x) => `import casing ${x}`) : []),
      ...(rel.startsWith('src/') ? styleRules(rel, text).map((x) => `style ${x}`) : []),
    ];
    for (const h of hits) console.log(`${rel}: ${h}`);
    total += hits.length;
  }
  console.log(`${files.length} files, ${total} finding(s) (lint not included: run npm run lint)`);
}

if (process.argv.includes('--all')) {
  sweep().catch((e) => { console.error(e); process.exit(1); });
} else {
  main().then((code) => process.exit(code), () => process.exit(0));
}
