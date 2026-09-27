import { randomUUID } from 'node:crypto';
import { ApiError, handleErrors } from './error-wrapper.js';
import type { ApiHandler } from './types.js';

async function readObjectBody(request: Parameters<ApiHandler>[0]): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The request body must be valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export const generateSteps: ApiHandler = async (request, context, dependencies) =>
  handleErrors(context, async () => {
    const todo = await dependencies.store.todos.getById(request.params.id);
    if (!todo) throw new ApiError(404, 'NOT_FOUND', 'Todo not found.');
    if (todo.stepsGenerated) {
      await dependencies.store.actionSteps.deleteByTodoId(todo.id);
    }
    const generated = await dependencies.generator.generate(todo.title);
    const steps = [];
    for (let index = 0; index < generated.length; index += 1) {
      const generatedStep = generated[index];
      steps.push(await dependencies.store.actionSteps.create({
        id: randomUUID(),
        todoId: todo.id,
        title: generatedStep.title,
        description: generatedStep.description,
        order: index + 1,
      }));
    }
    const updated = await dependencies.store.todos.update(todo.id, {
      stepsGenerated: true,
      status: todo.status === 'completed' ? 'in_progress' : todo.status,
    });
    return { status: 200, jsonBody: { ...updated, steps } };
  });

export const updateStep: ApiHandler = async (request, context, dependencies) =>
  handleErrors(context, async () => {
    const todo = await dependencies.store.todos.getById(request.params.id);
    if (!todo) throw new ApiError(404, 'NOT_FOUND', 'Todo not found.');
    const steps = await dependencies.store.actionSteps.getByTodoId(todo.id);
    const step = steps.find((candidate) => candidate.id === request.params.stepId);
    if (!step) throw new ApiError(404, 'NOT_FOUND', 'Action step not found.');
    const body = await readObjectBody(request);
    if (typeof body.isCompleted !== 'boolean') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'isCompleted must be a boolean.');
    }
    const updated = await dependencies.store.actionSteps.update(step.id, {
      isCompleted: body.isCompleted,
    });
    const currentSteps = await dependencies.store.actionSteps.getByTodoId(todo.id);
    if (currentSteps.length > 0 && currentSteps.every((candidate) => candidate.isCompleted)) {
      await dependencies.store.todos.update(todo.id, { status: 'completed' });
    } else if (!body.isCompleted && todo.status === 'completed') {
      await dependencies.store.todos.update(todo.id, { status: 'in_progress' });
    } else if (body.isCompleted && todo.status === 'pending') {
      await dependencies.store.todos.update(todo.id, { status: 'in_progress' });
    }
    return { status: 200, jsonBody: updated };
  });
