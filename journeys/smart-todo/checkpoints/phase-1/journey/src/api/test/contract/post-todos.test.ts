import { describe, expect, it, vi } from 'vitest';
import { createTodo } from '../../src/handlers/todos.js';
import { context, expectErrorEnvelope, request, seededDependencies } from '../helpers.js';

describe('POST /api/todos', () => {
  it('returns 201 with the created pending todo and empty steps', async () => {
    const response = await createTodo(request('POST', 'http://localhost/api/todos', { title: 'Write tests', userId: 'user-1' }), context(), await seededDependencies());
    expect(response.status).toBe(201);
    expect(response.jsonBody).toMatchObject({
      title: 'Write tests',
      userId: 'user-1',
      status: 'pending',
      stepsGenerated: false,
      steps: [],
    });
  });

  it('trims title and userId before creating a todo', async () => {
    const deps = await seededDependencies();
    const create = vi.spyOn(deps.store.todos, 'create');
    await createTodo(request('POST', 'http://localhost/api/todos', { title: '  Write tests  ', userId: ' user-1 ' }), context(), deps);
    expect(create).toHaveBeenCalledWith({ title: 'Write tests', userId: 'user-1' });
  });

  it('accepts a title of exactly 500 characters', async () => {
    const response = await createTodo(request('POST', 'http://localhost/api/todos', { title: 'x'.repeat(500), userId: 'user-1' }), context(), await seededDependencies());
    expect(response.status).toBe(201);
  });

  it.each([
    ['missing', undefined],
    ['whitespace-only', '   '],
    ['501-character', 'x'.repeat(501)],
  ])('rejects a %s create title with VALIDATION_ERROR', async (_case, title) => {
    const response = await createTodo(request('POST', 'http://localhost/api/todos', { title, userId: 'user-1' }), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it.each([
    ['missing', undefined],
    ['whitespace-only', '   '],
    ['101-character', 'x'.repeat(101)],
  ])('rejects a %s create userId with VALIDATION_ERROR', async (_case, userId) => {
    const response = await createTodo(request('POST', 'http://localhost/api/todos', { title: 'Write tests', userId }), context(), await seededDependencies());
    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });

  it('returns the created todo without rereading the todo list', async () => {
    const deps = await seededDependencies();
    const getAll = vi.spyOn(deps.store.todos, 'getAll');
    const response = await createTodo(request('POST', 'http://localhost/api/todos', { title: 'Write tests', userId: 'user-1' }), context(), deps);
    expect(response.jsonBody).toMatchObject({ title: 'Write tests', steps: [] });
    expect(getAll).not.toHaveBeenCalled();
  });
});
