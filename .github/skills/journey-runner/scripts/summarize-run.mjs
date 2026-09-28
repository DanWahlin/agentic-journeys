#!/usr/bin/env node
// Summarizes the JSON-lines records written by run-copilot-prompt.mjs and run-command.mjs.
// Usage: node summarize-run.mjs --record <file>

import { readFileSync } from 'node:fs';

const i = process.argv.indexOf('--record');
if (i === -1 || !process.argv[i + 1]) {
  console.error('Usage: node summarize-run.mjs --record <file>');
  process.exit(2);
}
const rows = readFileSync(process.argv[i + 1], 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const minutes = (s) => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
console.log('| Step | Kind | Time | Exit |');
console.log('| --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.label} | ${r.kind} | ${minutes(r.seconds)} | ${r.exit} |`);
const total = rows.reduce((sum, r) => sum + r.seconds, 0);
// A resumed session reports its running total, so count each session's highest value once.
const perSession = new Map();
for (const r of rows) if (r.sessionId && r.sessionCredits != null) perSession.set(r.sessionId, Math.max(perSession.get(r.sessionId) ?? 0, r.sessionCredits));
const credits = [...perSession.values()].reduce((a, b) => a + b, 0);
const failed = rows.filter((r) => r.exit !== 0).length;
console.log(`\nTotal time ${minutes(total)} across ${rows.length} steps (${failed} nonzero exits); ${credits.toFixed(0)} AI credits across ${perSession.size} sessions.`);
