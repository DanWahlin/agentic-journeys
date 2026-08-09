# SmartTodo Phase 1: API and AI

Build the SmartTodo API, data model, repository layer, REST contracts, deterministic seed data, and AI task decomposition.

Read [`PLAN.md`](./PLAN.md) first for the journey vision, shared decisions, and end-to-end acceptance criteria. README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

**Out of scope:** No user authentication (anonymous for now), no push notifications, no collaboration/sharing, no offline sync, no recurring todos, no image attachments.

---

## Choose Your Stack

Pick your API language. Data models, endpoints, and acceptance criteria are identical across stacks. Azure Functions Flex Consumption is the hosting plan for all languages.

**Happy path (recommended for first run):** Node.js + TypeScript + Azure Functions v4, region `westus`, model `gpt-5-mini` (fallback `gpt-4.1`). Todo status enum: **`pending` | `in_progress` | `completed`** only (never `not_started`).

| | Node.js | Python | .NET | Java |
|---|---------|--------|------|------|
| **Framework** | Azure Functions Node.js v4 programming model (`@azure/functions`) + TypeScript | Azure Functions v4 runtime (Python v2 programming model) | Azure Functions isolated worker model + C# | Azure Functions + Java |
| **Azure SQL** | `mssql` + `@types/mssql` (dev) | `mssql-python` | `Microsoft.Data.SqlClient` | `mssql-jdbc` (`com.microsoft.sqlserver:mssql-jdbc`) |
| **AI** | `openai` | `openai` | `OpenAI` | `com.openai:openai-java` |

The client uses Swift and SwiftUI (iOS 17+). **Mac + Xcode are required for the iOS client.** Deploy the backend with **azd** + **Bicep**. Prefer Azure Verified Modules (AVM), but use raw `Microsoft.*` resources when AVM parameter drift blocks deployment.

The iOS app is NOT deployed by azd — only the Azure backend is. The app points at the deployed API URL via a `Config.swift` file.

## Project Structure

```
smart-todo/
├── src/
│   ├── api/                    # Azure Functions (your chosen language)
│   │   ├── host.json
│   │   ├── local.settings.json
│   │   └── src/
│   │       ├── functions/      # HTTP-triggered functions
│   │       ├── data/           # Repository pattern + Azure SQL
│   │       ├── ai/             # AI task decomposition
│   │       └── models/         # Data models
│   └── ios/
│       └── SmartTodo/
│           ├── SmartTodo.xcodeproj
│           ├── SmartTodoApp.swift
│           ├── Config.swift
│           ├── Models/
│           ├── Services/
│           └── Views/
├── infra/                      # Bicep with AVM modules or raw Microsoft.* resources
│   ├── main.bicep
│   ├── main.parameters.json
│   ├── abbreviations.json
│   └── modules/
└── azure.yaml                  # azd configuration
```

The API must follow the **repository pattern** (interfaces/contracts → implementations → factory) so functions never import the database client directly. Define repository contracts as interfaces or protocols in your chosen language. The data layer uses Azure SQL.

---

## API

Build the API with Azure SQL Database. Use an existing Azure SQL instance during local development; the Azure Deployment section provisions the instance used by the deployed app.

### Data Access Layer

Define these repository contracts as interfaces or protocols in your chosen language:

```
TodoRepository:
  getAll(userId) → Todo[]
  getById(id) → Todo | null
  create(input) → Todo
  update(id, updates) → Todo
  delete(id) → void

ActionStepRepository:
  getByTodoId(todoId) → ActionStep[]
  create(step) → ActionStep
  update(id, updates) → ActionStep
  deleteByTodoId(todoId) → void

DataStore:
  todos: TodoRepository
  actionSteps: ActionStepRepository
  initialize() → void
```

Functions never import the database client directly — they get a `DataStore` from the factory. The factory should call `initialize()` once and cache the result so that HTTP function handlers don't pay the cost of `CREATE TABLE IF NOT EXISTS` on every request.

> **Note:** The `update()` method on `TodoRepository` must also support updating `stepsGenerated` (boolean) — the `generateSteps` function sets this to `true` after inserting AI-generated steps. Include `stepsGenerated` as an optional field in your update input type alongside `title` and `status`.

**Node.js entry point note:** Set `"main": "dist/functions/*.js"` in `package.json` — this must match where `tsc` emits the compiled function files. Since `tsconfig.json` uses `rootDir: "src"` and `outDir: "dist"`, source files under `src/functions/` compile to `dist/functions/` (the `src/` prefix is stripped). A common mistake is writing `"main": "dist/src/functions/*.js"` which causes Azure Functions Core Tools to find zero functions.

**Node.js deployment note:** For `azd` remote/Oryx build, do not exclude `src/` or `tsconfig.json` in `.funcignore`; Azure needs both to compile TypeScript. Exclude `node_modules/`, `dist/**/*.map`, and `local.settings.json`.

**Local Functions storage:** When `local.settings.json` uses `AzureWebJobsStorage=UseDevelopmentStorage=true`, Azurite is a required local prerequisite. Start it before `func start`, or configure a real development Storage account instead.

**Local SQL architecture:** The standard SQL Server Linux container is AMD64-only. On Apple Silicon, Windows ARM64, and Linux ARM64, default to Azure SQL unless Docker's AMD64 emulation has already been verified. Never install privileged QEMU/binfmt handlers automatically.

**Azure SQL notes:** Use `[order]` (bracket-quoted) since `order` is a SQL reserved word. For managed identity auth, use `azure-active-directory-default` authentication — no passwords. SSL is required by default. In Azure, set `AZURE_SQL_SERVER` to the full FQDN from `fullyQualifiedDomainName` (for example, `sql-name.database.windows.net`) and do not strip the `.database.windows.net` suffix. For local development, connect to Azure SQL using a connection string with SQL auth or your Azure AD identity — set `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, and optionally `AZURE_SQL_USER`/`AZURE_SQL_PASSWORD` in `local.settings.json`.

### Data Models

#### Todo

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | auto | UUID v4, generated on create |
| title | string | yes | 1–500 characters, trimmed |
| status | string | auto | `pending` on create. Valid values: `pending`, `in_progress`, `completed` |
| userId | string | yes | Non-empty string |
| stepsGenerated | boolean | auto | `false` on create, `true` after steps are generated |
| createdAt | string | auto | ISO 8601 timestamp |
| updatedAt | string | auto | ISO 8601 timestamp, updated on every change |

#### ActionStep

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | auto | UUID v4, generated on create |
| todoId | string | yes | Must reference an existing Todo |
| title | string | yes | 1–200 characters |
| description | string | yes | 1–1000 characters, actionable detail |
| order | number | yes | 1-based sequential integer |
| isCompleted | boolean | auto | `false` on create |
| createdAt | string | auto | ISO 8601 timestamp |

### Database Schema (SQL)

```sql
CREATE TABLE Todos (
    id NVARCHAR(36) PRIMARY KEY,
    title NVARCHAR(500) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending',
    userId NVARCHAR(100) NOT NULL,
    stepsGenerated BIT NOT NULL DEFAULT 0,
    createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Todos_UserId ON Todos(userId);

CREATE TABLE ActionSteps (
    id NVARCHAR(36) PRIMARY KEY,
    todoId NVARCHAR(36) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NOT NULL,
    [order] INT NOT NULL,
    isCompleted BIT NOT NULL DEFAULT 0,
    createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ActionSteps_Todos FOREIGN KEY (todoId) REFERENCES Todos(id) ON DELETE CASCADE
);

CREATE INDEX IX_ActionSteps_TodoId ON ActionSteps(todoId);
```

### API Endpoints

#### `GET /api/todos`

Query parameters:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | Filter todos by user |

Response (200): `Todo[]` including nested `steps`. 400 if `userId` is missing.

#### `POST /api/todos`

Request body:

```json
{
  "title": "Prepare conference talk",
  "userId": "user-1"
}
```

Response (201): Created `Todo` with `status: "pending"`, `stepsGenerated: false`, and empty `steps`. 400 if `title` is empty, missing, or exceeds 500 characters. 400 if `userId` is missing.

#### `PATCH /api/todos/:id`

Request body (all fields optional):

```json
{
  "title": "Prepare Conference keynote",
  "status": "in_progress"
}
```

Response (200): Updated todo object (same shape as GET response, including steps).

404 if todo not found. 400 if `status` is not one of `pending`, `in_progress`, `completed`.

#### `DELETE /api/todos/:id`

Response (204): No content.

404 if todo not found. Cascade-deletes associated action steps.

#### `POST /api/todos/:id/generate-steps`

No request body. Calls the AI service to generate action steps from the todo's title.

**Behavior:**
1. Fetch the todo by ID — 404 if not found
2. If `stepsGenerated` is already `true`, delete existing steps first (regenerate)
3. Call gpt-5-mini with the todo title using the system prompt from the AI Task Decomposition section below
4. Parse the AI response as a JSON array
5. Validate each item has `title` (string, non-empty) and `description` (string, non-empty)
6. Assign sequential `order` values starting at 1
7. Generate UUID for each step's `id`
8. Insert all steps into the database
9. Set `stepsGenerated = true` on the todo
10. Return the todo with all generated steps

Response (200): Updated `Todo` with 3-7 AI-generated `steps`. Each step has `title`, `description`, `order`, and `isCompleted`. 404 if todo not found. 503 if AI service is unavailable or returns unparseable output after retry.

#### `PATCH /api/todos/:id/steps/:stepId`

Request body:

```json
{
  "isCompleted": true
}
```

Response (200): Updated `ActionStep`. 404 if todo or step not found. 400 if `isCompleted` is not a boolean.

**Auto-completion rule:** After updating a step, check all steps for the parent todo. If ALL steps are `isCompleted: true`, set the todo's status to `completed`. If a step is unchecked (`isCompleted: false`) and the todo's status is `completed`, set it back to `in_progress`.

### Error Response Format

All errors return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be between 1 and 500 characters."
  }
}
```

Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `AI_SERVICE_ERROR`, `INTERNAL_ERROR`.

Status code mapping:
- `VALIDATION_ERROR` → 400
- `NOT_FOUND` → 404
- `AI_SERVICE_ERROR` → 503
- `INTERNAL_ERROR` → 500

### Seed Data

The seed script (`src/api/src/data/seed.ts`) must run before first use so the API returns data immediately. Add an npm script to make this easy: `"seed": "tsx src/data/seed.ts"`. The seed should be idempotent — skip if the database already contains rows. The README test commands (for example, `curl ".../api/todos?userId=user-1"`) assume seed data is present.

**Todos** (all userId: "user-1"):

| id | title | status | stepsGenerated |
|----|-------|--------|----------------|
| todo-1 | Prepare conference talk | pending | false |
| todo-2 | Set up home office | in_progress | true |
| todo-3 | Plan weekend hiking trip | completed | true |

Seed action steps for `todo-2` and `todo-3` so the app can show generated/completed states immediately:

| id | todoId | title | order | isCompleted |
|----|--------|-------|-------|-------------|
| step-2-1 | todo-2 | Choose a desk and chair | 1 | true |
| step-2-2 | todo-2 | Set up monitor and peripherals | 2 | true |
| step-2-3 | todo-2 | Organize cable management | 3 | false |
| step-2-4 | todo-2 | Set up lighting | 4 | false |
| step-3-1 | todo-3 | Pick a trail | 1 | true |
| step-3-2 | todo-3 | Check weather forecast | 2 | true |
| step-3-3 | todo-3 | Pack gear and supplies | 3 | true |

Use short actionable descriptions for each seed step.

### AI Task Decomposition

**Endpoint:** `POST /api/todos/:id/generate-steps`

**AI SDK:** Use the plain OpenAI-compatible SDK for the chosen language (`openai`, `OpenAI`, or `com.openai:openai-java`) with a normalized `/openai/v1/` base URL.

**Client setup:** Normalize `AZURE_AI_ENDPOINT` so it ends with `/openai/v1/`, pass `AZURE_AI_KEY` as the API key, and pass `AZURE_AI_DEPLOYMENT` as the model/deployment name when calling chat completions.

Do **not** use a dated `api-version` and do **not** use an Azure-specific client that requires one. The dated GA version (`2024-10-21`) rejects newer parameters such as `reasoning_effort`, and the versionless `/openai/v1` API has been GA since August 2025. There is deliberately no `AZURE_AI_API_VERSION` variable — do not add one to the app or to the Function App settings.

**System prompt:**

```
You are a productivity assistant that breaks down goals into actionable steps.

Given a todo item, generate 3-7 concrete, actionable steps to accomplish it.
Each step should be specific enough that someone could start working on it immediately.

Rules:
- Each step title must be under 200 characters
- Each step description must be 1-3 sentences with specific, actionable detail
- Include quantities, time estimates, or specific tools where relevant
- Steps must be in logical order (what to do first, second, etc.)
- Be practical and realistic, not generic or motivational

Respond with ONLY a valid JSON array. No markdown, no code fences, no explanation:
[
  {
    "title": "Short action title",
    "description": "Specific actionable description with details."
  }
]
```

**User prompt:** The todo's `title` field, verbatim.

**Model config:**
- Model: `gpt-5-mini` (fallback: `gpt-4.1` — check regional availability with `az cognitiveservices model list --location <region>`)
- Temperature: leave at the model default — gpt-5 family models reject custom temperature values. Set `0.7` only if using the gpt-4.1 fallback.
- Max tokens: `1500`

**Response parsing:**
1. Get the raw text response from the model
2. Strip markdown code fences if present (` ```json\n...\n``` ` → `[...]`)
3. Parse as JSON array
4. Validate: array of objects, each with non-empty `title` (string) and `description` (string)
5. If validation fails, retry once with a stricter follow-up: "Your previous response was not valid JSON. Return ONLY a JSON array."
6. If retry fails, throw `AI_SERVICE_ERROR`
7. Assign sequential `order` values (1, 2, 3...)
8. Generate UUID v4 for each step's `id`

**Environment Variables:**

| Variable | Local Dev | Production |
|----------|-----------|------------|
| AZURE_AI_ENDPOINT | From Azure Portal (with or without `/openai/v1/`) | Set by Bicep output |
| AZURE_AI_DEPLOYMENT | `gpt-5-mini` | Set by Bicep output |
| AZURE_AI_KEY | API key from portal | Set by Bicep output |

Local dev and production both use API key auth via the plain `openai` package. Normalize the endpoint to include `/openai/v1/` before creating the client; Bicep may output the raw resource endpoint without that suffix. No api-version setting is required or wanted.

---

## Phase 1 Acceptance Criteria

- Repository interfaces and an Azure SQL factory isolate all database access from HTTP handlers.
- Seed data returns the three deterministic todos for `user-1`, including action steps for `todo-2` and `todo-3`.
- Todo create, update, delete, cascade delete, and error envelopes match the API contracts.
- `POST /api/todos/:id/generate-steps` returns 3-7 ordered steps when AI credentials are configured, or 503 with `AI_SERVICE_ERROR` after a failed retry.
- Completing all action steps marks the parent todo `completed`; unchecking a step moves a completed todo back to `in_progress`.
