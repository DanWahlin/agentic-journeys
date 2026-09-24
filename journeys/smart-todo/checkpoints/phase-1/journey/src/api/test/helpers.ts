import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { vi } from 'vitest';
import type { StepGenerator } from '../src/ai/contracts.js';
import type { DataStore } from '../src/data/contracts.js';
import type { HandlerDependencies } from '../src/handlers/types.js';
import { createMemoryStore } from '../src/data/memory-store.js';
import { createFakeStepGenerator } from '../src/ai/fake-generator.js';

export function request(
  method: string,
  url: string,
  body?: unknown,
  params: Record<string, string> = {},
): HttpRequest {
  return new HttpRequest({
    method,
    url,
    params,
    body: body === undefined ? undefined : { string: JSON.stringify(body) },
    headers: { 'content-type': 'application/json' },
  });
}

export function malformedRequest(method: string, url: string): HttpRequest {
  return new HttpRequest({
    method,
    url,
    body: { string: '{"title":' },
    headers: { 'content-type': 'application/json' },
  });
}

export function context(): InvocationContext {
  return { error: vi.fn() } as unknown as InvocationContext;
}

export function dependencies(overrides: Partial<HandlerDependencies> = {}): HandlerDependencies {
  const store = {
    initialize: vi.fn(),
    todos: {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    actionSteps: {
      getByTodoId: vi.fn(),
      getByTodoIds: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteByTodoId: vi.fn(),
    },
  } as unknown as DataStore;
  const generator = { generate: vi.fn() } as unknown as StepGenerator;
  return { store, generator, ...overrides };
}

export async function seededDependencies(
  overrides: Partial<HandlerDependencies> = {},
): Promise<HandlerDependencies> {
  const store = overrides.store ?? await createMemoryStore();
  await store.initialize();
  return {
    store,
    generator: overrides.generator ?? createFakeStepGenerator(),
  };
}

export async function json(response: HttpResponseInit): Promise<unknown> {
  if (response.jsonBody !== undefined) return response.jsonBody;
  if (typeof response.body === 'string') return JSON.parse(response.body);
  return response.body;
}

export function expectErrorEnvelope(
  response: HttpResponseInit,
  status: number,
  code: string,
): void {
  expect(response.status).toBe(status);
  expect(response.jsonBody).toEqual({
    error: { code, message: expect.any(String) },
  });
}
