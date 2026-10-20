// The playtest report: one JSON file per (layer, game) holding every run's
// record, merged into playtest-report/summary.md and index.html.
//
// Per (layer, game) rather than one file per run so a partial rerun —
// `--game anitag`, or one seed — replaces exactly that game's results and
// leaves every other game's last run in the report, instead of a one-game
// rerun making the report claim six games were never tested.
//
// Also a CLI (`node playtest/report.js`), which only rebuilds the summary from
// whatever JSON is there — run.js calls it after the layers it ran.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REPORT_DIR = `${import.meta.dirname.replace(/\\/g, '/')}/../playtest-report`;

export function writeLayerReport(layer, records, meta = {}) {
  if (!records.length) return;
  const dir = `${REPORT_DIR}/${layer}`;
  mkdirSync(dir, { recursive: true });
  const byGame = Object.groupBy(records, (r) => r.game);
  for (const [game, runs] of Object.entries(byGame)) {
    // A single-seed replay is a debugging run; it adds to the game's file
    // rather than replacing a full sweep with one record.
    const file = `${dir}/${game}.json`;
    let prior = [];
    if (meta.seeds?.length === 1 && existsSync(file)) {
      prior = JSON.parse(readFileSync(file, 'utf8')).runs.filter((r) => r.seed !== runs[0].seed);
    }
    writeFileSync(file, JSON.stringify({ layer, game, at: new Date().toISOString(), runs: [...prior, ...runs] }, null, 1));
  }
  buildReport();
}

function loadAll() {
  const out = [];
  if (!existsSync(REPORT_DIR)) return out;
  for (const layer of readdirSync(REPORT_DIR, { withFileTypes: true })) {
    // shots/ holds screenshots, browser-artifacts/ Playwright's traces.
    if (!layer.isDirectory() || layer.name === 'shots' || layer.name === 'browser-artifacts') continue;
    const runs = {};
    for (const f of readdirSync(`${REPORT_DIR}/${layer.name}`)) {
      if (!f.endsWith('.json')) continue;
      const data = JSON.parse(readFileSync(`${REPORT_DIR}/${layer.name}/${f}`, 'utf8'));
      // One record per file (the browser layer's parallel workers), grouped
      // here into the per-game shape every other layer writes directly.
      if (f.endsWith('.run.json')) (runs[data.game] ??= []).push(data);
      else if (f.endsWith('.json')) out.push(data);
    }
    for (const [game, list] of Object.entries(runs)) {
      out.push({ layer: layer.name, game, at: new Date().toISOString(), runs: list.sort((a, b) => a.seed - b.seed) });
    }
  }
  return out;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function coverage(runs) {
  const screens = {};
  const prefs = {};
  const players = new Set();
  for (const r of runs) {
    for (const [s, n] of Object.entries(r.screens ?? {})) screens[s] = (screens[s] ?? 0) + n;
    for (const [k, v] of Object.entries(r.scenario?.prefs ?? {})) (prefs[k] ??= new Set()).add(JSON.stringify(v));
    if (r.scenario?.players) players.add(r.scenario.players);
  }
  return { screens, prefs, players: [...players].sort((a, b) => a - b) };
}

export function buildReport() {
  const files = loadAll().sort((a, b) => `${a.layer}${a.game}`.localeCompare(`${b.layer}${b.game}`));
  if (!files.length) return;
  const md = ['# Playtest report', '', `Generated ${new Date().toISOString()}`, ''];
  const rows = [];
  md.push('| layer | game | runs | pass | fail | last run |', '| --- | --- | --- | --- | --- | --- |');
  for (const f of files) {
    const pass = f.runs.filter((r) => r.outcome === 'pass').length;
    md.push(`| ${f.layer} | ${f.game} | ${f.runs.length} | ${pass} | ${f.runs.length - pass} | ${f.at.slice(0, 16)} |`);
  }
  for (const f of files) {
    const cov = coverage(f.runs);
    const fails = f.runs.filter((r) => r.outcome !== 'pass');
    const warns = f.runs.flatMap((r) => r.findings ?? []);
    md.push('', `## ${f.game} — ${f.layer}`, '');
    md.push(`Players covered: ${cov.players.join(', ') || '—'}  `);
    md.push(`Settings covered: ${Object.entries(cov.prefs).map(([k, v]) => `${k}=${[...v].join('/')}`).join('; ') || '—'}  `);
    md.push(`Screens reached (${Object.keys(cov.screens).length}): ${Object.keys(cov.screens).join(' · ')}`);
    if (fails.length) {
      md.push('', '**Failures**', '');
      for (const r of fails) md.push(`- seed ${r.seed} — **${r.failure.kind}**: ${r.failure.message}  \n  \`${r.repro}\``);
    }
    const uniq = [...new Map(warns.map((w) => [`${w.kind}:${w.message}`, w])).values()];
    if (uniq.length) {
      md.push('', '**Findings**', '');
      for (const w of uniq.slice(0, 40)) md.push(`- [${w.severity}] ${w.kind}: ${w.message}${w.screen ? ` (on "${w.screen}")` : ''}${w.shot ? ` — ${w.shot}` : ''}`);
    }
    rows.push({ f, cov, fails, uniq });
  }
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/summary.md`, `${md.join('\n')}\n`);
  writeFileSync(`${REPORT_DIR}/index.html`, html(rows));
}

function html(rows) {
  const card = ({ f, cov, fails, uniq }) => {
    const pass = f.runs.length - fails.length;
    const shots = uniq.filter((w) => w.shot).slice(0, 24);
    const allShots = [...new Set(f.runs.flatMap((r) => r.shots ?? []))].slice(0, 40);
    return `<section class="game">
  <h2>${esc(f.game)} <small>${esc(f.layer)}</small> <span class="${fails.length ? 'bad' : 'ok'}">${pass}/${f.runs.length} passed</span></h2>
  <p><b>Players:</b> ${esc(cov.players.join(', '))} &nbsp; <b>Settings:</b> ${esc(Object.entries(cov.prefs).map(([k, v]) => `${k}=${[...v].join('/')}`).join('; '))}</p>
  <details><summary>${Object.keys(cov.screens).length} screens reached</summary><ul>${Object.entries(cov.screens).map(([s, n]) => `<li>${esc(s)} <small>×${n}</small></li>`).join('')}</ul></details>
  ${fails.length ? `<h3>Failures</h3>${fails.map((r) => `<details class="fail"><summary>seed ${r.seed} — <b>${esc(r.failure.kind)}</b>: ${esc(r.failure.message)}</summary>
    <code>${esc(r.repro)}</code><pre>${esc(JSON.stringify(r.scenario, null, 1))}</pre>
    <ol start="${r.trace[0]?.step ?? 0}">${r.trace.map((t) => `<li>[${esc(t.screen)}] ${esc(t.action)}</li>`).join('')}</ol>
    ${r.lastScreen ? `<pre class="screen">${esc(r.lastScreen)}</pre>` : ''}</details>`).join('')}` : ''}
  ${uniq.length ? `<h3>Findings</h3><ul>${uniq.slice(0, 60).map((w) => `<li><b>${esc(w.severity)}</b> ${esc(w.kind)}: ${esc(w.message)} ${w.screen ? `<small>on “${esc(w.screen)}”</small>` : ''}</li>`).join('')}</ul>` : ''}
  ${(shots.length || allShots.length) ? `<div class="shots">${[...new Set([...shots.map((w) => w.shot), ...allShots])].map((s) => `<a href="${esc(s)}"><img loading="lazy" src="${esc(s)}" alt=""></a>`).join('')}</div>` : ''}
</section>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Playtest report</title><style>
:root{--bg:#0b0b14;--fg:#e8e8f0;--dim:#9a9ab0;--ok:#84cc16;--bad:#f43f5e;--card:#15152a}
@media (prefers-color-scheme: light){:root{--bg:#f6f6fb;--fg:#15152a;--dim:#55556a;--card:#fff}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px}
.game{background:var(--card);border-radius:10px;padding:12px 16px;margin:16px 0}
h2 small{color:var(--dim);font-weight:400}.ok{color:var(--ok)}.bad{color:var(--bad)}
.fail summary{cursor:pointer}pre,code{white-space:pre-wrap;word-break:break-word;font-size:12px;color:var(--dim)}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}.shots img{width:100%;border-radius:6px}
</style></head><body><h1>Playtest report</h1><p>${esc(new Date().toISOString())}</p>${rows.map(card).join('\n')}</body></html>`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) buildReport();
