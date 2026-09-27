import XCTest
@testable import SmartTodo

@MainActor
final class TodoStoreTests: XCTestCase {
    func testErrorsPresentAlertWithoutClearingLoadedTodos() async {
        let original = makeTodo()
        let client = MockAPIClient()
        let failure = TestFailure(message: "The server is unavailable")
        client.getTodosHandler = { throw failure }
        client.createTodoHandler = { _ in throw failure }
        client.updateTodoHandler = { _, _, _ in throw failure }
        client.generateStepsHandler = { _ in throw failure }
        client.updateStepHandler = { _, _, _ in throw failure }
        client.deleteTodoHandler = { _ in throw failure }

        let operations: [(TodoStore) async -> Void] = [
            { await $0.load() },
            { await $0.refresh() },
            { await $0.add(title: "New todo") },
            { await $0.update(id: original.id, title: "Changed", status: nil) },
            { await $0.generate(todoId: original.id) },
            { await $0.toggle(todoId: original.id, stepId: "step-1", isCompleted: true) },
            { await $0.delete(id: original.id) },
        ]

        for operation in operations {
            let store = TodoStore(client: client, todos: [original])
            await operation(store)
            XCTAssertEqual(store.todos, [original])
            XCTAssertEqual(store.alertMessage, failure.message)
        }
    }

    func testAddTodoRejectsBlankTitleAndCreatesTrimmedTitle() async {
        let client = MockAPIClient()
        var submittedTitles: [String] = []
        client.createTodoHandler = { title in
            submittedTitles.append(title)
            return makeTodo(title: title)
        }
        let store = TodoStore(client: client)
        let viewModel = AddTodoViewModel(store: store)

        for blank in ["", " ", "\n\t"] {
            viewModel.title = blank
            XCTAssertFalse(viewModel.canAdd)
            await viewModel.add()
        }
        XCTAssertTrue(submittedTitles.isEmpty)

        viewModel.title = "  Plan a weekend camping trip  "
        XCTAssertTrue(viewModel.canAdd)
        await viewModel.add()
        XCTAssertEqual(submittedTitles, ["Plan a weekend camping trip"])
    }

    func testStepToggleWaitsForResponseAndDisablesOnlySelectedStep() async {
        let requestStarted = expectation(description: "step request started")
        let allowResponse = expectation(description: "allow step response")
        let originalStep = makeStep()
        let todo = makeTodo(stepsGenerated: true, steps: [originalStep, makeStep(id: "step-2", order: 2)])
        let client = MockAPIClient()
        client.updateStepHandler = { _, _, _ in
            requestStarted.fulfill()
            await self.fulfillment(of: [allowResponse], timeout: 2)
            return makeStep(isCompleted: true)
        }
        let store = TodoStore(client: client, todos: [todo])

        let task = Task {
            await store.toggle(todoId: todo.id, stepId: originalStep.id, isCompleted: true)
        }
        await fulfillment(of: [requestStarted], timeout: 1)

        XCTAssertEqual(store.todos[0].steps[0].isCompleted, false)
        XCTAssertEqual(store.pendingStepIDs, [originalStep.id])
        XCTAssertFalse(store.pendingStepIDs.contains("step-2"))

        allowResponse.fulfill()
        await task.value
    }

    func testFailedStepTogglePreservesStateAndShowsError() async {
        let todo = makeTodo(stepsGenerated: true, steps: [makeStep()])
        let client = MockAPIClient()
        client.updateStepHandler = { _, _, _ in throw TestFailure(message: "Toggle failed") }
        let store = TodoStore(client: client, todos: [todo])

        await store.toggle(todoId: todo.id, stepId: "step-1", isCompleted: true)

        XCTAssertFalse(store.todos[0].steps[0].isCompleted)
        XCTAssertEqual(store.alertMessage, "Toggle failed")
    }

    func testSuccessfulStepToggleReloadsParentTodoStatus() async {
        let todo = makeTodo(status: .inProgress, stepsGenerated: true, steps: [makeStep()])
        let completed = makeTodo(status: .completed, stepsGenerated: true, steps: [makeStep(isCompleted: true)])
        let client = MockAPIClient()
        var reloadCount = 0
        client.updateStepHandler = { _, _, _ in makeStep(isCompleted: true) }
        client.getTodosHandler = {
            reloadCount += 1
            return [completed]
        }
        let store = TodoStore(client: client, todos: [todo])

        await store.toggle(todoId: todo.id, stepId: "step-1", isCompleted: true)

        XCTAssertEqual(reloadCount, 1)
        XCTAssertEqual(store.todos.first?.status, .completed)
    }

    func testRefreshReloadsTodos() async {
        let replacement = makeTodo(id: "todo-new", title: "Replacement")
        let client = MockAPIClient()
        client.getTodosHandler = { [replacement] }
        let store = TodoStore(client: client, todos: [makeTodo()])

        await store.refresh()

        XCTAssertEqual(store.todos, [replacement])
    }

    func testConfirmedListDeleteRemovesTodoAfterAPISucceeds() async {
        let requestStarted = expectation(description: "delete request started")
        let allowResponse = expectation(description: "allow delete response")
        let todo = makeTodo()
        let client = MockAPIClient()
        client.deleteTodoHandler = { _ in
            requestStarted.fulfill()
            await self.fulfillment(of: [allowResponse], timeout: 2)
        }
        let store = TodoStore(client: client, todos: [todo])

        let task = Task { await store.confirmListDelete(id: todo.id) }
        await fulfillment(of: [requestStarted], timeout: 1)
        XCTAssertEqual(store.todos, [todo])

        allowResponse.fulfill()
        await task.value
        XCTAssertTrue(store.todos.isEmpty)
    }

    func testCancelledListDeleteKeepsTodo() {
        let todo = makeTodo()
        let store = TodoStore(client: MockAPIClient(), todos: [todo])

        store.requestListDelete(id: todo.id)
        XCTAssertEqual(store.pendingDeleteID, todo.id)
        store.cancelListDelete()

        XCTAssertNil(store.pendingDeleteID)
        XCTAssertEqual(store.todos, [todo])
    }
}
