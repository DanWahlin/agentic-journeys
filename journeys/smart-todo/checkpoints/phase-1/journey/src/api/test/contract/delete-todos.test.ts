import { describe, expect, it } from 'vitest';
import { deleteTodo } from '../../src/handlers/todos.js';
import { context, expectErrorEnvelope, request, seededDependencies } from '../helpers.js';

describe('DELETE /api/todos/:id', () => {
  it('returns 204 with an empty body when deleting a todo', async () => {
    const response = await deleteTodo(request('DELETE', 'http://localhost/api/todos/todo-2', undefined, { id: 'todo-2' }), context(), await seededDependencies());
    expect(response).toMatchObject({ status: 204 });
    expect(response.body).toBeUndefined();
    expect(response.jsonBody).toBeUndefined();
  });

  it('cascade deletes action steps with their todo', async () => {
    const deps = await seededDependencies();
    await deleteTodo(request('DELETE', 'http://localhost/api/todos/todo-2', undefined, { id: 'todo-2' }), context(), deps);
    expect(await deps.store.actionSteps.getByTodoId('todo-2')).toEqual([]);
  });

  it('returns 404 NOT_FOUND when deleting an unknown todo', async () => {
    const response = await deleteTodo(request('DELETE', 'http://localhost/api/todos/unknown', undefined, { id: 'unknown' }), context(), await seededDependencies());
    expectErrorEnvelope(response, 404, 'NOT_FOUND');
  });
});
