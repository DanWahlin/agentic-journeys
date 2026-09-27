import { describe, expect, it } from 'vitest';
import { generateSteps } from '../../src/handlers/steps.js';
import { AiServiceError, type StepGenerator } from '../../src/ai/contracts.js';
import { context, expectErrorEnvelope, request, seededDependencies } from '../helpers.js';

async function call(id = 'todo-1', deps = await seededDependencies()) {
  return generateSteps(request('POST', `http://localhost/api/todos/${id}/generate-steps`, undefined, { id }), context(), deps);
}

describe('POST /api/todos/:id/generate-steps', () => {
  it('returns ordered generated steps and marks the todo generated', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ stepsGenerated: true });
    const steps = (response.jsonBody as { steps: Array<{ order: number }> }).steps;
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(7);
    expect(steps.map((step) => step.order)).toEqual(steps.map((_, index) => index + 1));
  });

  it('replaces existing steps when regenerating', async () => {
    const deps = await seededDependencies();
    const first = await call('todo-2', deps);
    const second = await call('todo-2', deps);
    expect((second.jsonBody as { steps: unknown[] }).steps).toHaveLength(4);
    expect(second.jsonBody).not.toEqual(first.jsonBody);
  });

  it('moves a completed todo to in_progress when regenerating steps', async () => {
    const response = await call('todo-3');
    expect(response.jsonBody).toMatchObject({ status: 'in_progress' });
  });

  it('preserves a non-completed todo status when regenerating steps', async () => {
    const response = await call('todo-2');
    expect(response.jsonBody).toMatchObject({ status: 'in_progress' });
  });

  it('returns 404 NOT_FOUND when generating steps for an unknown todo', async () => {
    expectErrorEnvelope(await call('unknown'), 404, 'NOT_FOUND');
  });

  it('returns 503 AI_SERVICE_ERROR after both generation attempts fail', async () => {
    const generator: StepGenerator = {
      generate: async () => {
        throw new AiServiceError('model unavailable');
      },
    };
    const response = await call('todo-1', await seededDependencies({ generator }));
    expectErrorEnvelope(response, 503, 'AI_SERVICE_ERROR');
  });
});
