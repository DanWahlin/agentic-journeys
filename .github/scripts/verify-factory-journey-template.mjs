import { readFile } from 'node:fs/promises';
import process from 'node:process';

const path = new URL('../skills/journey-template/SKILL.md', import.meta.url);
const text = await readFile(path, 'utf8');

const required = [
  'Factory (e.g. AIMarket Factory)',
  'journeys/<app-name>-factory/',
  'template-repo/.github/workflows/',
  '**Factory journeys** use the full-stack section order',
  'Do not call it "Journey 7"',
  '`Proceed`, `Simulate`, or `Blocked`',
  'Never execute an untrusted PR head through `pull_request_target`',
  'do not estimate learner completion time',
];

const missing = required.filter((value) => !text.includes(value));
const contradictions = [
  'Honest first-run time',
  'Journey 7 of',
].filter((value) => text.includes(value));

if (missing.length > 0 || contradictions.length > 0) {
  console.error('Factory journey template verification failed.');
  if (missing.length > 0) console.error(`Missing: ${missing.join(', ')}`);
  if (contradictions.length > 0) console.error(`Contradictions: ${contradictions.join(', ')}`);
  process.exit(1);
}

console.log('PASS: factory journey template structure and writing rules are present.');
