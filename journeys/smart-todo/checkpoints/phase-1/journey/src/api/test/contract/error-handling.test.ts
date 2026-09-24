import { describe, expect, it, vi } from 'vitest';
import { createTodo } from '../../src/handlers/todos.js';
import { withErrorHandling } from '../../src/handlers/error-wrapper.js';
import { context, dependencies, expectErrorEnvelope, malformedRequest, request, seededDependencies } from '../helpers.js';

describe('API error handling', () => {
  it.each([
    ['malformed JSON', malformedRequest('POST', 'http://localhost/api/todos')],
    ['an array body', request('POST', 'http://localhost/api/todos', [])],
    ['a primitive body', request('POST', 'http://localhost/api/todos', 'title')],
  ])('returns 400 VALIDATION_ERROR for %s', async (_case, input) => {
    const response = await createTodo(input, context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('logs unexpected errors and returns a redacted INTERNAL_ERROR envelope', async () => {
    const secretError = new Error('connection string contains secret-value');
    const handler = withErrorHandling(
      async () => {
        throw secretError;
      },
      async () => dependencies(),
    );
    const invocationContext = context();
    const response = await handler(request('GET', 'http://localhost/api/todos'), invocationContext);
    expect(invocationContext.error).toHaveBeenCalledWith(secretError);
    expectErrorEnvelope(response, 500, 'INTERNAL_ERROR');
    expect(JSON.stringify(response.jsonBody)).not.toContain('secret-value');
    expect(JSON.stringify(response.jsonBody)).not.toContain('stack');
  });

  it('wraps dependency resolution failures in the standard error envelope', async () => {
    const resolutionError = new Error('failed to initialize');
    const handler = withErrorHandling(
      vi.fn(),
      async () => {
        throw resolutionError;
      },
    );
    const invocationContext = context();
    const response = await handler(request('GET', 'http://localhost/api/todos'), invocationContext);
    expect(invocationContext.error).toHaveBeenCalledWith(resolutionError);
    expectErrorEnvelope(response, 500, 'INTERNAL_ERROR');
  });
});
