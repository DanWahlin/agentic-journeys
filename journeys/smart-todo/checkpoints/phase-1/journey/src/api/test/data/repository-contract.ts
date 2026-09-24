import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataStore } from '../../src/data/contracts.js';

export function repositoryContractSuite(
  name: string,
  createStore: () => Promise<DataStore>,
): void {
  describe(`${name} repository contract`, () => {
    let store: DataStore;
    const userId = `contract-${name}-${randomUUID()}`;
    let createdTodoIds: string[];

    beforeEach(async () => {
      store = await createStore();
      await store.initialize();
      createdTodoIds = [];
    });

    afterEach(async () => {
      await Promise.all(createdTodoIds.map((todoId) => store.todos.delete(todoId)));
    });

    it('satisfies create, read, update, delete, bulk loading, and ordering', async () => {
      const todo = await store.todos.create({ title: 'Contract todo', userId });
      createdTodoIds.push(todo.id);
      expect(await store.todos.getById(todo.id)).toEqual(todo);
      expect(await store.todos.getAll(userId)).toContainEqual(todo);

      const second = await store.actionSteps.create({
        todoId: todo.id,
        title: 'Second',
        description: 'Second detail',
        order: 2,
      });
      const first = await store.actionSteps.create({
        todoId: todo.id,
        title: 'First',
        description: 'First detail',
        order: 1,
      });
      expect(await store.actionSteps.getByTodoIds([todo.id])).toEqual([first, second]);

      const changed = await store.todos.update(todo.id, { title: 'Changed' });
      expect(changed.title).toBe('Changed');
      expect((await store.actionSteps.update(first.id, { isCompleted: true })).isCompleted).toBe(true);

      await store.todos.delete(todo.id);
      expect(await store.todos.getById(todo.id)).toBeNull();
      expect(await store.actionSteps.getByTodoId(todo.id)).toEqual([]);
    });

    it('rejects an action step for an unknown todo', async () => {
      await expect(store.actionSteps.create({
        todoId: 'missing',
        title: 'Orphan',
        description: 'Must fail',
        order: 1,
      })).rejects.toThrow();
    });

    it('advances updatedAt even when the clock has not advanced', async () => {
      const todo = await store.todos.create({ title: 'Clock test', userId });
      createdTodoIds.push(todo.id);
      const updated = await store.todos.update(todo.id, { title: 'Immediate update' });
      expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(todo.updatedAt));
    });
  });
}
