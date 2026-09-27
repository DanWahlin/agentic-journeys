import { describe, expect, it, vi } from 'vitest';
import { listTodos } from '../../src/handlers/todos.js';
import { context, expectErrorEnvelope, request, seededDependencies } from '../helpers.js';

describe('GET /api/todos', () => {
  it('returns 400 VALIDATION_ERROR when userId is missing', async () => {
    const response = await listTodos(request('GET', 'http://localhost/api/todos'), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when userId is whitespace only', async () => {
    const response = await listTodos(request('GET', 'http://localhost/api/todos?userId=%20%20'), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when trimmed userId exceeds 100 characters', async () => {
    const response = await listTodos(request('GET', `http://localhost/api/todos?userId=${'x'.repeat(101)}`), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('trims userId before loading todos', async () => {
    const deps = await seededDependencies();
    const getAll = vi.spyOn(deps.store.todos, 'getAll');
    await listTodos(request('GET', 'http://localhost/api/todos?userId=%20user-1%20'), context(), deps);
    expect(getAll).toHaveBeenCalledWith('user-1');
  });

  it('returns seeded todos with nested steps in order', async () => {
    const response = await listTodos(request('GET', 'http://localhost/api/todos?userId=user-1'), context(), await seededDependencies());
    expect(response.jsonBody).toMatchObject([
      { id: 'todo-1', steps: [] },
      { id: 'todo-2', steps: [{ order: 1 }, { order: 2 }, { order: 3 }, { order: 4 }] },
      { id: 'todo-3', steps: [{ order: 1 }, { order: 2 }, { order: 3 }] },
    ]);
  });

  it('returns an empty array when the user has no todos', async () => {
    const response = await listTodos(request('GET', 'http://localhost/api/todos?userId=nobody'), context(), await seededDependencies());
    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual([]);
  });

  it('loads steps with one getByTodoIds call', async () => {
    const deps = await seededDependencies();
    const bulk = vi.spyOn(deps.store.actionSteps, 'getByTodoIds');
    const single = vi.spyOn(deps.store.actionSteps, 'getByTodoId');
    await listTodos(request('GET', 'http://localhost/api/todos?userId=user-1'), context(), deps);
    expect(bulk).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
  });
});
