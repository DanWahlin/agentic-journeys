import { describe, expect, it } from 'vitest';
import { updateStep } from '../../src/handlers/steps.js';
import type { HandlerDependencies } from '../../src/handlers/types.js';
import { context, expectErrorEnvelope, request, seededDependencies } from '../helpers.js';

async function call(todoId: string, stepId: string, body: unknown, deps = await seededDependencies()) {
  return updateStep(
    request('PATCH', `http://localhost/api/todos/${todoId}/steps/${stepId}`, body, { id: todoId, stepId }),
    context(),
    deps,
  );
}

describe('PATCH /api/todos/:id/steps/:stepId', () => {
  it('returns the updated action step', async () => {
    const response = await call('todo-2', 'step-2-3', { isCompleted: true });
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ id: 'step-2-3', todoId: 'todo-2', isCompleted: true });
  });

  it('returns 400 VALIDATION_ERROR when isCompleted is not boolean', async () => {
    expectErrorEnvelope(await call('todo-2', 'step-2-3', { isCompleted: 'true' }), 400, 'VALIDATION_ERROR');
  });

  it.each([
    ['unknown todo', 'unknown', 'step-2-3'],
    ['unknown step', 'todo-2', 'unknown'],
    ['step owned by another todo', 'todo-2', 'step-3-1'],
  ])('returns 404 NOT_FOUND for an %s', async (_case, todoId, stepId) => {
    expectErrorEnvelope(await call(todoId, stepId, { isCompleted: true }), 404, 'NOT_FOUND');
  });

  it('marks the todo completed when all steps are complete', async () => {
    const deps = await seededDependencies();
    await call('todo-2', 'step-2-3', { isCompleted: true }, deps);
    await call('todo-2', 'step-2-4', { isCompleted: true }, deps);
    expect(await deps.store.todos.getById('todo-2')).toMatchObject({ status: 'completed' });
  });

  it('reopens a completed todo when a step is unchecked', async () => {
    const deps = await seededDependencies();
    await call('todo-3', 'step-3-1', { isCompleted: false }, deps);
    expect(await deps.store.todos.getById('todo-3')).toMatchObject({ status: 'in_progress' });
  });

  it('moves a pending todo to in_progress after partial step completion', async () => {
    const deps = await pendingTodoWithSteps(2);
    await call('todo-1', 'pending-step-1', { isCompleted: true }, deps);
    expect(await deps.store.todos.getById('todo-1')).toMatchObject({ status: 'in_progress' });
  });

  it('marks a pending todo completed when its only step is completed', async () => {
    const deps = await pendingTodoWithSteps(1);
    await call('todo-1', 'pending-step-1', { isCompleted: true }, deps);
    expect(await deps.store.todos.getById('todo-1')).toMatchObject({ status: 'completed' });
  });
});

async function pendingTodoWithSteps(count: number): Promise<HandlerDependencies> {
  const deps = await seededDependencies();
  for (let index = 1; index <= count; index += 1) {
    await deps.store.actionSteps.create({
      id: `pending-step-${index}`,
      todoId: 'todo-1',
      title: `Step ${index}`,
      description: `Detail ${index}`,
      order: index,
    });
  }
  return deps;
}
