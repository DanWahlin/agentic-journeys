# SmartTodo Phase 2: iOS App

Build the SwiftUI client against the API contract from [`PLAN-phase1-api.md`](./PLAN-phase1-api.md). Read [`PLAN.md`](./PLAN.md) first for the journey vision and shared decisions. The API must be running for the client to work.

README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

## iOS Client

### Platform Requirements

- iOS 17.0+ deployment target
- SwiftUI with async/await
- No third-party dependencies — use `URLSession` for networking, `JSONDecoder`/`JSONEncoder` for serialization

### Config

```swift
// Config.swift
enum Config {
    #if DEBUG
    static let apiBaseURL = "http://localhost:7071"
    #else
    static let apiBaseURL = "https://<your-function-app>.azurewebsites.net"
    #endif

    static let defaultUserId = "user-1"
}
```

The API URL must be configurable — never hardcode it. Use `#if DEBUG` to switch between local dev and production.

**To test against the deployed Azure API:** The simplest approach is to replace the `apiBaseURL` value directly (removing the `#if DEBUG` / `#else` / `#endif` conditional) with your deployed Function App URL. Get the URL with `azd env get-value API_URL`. You can restore the conditional later. Building with the Xcode Release scheme also works but requires additional signing configuration.

### Models

Create Swift `Codable` + `Identifiable` models that match the API `Todo`, `ActionStep`, and `{ error: { code, message } }` shapes exactly.

### API Client

```swift
class APIClient {
    static let shared = APIClient()
    private let baseURL = Config.apiBaseURL
    private let userId = Config.defaultUserId

    func getTodos() async throws -> [Todo]
    func createTodo(title: String) async throws -> Todo
    func updateTodo(id: String, title: String?, status: String?) async throws -> Todo
    func deleteTodo(id: String) async throws
    func generateSteps(todoId: String) async throws -> Todo
    func updateStep(todoId: String, stepId: String, isCompleted: Bool) async throws -> ActionStep
}
```

All methods use `URLSession.shared.data(for:)` with `async throws`. On non-2xx responses, decode the `APIError` format and throw a descriptive `LocalizedError`.

**DELETE response:** `DELETE /api/todos/:id` returns `204 No Content`, so the Swift client must not try to decode JSON for that call.

### Views

#### TodoListView (main screen — `/`)

- Navigation title: "SmartTodo"
- List of todos showing: title, status badge (color-coded: gray=pending, blue=in_progress, green=completed), step progress (e.g., "2/4 steps")
- Swipe to delete with confirmation
- "+" button in navigation bar toolbar to present `AddTodoView` as a sheet
- Tap a todo row to navigate to `TodoDetailView`
- Pull to refresh with `.refreshable`
- Empty state: "No todos yet. Tap + to add one."

#### AddTodoView (presented as sheet)

- Text field for todo title with placeholder "What do you want to accomplish?"
- "Add" button (disabled if title is empty or whitespace-only)
- "Cancel" button to dismiss
- Keyboard auto-focused on appear with `.onAppear { isFocused = true }`

#### TodoDetailView

- Todo title displayed as editable `TextField`
- Status picker: `Picker` with `pending`, `in_progress`, `completed` options
- Conditional button:
  - "✨ Generate Steps" when `stepsGenerated == false` — prominent style. **Do not use `Label` inside a `Form` button** — `Form` strips the icon. Instead use `HStack { Image(systemName: "sparkles"); Text("Generate Steps") }` with `.frame(maxWidth: .infinity)` and `.buttonStyle(.borderedProminent)`.
  - "🔄 Regenerate Steps" when `stepsGenerated == true` — same `HStack` pattern with `Image(systemName: "arrow.clockwise")` and `.tint(.blue)` for visibility
- `ProgressView` overlay during AI generation with "Generating steps..." label
- `ActionStepsView` embedded below (if steps exist)
- "Delete Todo" button at bottom (destructive style, with confirmation alert)
- The entire view should be wrapped in a `ScrollView` (or use `Form`/`List`) so that the generate button, action steps, and delete button are all reachable regardless of how many steps are generated

#### ActionStepsView

- Progress bar at top: `ProgressView(value: completedCount, total: totalCount)` with label "N of M complete"
- Ordered list of steps (sorted by `order` field) — must be scrollable so all steps are visible even when 7 are generated. Do NOT use a fixed-height container that clips at 5 items. Use a `List` or `ForEach` inside the parent `ScrollView`/`Form`.
- Each row shows:
  - Checkbox (toggle `isCompleted` via API call)
  - Step number (1, 2, 3...)
  - Title (strikethrough + gray when completed)
  - Description (expandable with disclosure indicator, or always visible if short)

---

## Phase 2 Acceptance Criteria

- The Xcode project targets iOS 17 or later and references every generated Swift file.
- Swift models match the Phase 1 `Todo`, `ActionStep`, and error contracts exactly.
- `APIClient` centralizes all network calls, uses `Config.apiBaseURL`, and handles `204 No Content` on delete.
- Todo list, add, detail, generate/regenerate steps, progress, and completion flows work against the local API.
- Generate and regenerate buttons use the Form-safe `HStack` icon pattern and show a loading state during AI generation.
