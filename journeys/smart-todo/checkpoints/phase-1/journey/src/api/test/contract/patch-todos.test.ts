import { describe, expect, it } from 'vitest';
import { updateTodo } from '../../src/handlers/todos.js';
import { context, expectErrorEnvelope, request, seededDependencies } from '../helpers.js';

const url = 'http://localhost/api/todos/todo-2';

describe('PATCH /api/todos/:id', () => {
  it('updates title and status with a later updatedAt', async () => {
    const deps = await seededDependencies();
    const before = await deps.store.todos.getById('todo-2');
    const response = await updateTodo(request('PATCH', url, { title: 'New title', status: 'completed' }, { id: 'todo-2' }), context(), deps);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ title: 'New title', status: 'completed' });
    expect(Date.parse((response.jsonBody as { updatedAt: string }).updatedAt))
      .toBeGreaterThan(Date.parse(before?.updatedAt ?? ''));
  });

  it('trims and accepts a valid patch title', async () => {
    const response = await updateTodo(request('PATCH', url, { title: ` ${'x'.repeat(500)} ` }, { id: 'todo-2' }), context(), await seededDependencies());
    expect(response.status).toBe(200);
    expect((response.jsonBody as { title: string }).title).toHaveLength(500);
  });

  it.each([['whitespace-only', '   '], ['501-character', 'x'.repeat(501)]])(
    'rejects a %s patch title with VALIDATION_ERROR',
    async (_case, title) => {
      const response = await updateTodo(request('PATCH', url, { title }, { id: 'todo-2' }), context(), await seededDependencies());
      expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
    },
  );

  it('returns 400 VALIDATION_ERROR for an invalid status', async () => {
    const response = await updateTodo(request('PATCH', url, { status: 'not_started' }, { id: 'todo-2' }), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('allows manually completing a todo with incomplete steps', async () => {
    const response = await updateTodo(request('PATCH', url, { status: 'completed' }, { id: 'todo-2' }), context(), await seededDependencies());
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ status: 'completed', steps: expect.arrayContaining([{ isCompleted: false }]) });
  });

  it('returns 400 VALIDATION_ERROR when no supported update is supplied', async () => {
    const response = await updateTodo(request('PATCH', url, { unrelated: true }, { id: 'todo-2' }), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND when patching an unknown todo', async () => {
    const response = await updateTodo(request('PATCH', url, { title: 'New title' }, { id: 'unknown' }), context(), await seededDependencies());
    expectErrorEnvelope(response, 404, 'NOT_FOUND');
  });
});
