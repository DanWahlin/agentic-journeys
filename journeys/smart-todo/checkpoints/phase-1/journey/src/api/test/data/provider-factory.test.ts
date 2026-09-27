import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStepGenerator } from '../../src/ai/factory.js';

describe('local provider validation', () => {
  const originalDataProvider = process.env.DATA_PROVIDER;
  const originalAiProvider = process.env.AI_PROVIDER;

  afterEach(() => {
    vi.resetModules();
    if (originalDataProvider === undefined) delete process.env.DATA_PROVIDER;
    else process.env.DATA_PROVIDER = originalDataProvider;
    if (originalAiProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalAiProvider;
  });

  it.each([undefined, '', 'unknown'])('fails startup for missing or unknown AI_PROVIDER value %s', (provider) => {
    expect(() => getStepGenerator(provider)).toThrow(/AI_PROVIDER/);
  });

  it('fails when the Functions module loads with missing provider settings', async () => {
    delete process.env.DATA_PROVIDER;
    delete process.env.AI_PROVIDER;
    await expect(import(`../../src/functions/index.js?missing=${Date.now()}`)).rejects.toThrow(/DATA_PROVIDER|AI_PROVIDER/);
  });
});
