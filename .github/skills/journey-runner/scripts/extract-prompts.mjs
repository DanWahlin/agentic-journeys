#!/usr/bin/env node
// Extracts every Copilot prompt from a journey README into numbered files, exactly
// as written, so a run uses the documented prompts word for word.
// A prompt is a fenced block (no language, or `text`) whose first line starts with "> ".
// Usage: node extract-prompts.mjs --readme <README.md> --out <dir>

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i === -1 ? undefined : args[i + 1]; };
const readme = value('--readme');
const out = value('--out');
if (!readme || !out) {
  console.error('Usage: node extract-prompts.mjs --readme <README.md> --out <dir>');
  process.exit(2);
}

const lines = readFileSync(resolve(readme), 'utf8').split(/\r?\n/);
mkdirSync(resolve(out), { recursive: true });
const index = [];
let heading = '';
let inFence = false;
let lang = '';
let buffer = [];
for (const line of lines) {
  if (!inFence) {
    const match = line.match(/^(#{2,4})\s+(.*)/);
    if (match) heading = match[2].trim();
  }
  if (line.startsWith('```')) {
    if (!inFence) { inFence = true; lang = line.slice(3).trim(); buffer = []; continue; }
    inFence = false;
    if ((lang === '' || lang === 'text') && buffer[0]?.startsWith('> ')) {
      const text = buffer.map((l) => (l.startsWith('> ') ? l.slice(2) : l.startsWith('  ') ? l.slice(2) : l)).join('\n').trim();
      const n = String(index.length).padStart(2, '0');
      const file = `${n}.txt`;
      writeFileSync(join(resolve(out), file), `${text}\n`);
      index.push({
        n,
        file,
        heading,
        firstLine: text.split('\n')[0].slice(0, 100),
        slashCommand: /^\/\w/.test(text) ? text.split(/\s/)[0] : null,
        placeholders: [...new Set(text.match(/<[a-z][\w -]*>|\[[A-Z][A-Z _]+\]|\[paste[^\]]*\]/gi) ?? [])],
      });
    }
    continue;
  }
  if (inFence) buffer.push(line);
}
writeFileSync(join(resolve(out), 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
for (const p of index) {
  const flags = [p.slashCommand && `slash:${p.slashCommand}`, p.placeholders.length && `fill:${p.placeholders.join(',')}`].filter(Boolean).join(' ');
  console.log(`${p.n}  [${p.heading}]  ${p.firstLine}${flags ? `  (${flags})` : ''}`);
}
console.log(`\n${index.length} prompts written to ${resolve(out)}`);
