import SwiftUI

struct TodoListView: View {
    @ObservedObject var store: TodoStore
    @State private var showsAddTodo = false

    var body: some View {
        NavigationStack {
            Group {
                if store.todos.isEmpty {
                    ContentUnavailableView(
                        "No todos yet. Tap + to add one.",
                        systemImage: "checklist"
                    )
                } else {
                    List {
                        ForEach(store.todos) { todo in
                            NavigationLink {
                                TodoDetailView(todo: todo, store: store)
                            } label: {
                                TodoRowView(todo: todo)
                                    .accessibilityElement(children: .contain)
                                    .accessibilityIdentifier(AccessibilityIdentifiers.todoRow(todo.id))
                            }
                            .swipeActions {
                                Button("Delete", role: .destructive) {
                                    store.requestListDelete(id: todo.id)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .refreshable {
                        await store.refresh()
                    }
                }
            }
            .navigationTitle("SmartTodo")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsAddTodo = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Add Todo")
                    .accessibilityIdentifier(AccessibilityIdentifiers.addTodoButton)
                }
            }
            .sheet(isPresented: $showsAddTodo) {
                AddTodoView(store: store)
            }
            .confirmationDialog(
                "Delete this todo?",
                isPresented: Binding(
                    get: { store.pendingDeleteID != nil },
                    set: { if !$0 { store.cancelListDelete() } }
                ),
                titleVisibility: .visible
            ) {
                Button("Delete Todo", role: .destructive) {
                    guard let id = store.pendingDeleteID else { return }
                    Task { await store.confirmListDelete(id: id) }
                }
                Button("Cancel", role: .cancel) {
                    store.cancelListDelete()
                }
            }
            .alert(
                "Something went wrong",
                isPresented: Binding(
                    get: { store.alertMessage != nil },
                    set: { if !$0 { store.alertMessage = nil } }
                )
            ) {
                Button("OK") { store.alertMessage = nil }
            } message: {
                Text(store.alertMessage ?? "")
            }
        }
        .task {
            if store.todos.isEmpty {
                await store.load()
            }
        }
    }
}

private struct TodoRowView: View {
    let todo: Todo

    private var progressText: String {
        guard todo.stepsGenerated else { return "No steps yet" }
        return "\(todo.steps.filter(\.isCompleted).count)/\(todo.steps.count) steps"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(todo.title)
                .font(.headline)
                .foregroundStyle(.primary)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    statusBadge
                    progress
                }
                VStack(alignment: .leading, spacing: 6) {
                    statusBadge
                    progress
                }
            }
        }
        .padding(.vertical, 6)
    }

    private var statusBadge: some View {
        Text(todo.status.rawValue)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(statusColor, in: Capsule())
            .accessibilityIdentifier(AccessibilityIdentifiers.statusBadge(todo.id))
    }

    private var progress: some View {
        Text(progressText)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }

    private var statusColor: Color {
        switch todo.status {
        case .pending: .gray
        case .inProgress: .blue
        case .completed: .green
        }
    }
}

struct AddTodoView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: AddTodoViewModel
    @ObservedObject private var store: TodoStore
    @FocusState private var titleIsFocused: Bool

    init(store: TodoStore) {
        _store = ObservedObject(wrappedValue: store)
        _viewModel = StateObject(wrappedValue: AddTodoViewModel(store: store))
    }

    var body: some View {
        NavigationStack {
            VStack {
                TextField("What do you want to accomplish?", text: $viewModel.title)
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.done)
                    .focused($titleIsFocused)
                    .accessibilityIdentifier(AccessibilityIdentifiers.newTodoTitleField)
                    .padding()
                    .onSubmit { save() }
                Spacer()
            }
            .navigationTitle("New Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(!viewModel.canAdd)
                        .accessibilityIdentifier(AccessibilityIdentifiers.saveTodoButton)
                }
            }
            .onAppear { titleIsFocused = true }
        }
    }

    private func save() {
        let count = store.todos.count
        Task {
            await viewModel.add()
            if store.todos.count > count {
                dismiss()
            }
        }
    }
}
