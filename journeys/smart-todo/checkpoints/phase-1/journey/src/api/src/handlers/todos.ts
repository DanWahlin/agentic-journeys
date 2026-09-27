import type { HttpRequest } from '@azure/functions';
import type { Todo, TodoStatus, TodoWithSteps } from '../models/index.js';
import { ApiError, handleErrors } from './error-wrapper.js';
import type { ApiHandler, HandlerDependencies } from './types.js';

const statuses = new Set<TodoStatus>(['pending', 'in_progress', 'completed']);

async function objectBody(request: HttpRequest): Promise<Record<string, unknown>> {
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

function validTrimmedString(
  value: unknown,
  maximum: number,
  field: string,
): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be between 1 and ${maximum} characters.`);
  }
  return trimmed;
}

async function attachSteps(todo: Todo, dependencies: HandlerDependencies): Promise<TodoWithSteps> {
  return {
    ...todo,
    steps: await dependencies.store.actionSteps.getByTodoId(todo.id),
  };
}

export const listTodos: ApiHandler = async (request, context, dependencies) =>
  handleErrors(context, async () => {
    const userId = validTrimmedString(request.query.get('userId'), 100, 'userId');
    const todos = await dependencies.store.todos.getAll(userId);
    const steps = await dependencies.store.actionSteps.getByTodoIds(todos.map((todo) => todo.id));
    return {
      status: 200,
      jsonBody: todos.map((todo) => ({
        ...todo,
        steps: steps.filter((step) => step.todoId === todo.id).sort((left, right) => left.order - right.order),
      })),
    };
  });

export const createTodo: ApiHandler = async (request, context, dependencies) =>
  handleErrors(context, async () => {
    const body = await objectBody(request);
    const title = validTrimmedString(body.title, 500, 'Title');
    const userId = validTrimmedString(body.userId, 100, 'userId');
    const todo = await dependencies.store.todos.create({ title, userId });
    return { status: 201, jsonBody: { ...todo, steps: [] } };
  });

export const updateTodo: ApiHandler = async (request, context, dependencies) =>
  handleErrors(context, async () => {
    const id = request.params.id;
    const existing = await dependencies.store.todos.getById(id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Todo not found.');
    const body = await objectBody(request);
    if (body.title === undefined && body.status === undefined) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'At least one supported update is required.');
    }
    const updates: { title?: string; status?: TodoStatus } = {};
    if (body.title !== undefined) updates.title = validTrimmedString(body.title, 500, 'Title');
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !statuses.has(body.status as TodoStatus)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Status is invalid.');
      }
      updates.status = body.status as TodoStatus;
    }
    const updated = await dependencies.store.todos.update(id, updates);
    return { status: 200, jsonBody: await attachSteps(updated, dependencies) };
  });

export const deleteTodo: ApiHandler = async (request, context, dependencies) =>
  handleErrors(context, async () => {
    const id = request.params.id;
    if (!await dependencies.store.todos.getById(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Todo not found.');
    }
    await dependencies.store.todos.delete(id);
    return { status: 204 };
  });
