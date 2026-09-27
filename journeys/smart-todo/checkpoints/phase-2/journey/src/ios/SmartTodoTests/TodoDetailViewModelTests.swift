import XCTest
@testable import SmartTodo

@MainActor
final class TodoDetailViewModelTests: XCTestCase {
    func testSubmittingTitlePersistsValidNonblankEdit() async {
        let client = MockAPIClient()
        var submittedTitles: [String?] = []
        client.updateTodoHandler = { id, title, _ in
            submittedTitles.append(title)
            return makeTodo(id: id, title: title ?? "Original")
        }
        let store = TodoStore(client: client)
        let viewModel = TodoDetailViewModel(todo: makeTodo(title: "Original"), store: store)

        viewModel.todo.title = "   "
        await viewModel.submitTitle()
        XCTAssertTrue(submittedTitles.isEmpty)
        XCTAssertEqual(viewModel.todo.title, "Original")

        viewModel.todo.title = "  Updated title  "
        await viewModel.submitTitle()
        XCTAssertEqual(submittedTitles, ["Updated title"])
    }

    func testStatusSelectionPersistsImmediately() async {
        let client = MockAPIClient()
        var submittedStatus: String?
        client.updateTodoHandler = { id, _, status in
            submittedStatus = status
            return makeTodo(id: id, status: .completed)
        }
        let viewModel = TodoDetailViewModel(
            todo: makeTodo(status: .pending),
            store: TodoStore(client: client)
        )

        await viewModel.selectStatus(.completed)

        XCTAssertEqual(submittedStatus, "completed")
        XCTAssertEqual(viewModel.todo.status, .completed)
    }

    func testFailedDetailEditRestoresConfirmedValueAndShowsError() async {
        let original = makeTodo(title: "Original", status: .pending)
        let client = MockAPIClient()
        client.updateTodoHandler = { _, _, _ in throw TestFailure(message: "Update failed") }
        let store = TodoStore(client: client)
        let viewModel = TodoDetailViewModel(todo: original, store: store)

        viewModel.todo.title = "Unsaved title"
        await viewModel.submitTitle()
        XCTAssertEqual(viewModel.todo.title, "Original")
        XCTAssertEqual(store.alertMessage, "Update failed")

        viewModel.todo.status = .completed
        await viewModel.selectStatus(.completed)
        XCTAssertEqual(viewModel.todo.status, .pending)
        XCTAssertEqual(store.alertMessage, "Update failed")
    }

    func testGenerationShowsProgressAndDisablesAction() async {
        let requestStarted = expectation(description: "generation request started")
        let allowResponse = expectation(description: "allow generation response")
        let todo = makeTodo()
        let client = MockAPIClient()
        client.generateStepsHandler = { _ in
            requestStarted.fulfill()
            await self.fulfillment(of: [allowResponse], timeout: 2)
            return makeTodo(stepsGenerated: true, steps: [makeStep()])
        }
        let viewModel = TodoDetailViewModel(
            todo: todo,
            store: TodoStore(client: client, todos: [todo])
        )

        let task = Task { await viewModel.generate() }
        await fulfillment(of: [requestStarted], timeout: 1)

        XCTAssertTrue(viewModel.isGenerating)

        allowResponse.fulfill()
        await task.value
        XCTAssertFalse(viewModel.isGenerating)
    }

    func testFailedGenerationClearsProgressAndShowsError() async {
        let todo = makeTodo()
        let client = MockAPIClient()
        client.generateStepsHandler = { _ in throw TestFailure(message: "Generation failed") }
        let store = TodoStore(client: client, todos: [todo])
        let viewModel = TodoDetailViewModel(todo: todo, store: store)

        await viewModel.generate()

        XCTAssertFalse(viewModel.isGenerating)
        XCTAssertTrue(viewModel.todo.steps.isEmpty)
        XCTAssertEqual(store.alertMessage, "Generation failed")
    }

    func testGenerationDisplaysOrderedStepsAndProgress() async {
        let todo = makeTodo()
        let generated = makeTodo(
            stepsGenerated: true,
            steps: [
                makeStep(id: "step-3", order: 3),
                makeStep(id: "step-1", order: 1, isCompleted: true),
                makeStep(id: "step-2", order: 2),
                makeStep(id: "step-4", order: 4),
            ]
        )
        let client = MockAPIClient()
        client.generateStepsHandler = { _ in generated }
        let viewModel = TodoDetailViewModel(
            todo: todo,
            store: TodoStore(client: client, todos: [todo])
        )

        await viewModel.generate()

        XCTAssertEqual(viewModel.todo.steps.map(\.order), [1, 2, 3, 4])
        XCTAssertEqual(viewModel.progressLabel, "1 of 4 complete")
    }

    func testToggleShowsReloadedParentStatus() async {
        let step = makeStep(id: "step-1", order: 1)
        let todo = makeTodo(stepsGenerated: true, steps: [step])
        let completedTodo = makeTodo(
            status: .completed,
            stepsGenerated: true,
            steps: [makeStep(id: "step-1", order: 1, isCompleted: true)]
        )
        let client = MockAPIClient()
        client.getTodosHandler = { [completedTodo] }
        let viewModel = TodoDetailViewModel(
            todo: todo,
            store: TodoStore(client: client, todos: [todo])
        )

        await viewModel.toggle(step: step)

        XCTAssertEqual(viewModel.todo.status, .completed)
        XCTAssertEqual(viewModel.progressLabel, "1 of 1 complete")
    }

    func testSuccessfulDetailDeleteReturnsToListAndRemovesTodo() async {
        let todo = makeTodo()
        let client = MockAPIClient()
        let store = TodoStore(client: client, todos: [todo])
        let viewModel = TodoDetailViewModel(todo: todo, store: store)

        await viewModel.delete()

        XCTAssertTrue(store.todos.isEmpty)
        XCTAssertTrue(viewModel.shouldDismiss)
    }

    func testFailedDetailDeleteStaysOnDetailAndShowsError() async {
        let todo = makeTodo()
        let client = MockAPIClient()
        client.deleteTodoHandler = { _ in throw TestFailure(message: "Delete failed") }
        let store = TodoStore(client: client, todos: [todo])
        let viewModel = TodoDetailViewModel(todo: todo, store: store)

        await viewModel.delete()

        XCTAssertFalse(viewModel.shouldDismiss)
        XCTAssertEqual(store.todos, [todo])
        XCTAssertEqual(store.alertMessage, "Delete failed")
    }
}
