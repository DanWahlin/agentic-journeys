import { randomUUID } from 'node:crypto';
import type { DataStore } from './contracts.js';
import type {
  ActionStep,
  CreateActionStepInput,
  CreateTodoInput,
  Todo,
  UpdateActionStepInput,
  UpdateTodoInput,
} from '../models/index.js';
import { getSeedData } from './seed-data.js';

export async function createMemoryStore(): Promise<DataStore> {
  const todos = new Map<string, Todo>();
  const actionSteps = new Map<string, ActionStep>();
  let initialized = false;

  function nextUpdatedAt(previous: string): string {
    const now = Date.now();
    return new Date(Math.max(now, Date.parse(previous) + 1)).toISOString();
  }

  const store: DataStore = {
    async initialize() {
      if (initialized) return;
      const seed = getSeedData();
      for (const todo of seed.todos) {
        if (!todos.has(todo.id)) todos.set(todo.id, { ...todo });
      }
      for (const step of seed.actionSteps) {
        if (!actionSteps.has(step.id)) actionSteps.set(step.id, { ...step });
      }
      initialized = true;
    },
    todos: {
      async getAll(userId: string) {
        return [...todos.values()]
          .filter((todo) => todo.userId === userId)
          .map((todo) => ({ ...todo }));
      },
      async getById(id: string) {
        const todo = todos.get(id);
        return todo ? { ...todo } : null;
      },
      async create(input: CreateTodoInput) {
        const now = new Date().toISOString();
        const todo: Todo = {
          id: randomUUID(),
          title: input.title,
          userId: input.userId,
          status: 'pending',
          stepsGenerated: false,
          createdAt: now,
          updatedAt: now,
        };
        todos.set(todo.id, todo);
        return { ...todo };
      },
      async update(id: string, updates: UpdateTodoInput) {
        const current = todos.get(id);
        if (!current) throw new Error(`Todo ${id} was not found`);
        const updated: Todo = {
          ...current,
          ...updates,
          updatedAt: nextUpdatedAt(current.updatedAt),
        };
        todos.set(id, updated);
        return { ...updated };
      },
      async delete(id: string) {
        todos.delete(id);
        for (const [stepId, step] of actionSteps) {
          if (step.todoId === id) actionSteps.delete(stepId);
        }
      },
    },
    actionSteps: {
      async getByTodoId(todoId: string) {
        return [...actionSteps.values()]
          .filter((step) => step.todoId === todoId)
          .sort((left, right) => left.order - right.order)
          .map((step) => ({ ...step }));
      },
      async getByTodoIds(todoIds: string[]) {
        const ids = new Set(todoIds);
        return [...actionSteps.values()]
          .filter((step) => ids.has(step.todoId))
          .sort((left, right) => left.order - right.order)
          .map((step) => ({ ...step }));
      },
      async create(input: CreateActionStepInput) {
        if (!todos.has(input.todoId)) throw new Error(`Todo ${input.todoId} was not found`);
        const step: ActionStep = {
          id: input.id ?? randomUUID(),
          todoId: input.todoId,
          title: input.title,
          description: input.description,
          order: input.order,
          isCompleted: false,
          createdAt: new Date().toISOString(),
        };
        actionSteps.set(step.id, step);
        return { ...step };
      },
      async update(id: string, updates: UpdateActionStepInput) {
        const current = actionSteps.get(id);
        if (!current) throw new Error(`Action step ${id} was not found`);
        const updated = { ...current, ...updates };
        actionSteps.set(id, updated);
        return { ...updated };
      },
      async deleteByTodoId(todoId: string) {
        for (const [stepId, step] of actionSteps) {
          if (step.todoId === todoId) actionSteps.delete(stepId);
        }
      },
    },
  };

  return store;
}
