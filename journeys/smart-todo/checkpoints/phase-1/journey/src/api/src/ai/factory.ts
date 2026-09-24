import type { StepGenerator } from './contracts.js';
import { createFakeStepGenerator } from './fake-generator.js';
import { createFoundryStepGenerator } from './foundry-generator.js';

export function getStepGenerator(provider = process.env.AI_PROVIDER): StepGenerator {
  if (provider === 'fake') return createFakeStepGenerator();
  if (provider === 'foundry') return createFoundryStepGenerator();
  throw new Error('AI_PROVIDER must be set to "fake" or "foundry"');
}
