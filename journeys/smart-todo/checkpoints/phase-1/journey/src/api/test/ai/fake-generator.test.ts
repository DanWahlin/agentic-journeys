import { describe, expect, it, vi } from 'vitest';
import { createFakeStepGenerator } from '../../src/ai/fake-generator.js';

describe('fake step generator', () => {
  it('returns deterministic fake steps containing the todo title without a network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const generator = createFakeStepGenerator();
    const first = await generator.generate('Prepare conference talk');
    const second = await generator.generate('Prepare conference talk');
    expect(first).toEqual(second);
    expect(first.map((step) => step.title)).toEqual([
      'Clarify the goal',
      'Gather what you need',
      'Do the first focused session',
      'Review and wrap up',
    ]);
    expect(first.every((step) => step.description.includes('Prepare conference talk'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
