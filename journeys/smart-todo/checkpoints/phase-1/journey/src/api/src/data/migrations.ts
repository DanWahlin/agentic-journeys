export const MIGRATIONS: readonly string[] = [
  `IF OBJECT_ID('Todos', 'U') IS NULL
   CREATE TABLE Todos (
     id NVARCHAR(36) PRIMARY KEY,
     title NVARCHAR(500) NOT NULL,
     status NVARCHAR(20) NOT NULL DEFAULT 'pending',
     userId NVARCHAR(100) NOT NULL,
     stepsGenerated BIT NOT NULL DEFAULT 0,
     createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
     updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
   )`,
  `IF NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = 'IX_Todos_UserId' AND object_id = OBJECT_ID('Todos')
   ) CREATE INDEX IX_Todos_UserId ON Todos(userId)`,
  `IF OBJECT_ID('ActionSteps', 'U') IS NULL
   CREATE TABLE ActionSteps (
     id NVARCHAR(36) PRIMARY KEY,
     todoId NVARCHAR(36) NOT NULL,
     title NVARCHAR(200) NOT NULL,
     description NVARCHAR(1000) NOT NULL,
     [order] INT NOT NULL,
     isCompleted BIT NOT NULL DEFAULT 0,
     createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
     CONSTRAINT FK_ActionSteps_Todos FOREIGN KEY (todoId) REFERENCES Todos(id) ON DELETE CASCADE
   )`,
  `IF NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = 'IX_ActionSteps_TodoId' AND object_id = OBJECT_ID('ActionSteps')
   ) CREATE INDEX IX_ActionSteps_TodoId ON ActionSteps(todoId)`,
];
