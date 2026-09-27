import Combine
import Foundation

enum AccessibilityIdentifiers {
    static let addTodoButton = "addTodoButton"
    static func todoRow(_ id: String) -> String { "todoRow-\(id)" }
    static func statusBadge(_ id: String) -> String { "statusBadge-\(id)" }
    static let newTodoTitleField = "newTodoTitleField"
    static let saveTodoButton = "saveTodoButton"
    static let generateStepsButton = "generateStepsButton"
    static let statusPicker = "statusPicker"
    static func stepToggle(_ order: Int) -> String { "stepToggle-\(order)" }
    static let stepsProgressLabel = "stepsProgressLabel"
    static let deleteTodoButton = "deleteTodoButton"
}

@MainActor
final class TodoStore: ObservableObject {
    @Published var todos: [Todo]
    @Published var alertMessage: String?
    @Published var pendingStepIDs: Set<String> = []
    @Published var pendingDeleteID: String?

    let client: APIClientProtocol

    init(client: APIClientProtocol, todos: [Todo] = []) {
        self.client = client
        self.todos = todos
    }

    func load() async {
        do {
            todos = try await client.getTodos()
        } catch {
            present(error)
        }
    }

    func refresh() async {
        await load()
    }

    func add(title: String) async {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        do {
            todos.append(try await client.createTodo(title: title))
        } catch {
            present(error)
        }
    }

    func update(id: String, title: String?, status: String?) async {
        do {
            let updated = try await client.updateTodo(id: id, title: title, status: status)
            replace(updated)
        } catch {
            present(error)
        }
    }

    func generate(todoId: String) async {
        do {
            replace(try await client.generateSteps(todoId: todoId))
        } catch {
            present(error)
        }
    }

    func toggle(todoId: String, stepId: String, isCompleted: Bool) async {
        pendingStepIDs.insert(stepId)
        defer { pendingStepIDs.remove(stepId) }
        do {
            _ = try await client.updateStep(
                todoId: todoId,
                stepId: stepId,
                isCompleted: isCompleted
            )
            todos = try await client.getTodos()
        } catch {
            present(error)
        }
    }

    func delete(id: String) async {
        do {
            try await client.deleteTodo(id: id)
            todos.removeAll { $0.id == id }
            pendingDeleteID = nil
        } catch {
            present(error)
        }
    }

    func requestListDelete(id: String) {
        pendingDeleteID = id
    }

    func confirmListDelete(id: String) async {
        await delete(id: id)
    }

    func cancelListDelete() {
        pendingDeleteID = nil
    }

    func replace(_ todo: Todo) {
        if let index = todos.firstIndex(where: { $0.id == todo.id }) {
            todos[index] = todo
        } else {
            todos.append(todo)
        }
    }

    func present(_ error: Error) {
        alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
}

@MainActor
final class AddTodoViewModel: ObservableObject {
    @Published var title = ""

    var canAdd: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private let store: TodoStore

    init(store: TodoStore) {
        self.store = store
    }

    func add() async {
        guard canAdd else { return }
        await store.add(title: title.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

enum StatusBadgeLayout {
    static let keepsTextOnOneLine = true
    static let stacksAtAccessibilitySizes = true
}

enum AppDependencies {
    static func usesInMemoryClient(arguments: [String]) -> Bool {
        arguments.contains("-ui-testing")
    }
}
