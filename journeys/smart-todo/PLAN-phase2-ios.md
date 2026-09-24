# SmartTodo Phase 2: iOS App

Build the SwiftUI client from the mockups against the API contract in [`PLAN-phase1-api.md`](./PLAN-phase1-api.md), with unit tests and a UI test that run on a simulator without the API. Read [`PLAN.md`](./PLAN.md) first for the journey vision, shared decisions, and quality gates.

README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

## Mockups

The wireframes in [`images/mockups/`](./images/mockups/) are the visual contract for layout and behavior:

| File | Screen |
| --- | --- |
| [`smart-todo-mockups.png`](./images/mockups/smart-todo-mockups.png) | All four screens side by side |
| [`todo-list.png`](./images/mockups/todo-list.png) | `TodoListView` with status badges, step progress, and swipe to delete |
| [`add-todo.png`](./images/mockups/add-todo.png) | `AddTodoView` sheet with the keyboard focused |
| [`todo-detail-empty.png`](./images/mockups/todo-detail-empty.png) | `TodoDetailView` before steps are generated |
| [`todo-detail-steps.png`](./images/mockups/todo-detail-steps.png) | `TodoDetailView` with `ActionStepsView` and progress |

Pink notes on the mockups are behavior annotations. When a mockup and this document disagree, this document wins.

## iOS Client

### Platform Requirements

- iOS 17.0+ deployment target
- SwiftUI with async/await
- No third-party dependencies. Use `URLSession` for networking and `JSONDecoder`/`JSONEncoder` for serialization.

### Project Layout

Paths are relative to `journeys/smart-todo`.

```text
src/ios/
├── SmartTodo.xcodeproj/
│   └── xcshareddata/xcschemes/SmartTodo.xcscheme   # shared scheme, committed
├── SmartTodo/            # app target: SmartTodoApp.swift, Config.swift, Models/, Services/, Views/
├── SmartTodoTests/       # unit test target (XCTest)
└── SmartTodoUITests/     # UI test target (XCUITest)
```

**Start from the starter project.** Copy `starter/ios` to `src/ios` at the start of the red phase. It already has the three targets, a committed shared scheme that tests both test targets, iOS 17 as the deployment target, and the Debug settings `#if DEBUG` and `@testable import` need (`SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG`, `ENABLE_TESTABILITY = YES`). Delete `StarterView.swift`, `StarterTests.swift`, and `StarterUITests.swift` once your own files replace them.

The project uses Xcode's synchronized folders, so every file inside `SmartTodo/`, `SmartTodoTests/`, or `SmartTodoUITests/` (including subfolders) belongs to that target automatically. **Don't edit `project.pbxproj`** to add files, and don't convert the project to an older format. Hand-written project files were the slowest and most error-prone step in earlier runs. Name every XCTest method with a `test` prefix; XCTest silently skips methods without it.

### Config

App Transport Security already allows plain HTTP to `localhost`, so the Debug build reaches `http://localhost:7071` without an ATS exception. Don't add one, even if a reviewer suggests it.

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

The API URL must be configurable, never hardcoded in a view or service. Use `#if DEBUG` to switch between local dev and production.

**To test against the deployed Azure API:** The simplest approach is to replace the `apiBaseURL` value directly (removing the `#if DEBUG` / `#else` / `#endif` conditional) with your deployed Function App URL. Get the URL with `azd env get-value API_URL`. You can restore the conditional later.

### Models

Create Swift `Codable` + `Identifiable` models that match the API `Todo`, `ActionStep`, and `{ error: { code, message } }` shapes exactly.

### API Client

```swift
protocol APIClientProtocol {
    func getTodos() async throws -> [Todo]
    func createTodo(title: String) async throws -> Todo
    func updateTodo(id: String, title: String?, status: String?) async throws -> Todo
    func deleteTodo(id: String) async throws
    func generateSteps(todoId: String) async throws -> Todo
    func updateStep(todoId: String, stepId: String, isCompleted: Bool) async throws -> ActionStep
}
```

- `APIClient` implements the protocol with `URLSession` and `Config.apiBaseURL`. Inject the `URLSession` so tests can use a `URLProtocol` stub.
- All methods use `data(for:)` with `async throws`. On non-2xx responses, decode the `APIError` format and throw a descriptive `LocalizedError`.
- `DELETE /api/todos/:id` returns `204 No Content`, so the client must not try to decode JSON for that call.
- `InMemoryAPIClient` must behave exactly like the Phase 1 API: the same seed data, the fake generator's four step titles in order, and the same status rules for step toggles and regeneration (including Decision Points 2 and 3). Omit `nil` optional fields from request bodies rather than encoding them as JSON `null`, because the API treats a present `null` as a change. `InMemoryAPIClient` implements the same protocol and is used for SwiftUI previews and UI tests.
- Views receive the client through the SwiftUI environment or an initializer, never through a global singleton.

### UI Test Mode

When the app launches with the argument `-ui-testing`, it uses `InMemoryAPIClient` instead of `APIClient`. UI tests are then deterministic and need no running API.

### Views

#### TodoListView (main screen)

- Status badges never wrap mid-word: use `lineLimit(1)` and `fixedSize()`, and use `ViewThatFits` to stack the badge above the step count at accessibility text sizes.

- Navigation title: "SmartTodo"
- List of todos showing: title, status badge (color-coded: gray=pending, blue=in_progress, green=completed), step progress (for example, "2/4 steps")
- Swipe to delete with confirmation
- "+" button in the navigation bar toolbar to present `AddTodoView` as a sheet
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
  - "✨ Generate Steps" when `stepsGenerated == false`, prominent style. **Do not use `Label` inside a `Form` button**, because `Form` strips the icon. Instead use `HStack { Image(systemName: "sparkles"); Text("Generate Steps") }` with `.frame(maxWidth: .infinity)` and `.buttonStyle(.borderedProminent)`.
  - "🔄 Regenerate Steps" when `stepsGenerated == true`, same `HStack` pattern with `Image(systemName: "arrow.clockwise")` and `.tint(.blue)` for visibility
- `ProgressView` overlay during AI generation with "Generating steps..." label, and the button disabled while the request is in flight
- `ActionStepsView` embedded below (if steps exist)
- "Delete Todo" button at bottom (destructive style, with confirmation alert)
- Wrap the view in a `ScrollView`, or use `Form`/`List`, so the generate button, action steps, and delete button are reachable however many steps are generated

#### ActionStepsView

- Progress bar at top: `ProgressView(value: completedCount, total: totalCount)` with label "N of M complete"
- Ordered list of steps sorted by `order`. It must scroll so all 7 steps are visible. Do NOT use a fixed-height container that clips at 5 items.
- Each row shows:
  - Checkbox (toggle `isCompleted` via API call)
  - Step number (1, 2, 3...)
  - Title (strikethrough + gray when completed)
  - Description

### Accessibility Identifiers

UI tests find elements by these identifiers, so they are part of the contract:

| Element | Identifier |
| --- | --- |
| Add button in the toolbar | `addTodoButton` |
| Todo row | `todoRow-<todo id>` |
| Status badge in a row | `statusBadge-<todo id>` |
| Title field in `AddTodoView` | `newTodoTitleField` |
| Add button in `AddTodoView` | `saveTodoButton` |
| Generate or Regenerate button | `generateStepsButton` |
| Status picker | `statusPicker` |
| Step checkbox | `stepToggle-<order>` |
| Progress label | `stepsProgressLabel` |
| Delete Todo button | `deleteTodoButton` |

### Decision Points

The `grill-plan` skill asks about each item. Use the default when the learner has no preference.

| # | Question | Why it matters | Default |
| --- | --- | --- | --- |
| 1 | How are API errors shown? | Errors must be visible, but not block the list. | An alert with the error message and an OK button. |
| 2 | When a step checkbox is tapped, does the UI update before or after the API responds? | Optimistic updates feel faster but must roll back on failure. | Wait for the API response, then update. Disable that checkbox while the request is in flight. |
| 3 | After a step toggle, how does the app learn the todo's new status? | The API changes the parent status on the server. | Reload the todo list after each toggle. |

---

## Test Strategy

**Unit tests (`SmartTodoTests`)** use a `URLProtocol` stub and fixture JSON copied from the Phase 1 contracts. They cover at least: decoding a `Todo` with nested steps; decoding the error envelope into a `LocalizedError` message; the method, path, and body of every `APIClient` call; `deleteTodo` succeeding on `204` with an empty body; and `InMemoryAPIClient` auto-completing a todo when its last step is checked. Add **parity tests** that run the Phase 1 status scenarios against `InMemoryAPIClient`: generated step titles match the fake generator in order, regenerating a completed todo sets `in_progress` and leaves other statuses alone, checking the first of two steps on a pending todo sets `in_progress`, checking the last step sets `completed`, and unchecking a step on a completed todo sets `in_progress`. A prose rule alone didn't stop the in-memory client drifting in validation runs; these tests do.

Test gestures such as pull-to-refresh and swipe-to-delete through the view model's action (for example, `refresh()` or `delete(at:)`), not with XCUITest swipes, which are timing-dependent and flaky on simulators.

**UI test (`SmartTodoUITests`)** launches the app with `-ui-testing` and walks the main flow:

1. The list shows the three seed todos.
2. Add "Plan a weekend camping trip" and see it in the list with a `pending` badge.
3. Open it, tap `generateStepsButton`, and see four steps and "0 of 4 complete".
4. Check every step and see "4 of 4 complete".
5. Go back and see a `completed` badge on the new todo.

**Red phase:** Add only the protocol, stub types, and accessibility identifiers the tests need to compile. Commit the tests and tag the commit `phase2-red`. When review findings add tests later, commit them as a new red commit and move the tag with `git tag -f phase2-red`.

## Quality Gate

Generate `scripts/test-ios.mjs`, a Node.js script with no dependencies. Resolve paths relative to the project directory (the parent of `scripts/`), not the current working directory, so CI can run it from the repository root:

1. On anything other than macOS, print `SKIP: iOS tests require macOS and Xcode` and exit `0`.
2. On macOS, fail with an install hint if `xcodebuild` or `xcrun` is missing.
3. Read `xcrun simctl list devices available --json`, pick an available iPhone on the newest iOS runtime, and print its name and runtime.
4. Run `xcodebuild test -project src/ios/SmartTodo.xcodeproj -scheme SmartTodo -destination id=<udid>` with argument arrays, not a shell string.
5. Exit with `xcodebuild`'s exit code and print the test summary line.
6. When `xcodebuild` fails, also print every compiler `error:` line (file, line, and message) and every failed test name. Without them, the CI log shows only "build failed", and neither the reviewer nor the cloud agent can see why.

The Phase 2 gate passes when `node scripts/test-ios.mjs` exits `0` on a Mac and `git diff --exit-code phase2-red -- scripts/test-ios.mjs src/ios/SmartTodoTests src/ios/SmartTodoUITests` exits `0`. The `ios` CI job runs the script on a macOS runner.

## Exploratory QA with Computer Use (Optional)

The UI test proves the scripted flow. Exploratory testing finds what the script didn't think of. With Computer Use enabled (`/computer`), an agent can open the Simulator app, take screenshots, and tap through the app like a person. Useful targets are long titles, seven generated steps, rapid repeated taps, rotation, Dark Mode, and Dynamic Type.

Computer Use is not a gate. Its results vary between runs, and it needs Screen Recording and Accessibility permissions on the Mac. Turn anything real it finds into a new XCUITest so the finding becomes deterministic.

---

## Phase 2 Acceptance Criteria

- `src/ios` started from `starter/ios`, its `project.pbxproj` is unchanged, and the committed shared scheme still tests both test targets.
- Swift models match the Phase 1 `Todo`, `ActionStep`, and error contracts exactly.
- `APIClient` centralizes all network calls, uses `Config.apiBaseURL`, and handles `204 No Content` on delete.
- Views match the mockups and use the accessibility identifiers in this plan.
- Todo list, add, detail, generate/regenerate steps, progress, and completion flows work against the local API.
- Generate and regenerate buttons use the Form-safe `HStack` icon pattern and show a loading state during AI generation.
- The Decision Points answers are recorded on the issue and covered by tests.
- The [Quality Gate](#quality-gate) passes on a Mac, and the `ios` check is green on the pull request.
