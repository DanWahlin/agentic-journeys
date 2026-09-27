import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqlStore } from '../../src/data/sql-store.js';

const state = vi.hoisted(() => ({
  bindings: [] as Array<{ name: string; type: unknown; value: unknown }>,
  pendingBindings: [] as Array<{ name: string; type: unknown; value: unknown }>,
  executions: [] as Array<{
    sql: string;
    bindings: Array<{ name: string; type: unknown; value: unknown }>;
  }>,
  results: [] as Array<{ recordset?: unknown[]; rowsAffected?: number[] }>,
  queries: [] as string[],
  request: vi.fn(),
  close: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('mssql', () => {
  const fakeRequest = {
    input: vi.fn((name: string, type: unknown, value: unknown) => {
      const binding = { name, type, value };
      state.bindings.push(binding);
      state.pendingBindings.push(binding);
      return fakeRequest;
    }),
    query: vi.fn(async (sql: string) => {
      state.queries.push(sql);
      state.executions.push({ sql, bindings: [...state.pendingBindings] });
      state.pendingBindings.length = 0;
      return state.results.shift() ?? { recordset: [], rowsAffected: [0] };
    }),
  };
  state.request.mockImplementation(() => fakeRequest);
  class ConnectionPool {
    request = state.request;
    close = state.close;
    connect = state.connect;
  }
  class Transaction {
    request = state.request;
    begin = vi.fn();
    commit = vi.fn();
    rollback = vi.fn();
  }
  const driver = {
    ConnectionPool,
    Transaction,
    Request: class {
      input = fakeRequest.input;
      query = fakeRequest.query;
    },
    NVarChar: vi.fn((size?: number) => ({ name: 'NVarChar', size })),
    Int: { name: 'Int' },
    Bit: { name: 'Bit' },
    DateTime2: { name: 'DateTime2' },
    MAX: -1,
  };
  return { ...driver, default: driver };
});

describe('Azure SQL store boundaries', () => {
  beforeEach(() => {
    state.bindings.length = 0;
    state.pendingBindings.length = 0;
    state.executions.length = 0;
    state.results.length = 0;
    state.queries.length = 0;
    state.request.mockClear();
    state.close.mockClear();
    state.connect.mockClear();
  });

  it('batches getByTodoIds requests at one thousand ids', async () => {
    const store = await createSqlStore({ server: 'example.database.windows.net', database: 'SmartTodo' });
    await store.actionSteps.getByTodoIds(Array.from({ length: 2001 }, (_, index) => `todo-${index}`));
    expect(state.request).toHaveBeenCalledTimes(3);
  });

  it('binds SQL parameters with column-compatible types', async () => {
    const store = await createSqlStore({ server: 'example.database.windows.net', database: 'SmartTodo' });
    await store.todos.create({ title: 'Typed values', userId: 'user-1' });
    await store.actionSteps.create({
      todoId: 'todo-1',
      title: 'Typed step',
      description: 'Typed detail',
      order: 1,
    });
    expect(state.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'title', value: 'Typed values' }),
      expect.objectContaining({ name: 'userId', value: 'user-1' }),
      expect.objectContaining({ name: 'order', value: 1 }),
    ]));
    expect(state.bindings.every((binding) => binding.type !== undefined)).toBe(true);
    expect(state.bindings.find((binding) => binding.name === 'order')?.value).toEqual(expect.any(Number));
  });

  it('returns the exact persisted updatedAt despite SQL precision and host clock skew', async () => {
    const existing = {
      id: 'todo-clock',
      title: 'Before',
      status: 'pending',
      userId: 'user-clock',
      stepsGenerated: false,
      createdAt: '2026-01-01T00:00:00.0000000Z',
      updatedAt: '2026-01-01T00:00:00.1234560Z',
    };
    const persisted = {
      ...existing,
      title: 'After',
      updatedAt: '2026-01-01T00:00:00.1234570Z',
    };
    state.results.push({ recordset: [existing], rowsAffected: [1] });
    state.results.push({ recordset: [persisted], rowsAffected: [1] });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-01T12:00:00.000Z'));

    try {
      const store = await createSqlStore({ server: 'example.database.windows.net', database: 'SmartTodo' });
      const updated = await store.todos.update(existing.id, { title: 'After' });
      const updateStatement = state.queries.find((statement) => statement.startsWith('UPDATE Todos'));

      expect.soft(updateStatement).toContain('OUTPUT INSERTED.*');
      expect.soft(updated).toEqual(persisted);
      expect.soft(updated.updatedAt).toBe('2026-01-01T00:00:00.1234570Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes the transaction migration lock before ordered migrations', async () => {
    const store = await createSqlStore({ server: 'example.database.windows.net', database: 'SmartTodo' });
    await store.initialize();
    const lockIndex = state.queries.findIndex((statement) => statement.includes('sp_getapplock'));
    const firstDdlIndex = state.queries.findIndex((statement) => /CREATE TABLE|ALTER TABLE|CREATE INDEX/.test(statement));
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(firstDdlIndex).toBeGreaterThan(lockIndex);
    expect(state.queries[lockIndex]).toContain("@LockOwner = 'Transaction'");
  });

  it('initializes the same SQL database twice without changes', async () => {
    const store = await createSqlStore({ server: 'example.database.windows.net', database: 'SmartTodo' });
    await store.initialize();
    const firstRun = [...state.queries];
    await store.initialize();
    expect(state.queries.slice(firstRun.length)).toEqual(firstRun);
  });

  it('initializes SQL with exact seed values and preserves existing completion state', async () => {
    const store = await createSqlStore({ server: 'example.database.windows.net', database: 'SmartTodo' });
    await store.initialize();
    await store.initialize();

    const todoSeeds = state.executions
      .filter(({ sql }) => sql.includes('IF NOT EXISTS (SELECT 1 FROM Todos WHERE id = @id)'))
      .map(({ bindings }) => Object.fromEntries(bindings.map(({ name, value }) => [name, value])));
    const stepSeeds = state.executions
      .filter(({ sql }) => sql.includes('IF NOT EXISTS (SELECT 1 FROM ActionSteps WHERE id = @id)'))
      .map(({ bindings }) => Object.fromEntries(bindings.map(({ name, value }) => [name, value])));

    expect(todoSeeds.slice(0, 3).map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'todo-1', status: 'pending' },
      { id: 'todo-2', status: 'in_progress' },
      { id: 'todo-3', status: 'completed' },
    ]);
    expect(stepSeeds.slice(0, 7).map(({ id, isCompleted }) => ({ id, isCompleted }))).toEqual([
      { id: 'step-2-1', isCompleted: true },
      { id: 'step-2-2', isCompleted: true },
      { id: 'step-2-3', isCompleted: false },
      { id: 'step-2-4', isCompleted: false },
      { id: 'step-3-1', isCompleted: true },
      { id: 'step-3-2', isCompleted: true },
      { id: 'step-3-3', isCompleted: true },
    ]);
    expect(todoSeeds.slice(3)).toEqual(todoSeeds.slice(0, 3));
    expect(stepSeeds.slice(7)).toEqual(stepSeeds.slice(0, 7));
    expect(state.executions
      .filter(({ sql }) => sql.includes('INSERT INTO ActionSteps'))
      .every(({ sql }) => sql.includes('IF NOT EXISTS'))).toBe(true);
  });
});
