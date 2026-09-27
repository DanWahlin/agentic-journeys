import { pathToFileURL } from 'node:url';
import sql from 'mssql';
import { getSeedData } from './seed-data.js';

export async function seedDatabase(): Promise<void> {
  const pool = await sql.connect({
    server: process.env.AZURE_SQL_SERVER ?? '',
    database: process.env.AZURE_SQL_DATABASE ?? 'SmartTodo',
    authentication: {
      type: 'azure-active-directory-default',
      options: process.env.AZURE_SQL_CLIENT_ID ? { clientId: process.env.AZURE_SQL_CLIENT_ID } : {},
    },
    options: { encrypt: true },
  });
  try {
    const seed = getSeedData();
    for (const todo of seed.todos) {
      await pool.request()
        .input('id', sql.NVarChar(36), todo.id)
        .input('title', sql.NVarChar(500), todo.title)
        .input('status', sql.NVarChar(20), todo.status)
        .input('userId', sql.NVarChar(100), todo.userId)
        .input('stepsGenerated', sql.Bit, todo.stepsGenerated)
        .query(`IF NOT EXISTS (SELECT 1 FROM Todos WHERE id = @id)
          INSERT INTO Todos (id, title, status, userId, stepsGenerated)
          VALUES (@id, @title, @status, @userId, @stepsGenerated)`);
    }
    for (const step of seed.actionSteps) {
      await pool.request()
        .input('id', sql.NVarChar(36), step.id)
        .input('todoId', sql.NVarChar(36), step.todoId)
        .input('title', sql.NVarChar(200), step.title)
        .input('description', sql.NVarChar(1000), step.description)
        .input('order', sql.Int, step.order)
        .input('isCompleted', sql.Bit, step.isCompleted)
        .query(`IF NOT EXISTS (SELECT 1 FROM ActionSteps WHERE id = @id)
          INSERT INTO ActionSteps (id, todoId, title, description, [order], isCompleted)
          VALUES (@id, @todoId, @title, @description, @order, @isCompleted)`);
    }
  } finally {
    await pool.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedDatabase();
}
