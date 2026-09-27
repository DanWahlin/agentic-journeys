import { describe, expect, it } from 'vitest';
import { parseGeneratedSteps } from '../../src/ai/parser.js';

const validSteps = [
  { title: ' First ', description: ' Do the first thing. ' },
  { title: 'Second', description: 'Do the second thing.' },
  { title: 'Third', description: 'Do the third thing.' },
];

describe('generated-step parser', () => {
  it.each([
    ['plain JSON', JSON.stringify(validSteps)],
    ['fenced JSON', `\`\`\`json\n${JSON.stringify(validSteps)}\n\`\`\``],
  ])('parses %s step arrays with trimmed fields', (_case, content) => {
    expect(parseGeneratedSteps(content)).toEqual([
      { title: 'First', description: 'Do the first thing.' },
      { title: 'Second', description: 'Do the second thing.' },
      { title: 'Third', description: 'Do the third thing.' },
    ]);
  });

  it.each([
    ['prose around JSON', `Here are steps: ${JSON.stringify(validSteps)}`],
    ['missing description', JSON.stringify([{ title: 'One' }, ...validSteps.slice(1)])],
    ['whitespace-only title', JSON.stringify([{ title: ' ', description: 'Detail' }, ...validSteps.slice(1)])],
    ['201-character title', JSON.stringify([{ title: 'x'.repeat(201), description: 'Detail' }, ...validSteps.slice(1)])],
    ['1001-character description', JSON.stringify([{ title: 'One', description: 'x'.repeat(1001) }, ...validSteps.slice(1)])],
  ])('rejects %s generated step content', (_case, content) => {
    expect(() => parseGeneratedSteps(content)).toThrow(/invalid generated steps/i);
  });

  it('rejects output with fewer than three steps', () => {
    expect(() => parseGeneratedSteps(JSON.stringify(validSteps.slice(0, 2)))).toThrow(/invalid generated steps/i);
  });

  it('keeps the first seven steps when the model returns more than seven', () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({
      title: `Step ${index + 1}`,
      description: `Description ${index + 1}`,
    }));
    expect(parseGeneratedSteps(JSON.stringify(nine))).toEqual(nine.slice(0, 7));
  });
});
