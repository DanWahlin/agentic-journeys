import Combine
import Foundation

@MainActor
final class TodoDetailViewModel: ObservableObject {
    @Published var todo: Todo
    @Published var isGenerating = false
    @Published var shouldDismiss = false

    private let store: TodoStore
    private var confirmedTodo: Todo

    init(todo: Todo, store: TodoStore) {
        self.todo = todo
        self.confirmedTodo = todo
        self.store = store
    }

    var progressLabel: String {
        "\(todo.steps.filter(\.isCompleted).count) of \(todo.steps.count) complete"
    }

    func submitTitle() async {
        let title = todo.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            todo.title = confirmedTodo.title
            return
        }
        do {
            apply(try await store.client.updateTodo(id: todo.id, title: title, status: nil))
        } catch {
            todo = confirmedTodo
            store.present(error)
        }
    }

    func selectStatus(_ status: TodoStatus) async {
        do {
            apply(try await store.client.updateTodo(id: todo.id, title: nil, status: status.rawValue))
        } catch {
            todo = confirmedTodo
            store.present(error)
        }
    }

    func generate() async {
        guard !isGenerating else { return }
        isGenerating = true
        defer { isGenerating = false }
        do {
            var generated = try await store.client.generateSteps(todoId: todo.id)
            generated.steps.sort { $0.order < $1.order }
            apply(generated)
        } catch {
            store.present(error)
        }
    }

    func toggle(step: ActionStep) async {
        await store.toggle(
            todoId: todo.id,
            stepId: step.id,
            isCompleted: !step.isCompleted
        )
        if let reloaded = store.todos.first(where: { $0.id == todo.id }) {
            todo = reloaded
            confirmedTodo = reloaded
        }
    }

    func delete() async {
        await store.delete(id: todo.id)
        shouldDismiss = !store.todos.contains { $0.id == todo.id }
    }

    private func apply(_ updated: Todo) {
        todo = updated
        confirmedTodo = updated
        store.replace(updated)
    }
}
