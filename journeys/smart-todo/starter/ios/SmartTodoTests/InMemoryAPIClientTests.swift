import XCTest
@testable import SmartTodo

final class InMemoryAPIClientTests: XCTestCase {
    func testInMemoryClientLoadsSeedTodos() async throws {
        let todos = try await InMemoryAPIClient().getTodos()

        XCTAssertEqual(todos.map(\.id), ["todo-1", "todo-2", "todo-3"])
        XCTAssertEqual(todos.map(\.status), [.pending, .inProgress, .completed])
    }

    func testInMemoryGeneratorMatchesFakeGeneratorTitles() async throws {
        let client = InMemoryAPIClient()
        let generated = try await client.generateSteps(todoId: "todo-1")

        XCTAssertEqual(
            generated.steps.map(\.title),
            [
                "Clarify the goal",
                "Gather what you need",
                "Do the first focused session",
                "Review and wrap up",
            ]
        )
    }

    func testInMemoryRegenerationMatchesAPIStatusRules() async throws {
        let statuses: [TodoStatus] = [.pending, .inProgress, .completed]

        for status in statuses {
            let todo = makeTodo(
                id: "todo-\(status.rawValue)",
                status: status,
                stepsGenerated: true,
                steps: [makeStep(isCompleted: true)]
            )
            let regenerated = try await InMemoryAPIClient(todos: [todo])
                .generateSteps(todoId: todo.id)
            let expected: TodoStatus = status == .completed ? .inProgress : status

            XCTAssertEqual(regenerated.status, expected)
            XCTAssertEqual(regenerated.steps.count, 4)
            XCTAssertTrue(regenerated.steps.allSatisfy { !$0.isCompleted })
        }
    }

    func testInMemoryPartialCompletionMovesPendingTodoToInProgress() async throws {
        let todo = makeTodo(
            status: .pending,
            stepsGenerated: true,
            steps: [
                makeStep(id: "step-1", order: 1),
                makeStep(id: "step-2", order: 2),
            ]
        )
        let client = InMemoryAPIClient(todos: [todo])

        _ = try await client.updateStep(
            todoId: todo.id,
            stepId: "step-1",
            isCompleted: true
        )

        let reloaded = try await client.getTodos()
        XCTAssertEqual(reloaded.first?.status, .inProgress)
    }

    func testInMemoryLastStepCompletionCompletesTodo() async throws {
        let todo = makeTodo(
            status: .inProgress,
            stepsGenerated: true,
            steps: [
                makeStep(id: "step-1", order: 1, isCompleted: true),
                makeStep(id: "step-2", order: 2),
            ]
        )
        let client = InMemoryAPIClient(todos: [todo])

        _ = try await client.updateStep(
            todoId: todo.id,
            stepId: "step-2",
            isCompleted: true
        )

        let reloaded = try await client.getTodos()
        XCTAssertEqual(reloaded.first?.status, .completed)
    }

    func testInMemoryUncheckingStepReopensCompletedTodo() async throws {
        let todo = makeTodo(
            status: .completed,
            stepsGenerated: true,
            steps: [makeStep(isCompleted: true)]
        )
        let client = InMemoryAPIClient(todos: [todo])

        _ = try await client.updateStep(
            todoId: todo.id,
            stepId: "step-1",
            isCompleted: false
        )

        let reloaded = try await client.getTodos()
        XCTAssertEqual(reloaded.first?.status, .inProgress)
    }
}
