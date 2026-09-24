import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { getSeedData } from '../../src/data/seed-data.js';
import { createMemoryStore } from '../../src/data/memory-store.js';
import { seedDatabase } from '../../src/data/seed.js';

const sqlState = vi.hoisted(() => ({
  close: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(async () => ({ recordset: [], rowsAffected: [0] })),
}));

vi.mock('mssql', () => {
  const pool = {
    close: sqlState.close,
    connect: sqlState.connect,
    request: vi.fn(() => ({
      input() { return this; },
      query: sqlState.query,
    })),
  };
  const connect = vi.fn(async () => pool);
  class ConnectionPool {
    close = sqlState.close;
    connect = vi.fn(async () => this);
    request = pool.request;
  }
  const driver = { connect, ConnectionPool, NVarChar: vi.fn(), Int: {}, Bit: {} };
  return { ...driver, default: driver };
});

describe('deterministic seed data', () => {
  it('loads the exact deterministic seed data', () => {
    const seed = getSeedData();
    expect(seed.todos.map(({ id, status, stepsGenerated }) => ({ id, status, stepsGenerated }))).toEqual([
      { id: 'todo-1', status: 'pending', stepsGenerated: false },
      { id: 'todo-2', status: 'in_progress', stepsGenerated: true },
      { id: 'todo-3', status: 'completed', stepsGenerated: true },
    ]);
    expect(seed.actionSteps.map(({ id, todoId, order, isCompleted }) => ({ id, todoId, order, isCompleted }))).toEqual([
      { id: 'step-2-1', todoId: 'todo-2', order: 1, isCompleted: true },
      { id: 'step-2-2', todoId: 'todo-2', order: 2, isCompleted: true },
      { id: 'step-2-3', todoId: 'todo-2', order: 3, isCompleted: false },
      { id: 'step-2-4', todoId: 'todo-2', order: 4, isCompleted: false },
      { id: 'step-3-1', todoId: 'todo-3', order: 1, isCompleted: true },
      { id: 'step-3-2', todoId: 'todo-3', order: 2, isCompleted: true },
      { id: 'step-3-3', todoId: 'todo-3', order: 3, isCompleted: true },
    ]);
  });

  it('seeds idempotently without resetting existing state', async () => {
    const store = await createMemoryStore();
    await store.initialize();
    await store.actionSteps.update('step-2-3', { isCompleted: true });
    await store.initialize();
    expect(await store.todos.getAll('user-1')).toHaveLength(3);
    expect(await store.actionSteps.getByTodoId('todo-2')).toHaveLength(4);
    expect((await store.actionSteps.getByTodoId('todo-2')).find((step) => step.id === 'step-2-3')?.isCompleted).toBe(true);
  });

  it('runs the seed entry point when invoked through npm run seed', async () => {
    const originalScript = process.argv[1];
    process.argv[1] = fileURLToPath(new URL('../../src/data/seed.ts', import.meta.url));
    sqlState.query.mockClear();
    sqlState.close.mockClear();
    try {
      await expect(import(`../../src/data/seed.ts?entry=${Date.now()}`)).resolves.toBeDefined();
      expect(sqlState.query).toHaveBeenCalled();
      expect(sqlState.close).toHaveBeenCalledOnce();
    } finally {
      process.argv[1] = originalScript;
    }
  });

  it('closes the seed SQL pool after success', async () => {
    sqlState.close.mockClear();
    await expect(seedDatabase()).resolves.toBeUndefined();
    expect(sqlState.close).toHaveBeenCalledOnce();
  });

  it('closes the seed SQL pool after an error', async () => {
    sqlState.close.mockClear();
    sqlState.query.mockRejectedValueOnce(new Error('seed insert failed'));
    await expect(seedDatabase()).rejects.toThrow('seed insert failed');
    expect(sqlState.close).toHaveBeenCalledOnce();
  });
});
