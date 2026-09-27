import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import type { DataStore } from './contracts.js';
import type {
  ActionStep,
  CreateActionStepInput,
  CreateTodoInput,
  Todo,
  UpdateActionStepInput,
  UpdateTodoInput,
} from '../models/index.js';
import * as migrations from './migrations.js';
import { getSeedData } from './seed-data.js';

export interface SqlStoreOptions {
  server?: string;
  database?: string;
  pool?: unknown;
}

type RequestLike = {
  input(name: string, type: unknown, value: unknown): RequestLike;
  query(statement: string): Promise<{ recordset?: unknown[]; rowsAffected?: number[] }>;
};

type PoolLike = {
  connect(): Promise<unknown>;
  close(): Promise<void>;
  request(): RequestLike;
};

function asIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapTodo(row: Record<string, unknown>): Todo {
  return {
    id: String(row.id),
    title: String(row.title),
    status: row.status as Todo['status'],
    userId: String(row.userId),
    stepsGenerated: Boolean(row.stepsGenerated),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
  };
}

function mapStep(row: Record<string, unknown>): ActionStep {
  return {
    id: String(row.id),
    todoId: String(row.todoId),
    title: String(row.title),
    description: String(row.description),
    order: Number(row.order),
    isCompleted: Boolean(row.isCompleted),
    createdAt: asIso(row.createdAt),
  };
}

function sqlConfig(options: SqlStoreOptions): sql.config {
  const clientId = process.env.AZURE_SQL_CLIENT_ID;
  return {
    server: options.server ?? process.env.AZURE_SQL_SERVER ?? '',
    database: options.database ?? process.env.AZURE_SQL_DATABASE ?? 'SmartTodo',
    authentication: {
      type: 'azure-active-directory-default',
      options: clientId ? { clientId } : {},
    },
    options: { encrypt: true },
  };
}

export async function createSqlStore(options: SqlStoreOptions = {}): Promise<DataStore> {
  const pool = (options.pool ?? new sql.ConnectionPool(sqlConfig(options))) as PoolLike;
  await pool.connect();

  const store: DataStore = {
    async initialize() {
      const transaction = new sql.Transaction(pool as never);
      await transaction.begin();
      try {
        await (transaction.request() as unknown as RequestLike).query(
          `EXEC sp_getapplock @Resource = 'smart-todo-migrations',
             @LockMode = 'Exclusive', @LockOwner = 'Transaction'`,
        );
        for (const statement of migrations.MIGRATIONS) {
          await (transaction.request() as unknown as RequestLike).query(statement);
        }
        await insertSeedRows(() => transaction.request() as unknown as RequestLike);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
    async close() {
      await pool.close();
    },
    todos: {
      async getAll(userId: string) {
        const result = await pool.request()
          .input('userId', sql.NVarChar(100), userId)
          .query('SELECT * FROM Todos WHERE userId = @userId ORDER BY createdAt, id');
        return (result.recordset ?? []).map((row) => mapTodo(row as Record<string, unknown>));
      },
      async getById(id: string) {
        const result = await pool.request()
          .input('id', sql.NVarChar(36), id)
          .query('SELECT * FROM Todos WHERE id = @id');
        const row = result.recordset?.[0];
        return row ? mapTodo(row as Record<string, unknown>) : null;
      },
      async create(input: CreateTodoInput) {
        const id = randomUUID();
        const now = new Date();
        const todo: Todo = {
          id,
          title: input.title,
          userId: input.userId,
          status: 'pending',
          stepsGenerated: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        await pool.request()
          .input('id', sql.NVarChar(36), id)
          .input('title', sql.NVarChar(500), input.title)
          .input('userId', sql.NVarChar(100), input.userId)
          .input('status', sql.NVarChar(20), todo.status)
          .input('stepsGenerated', sql.Bit, false)
          .input('createdAt', sql.DateTime2, now)
          .input('updatedAt', sql.DateTime2, now)
          .query(`INSERT INTO Todos
            (id, title, userId, status, stepsGenerated, createdAt, updatedAt)
            VALUES (@id, @title, @userId, @status, @stepsGenerated, @createdAt, @updatedAt)`);
        return todo;
      },
      async update(id: string, updates: UpdateTodoInput) {
        const current = await store.todos.getById(id);
        if (!current) throw new Error(`Todo ${id} was not found`);
        const request = pool.request().input('id', sql.NVarChar(36), id);
        const assignments: string[] = [];
        if (updates.title !== undefined) {
          request.input('title', sql.NVarChar(500), updates.title);
          assignments.push('title = @title');
        }
        if (updates.status !== undefined) {
          request.input('status', sql.NVarChar(20), updates.status);
          assignments.push('status = @status');
        }
        if (updates.stepsGenerated !== undefined) {
          request.input('stepsGenerated', sql.Bit, updates.stepsGenerated);
          assignments.push('stepsGenerated = @stepsGenerated');
        }
        assignments.push(`updatedAt = CASE
          WHEN SYSUTCDATETIME() > updatedAt THEN SYSUTCDATETIME()
          ELSE DATEADD(microsecond, 1, updatedAt) END`);
        const result = await request.query(
          `UPDATE Todos SET ${assignments.join(', ')} OUTPUT INSERTED.* WHERE id = @id`,
        );
        const row = result.recordset?.[0];
        if (!row) throw new Error(`Todo ${id} update returned no row`);
        return mapTodo(row as Record<string, unknown>);
      },
      async delete(id: string) {
        await pool.request().input('id', sql.NVarChar(36), id).query('DELETE FROM Todos WHERE id = @id');
      },
    },
    actionSteps: {
      async getByTodoId(todoId: string) {
        const result = await pool.request()
          .input('todoId', sql.NVarChar(36), todoId)
          .query('SELECT * FROM ActionSteps WHERE todoId = @todoId ORDER BY [order]');
        return (result.recordset ?? []).map((row) => mapStep(row as Record<string, unknown>));
      },
      async getByTodoIds(todoIds: string[]) {
        if (todoIds.length === 0) return [];
        const steps: ActionStep[] = [];
        for (let offset = 0; offset < todoIds.length; offset += 1000) {
          const batch = todoIds.slice(offset, offset + 1000);
          const request = pool.request();
          const names = batch.map((id, index) => {
            const name = `todoId${index}`;
            request.input(name, sql.NVarChar(36), id);
            return `@${name}`;
          });
          const result = await request.query(
            `SELECT * FROM ActionSteps WHERE todoId IN (${names.join(', ')}) ORDER BY todoId, [order]`,
          );
          steps.push(...(result.recordset ?? []).map((row) => mapStep(row as Record<string, unknown>)));
        }
        return steps;
      },
      async create(input: CreateActionStepInput) {
        const id = input.id ?? randomUUID();
        const now = new Date();
        const step: ActionStep = {
          ...input,
          id,
          isCompleted: false,
          createdAt: now.toISOString(),
        };
        await pool.request()
          .input('id', sql.NVarChar(36), id)
          .input('todoId', sql.NVarChar(36), input.todoId)
          .input('title', sql.NVarChar(200), input.title)
          .input('description', sql.NVarChar(1000), input.description)
          .input('order', sql.Int, input.order)
          .input('isCompleted', sql.Bit, false)
          .input('createdAt', sql.DateTime2, now)
          .query(`INSERT INTO ActionSteps
            (id, todoId, title, description, [order], isCompleted, createdAt)
            VALUES (@id, @todoId, @title, @description, @order, @isCompleted, @createdAt)`);
        return step;
      },
      async update(id: string, updates: UpdateActionStepInput) {
        await pool.request()
          .input('id', sql.NVarChar(36), id)
          .input('isCompleted', sql.Bit, updates.isCompleted)
          .query('UPDATE ActionSteps SET isCompleted = @isCompleted WHERE id = @id');
        const result = await pool.request()
          .input('id', sql.NVarChar(36), id)
          .query('SELECT * FROM ActionSteps WHERE id = @id');
        const row = result.recordset?.[0];
        if (!row) throw new Error(`Action step ${id} was not found`);
        return mapStep(row as Record<string, unknown>);
      },
      async deleteByTodoId(todoId: string) {
        await pool.request()
          .input('todoId', sql.NVarChar(36), todoId)
          .query('DELETE FROM ActionSteps WHERE todoId = @todoId');
      },
    },
  };

  return store;
}

async function insertSeedRows(requestFactory: () => RequestLike): Promise<void> {
  const seed = getSeedData();
  for (const todo of seed.todos) {
    await requestFactory()
      .input('id', sql.NVarChar(36), todo.id)
      .input('title', sql.NVarChar(500), todo.title)
      .input('status', sql.NVarChar(20), todo.status)
      .input('userId', sql.NVarChar(100), todo.userId)
      .input('stepsGenerated', sql.Bit, todo.stepsGenerated)
      .input('createdAt', sql.DateTime2, new Date(todo.createdAt))
      .input('updatedAt', sql.DateTime2, new Date(todo.updatedAt))
      .query(`IF NOT EXISTS (SELECT 1 FROM Todos WHERE id = @id)
        INSERT INTO Todos (id, title, status, userId, stepsGenerated, createdAt, updatedAt)
        VALUES (@id, @title, @status, @userId, @stepsGenerated, @createdAt, @updatedAt)`);
  }
  for (const step of seed.actionSteps) {
    await requestFactory()
      .input('id', sql.NVarChar(36), step.id)
      .input('todoId', sql.NVarChar(36), step.todoId)
      .input('title', sql.NVarChar(200), step.title)
      .input('description', sql.NVarChar(1000), step.description)
      .input('order', sql.Int, step.order)
      .input('isCompleted', sql.Bit, step.isCompleted)
      .input('createdAt', sql.DateTime2, new Date(step.createdAt))
      .query(`IF NOT EXISTS (SELECT 1 FROM ActionSteps WHERE id = @id)
        INSERT INTO ActionSteps (id, todoId, title, description, [order], isCompleted, createdAt)
        VALUES (@id, @todoId, @title, @description, @order, @isCompleted, @createdAt)`);
  }
}
