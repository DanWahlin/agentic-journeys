import SwiftUI

struct TodoDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: TodoDetailViewModel
    @ObservedObject private var store: TodoStore
    @State private var confirmsDelete = false

    init(todo: Todo, store: TodoStore) {
        _store = ObservedObject(wrappedValue: store)
        _viewModel = StateObject(wrappedValue: TodoDetailViewModel(todo: todo, store: store))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("TODO")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("Todo title", text: $viewModel.todo.title)
                        .font(.title3)
                        .textFieldStyle(.roundedBorder)
                        .submitLabel(.done)
                        .onSubmit {
                            Task { await viewModel.submitTitle() }
                        }

                    Picker(
                        "Status",
                        selection: Binding(
                            get: { viewModel.todo.status },
                            set: { status in
                                Task { await viewModel.selectStatus(status) }
                            }
                        )
                    ) {
                        ForEach(TodoStatus.allCases, id: \.self) { status in
                            Text(status.rawValue).tag(status)
                        }
                    }
                    .pickerStyle(.menu)
                    .accessibilityIdentifier(AccessibilityIdentifiers.statusPicker)
                }

                Button {
                    Task { await viewModel.generate() }
                } label: {
                    HStack {
                        Image(systemName: viewModel.todo.stepsGenerated ? "arrow.clockwise" : "sparkles")
                        Text(viewModel.todo.stepsGenerated ? "Regenerate Steps" : "Generate Steps")
                    }
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .disabled(viewModel.isGenerating)
                .accessibilityLabel(viewModel.todo.stepsGenerated ? "Regenerate Steps" : "Generate Steps")
                .accessibilityIdentifier(AccessibilityIdentifiers.generateStepsButton)

                if viewModel.isGenerating {
                    ProgressView("Generating steps...")
                        .frame(maxWidth: .infinity)
                }

                if !viewModel.todo.steps.isEmpty {
                    ActionStepsView(viewModel: viewModel, store: store)
                }

                Button("Delete Todo", role: .destructive) {
                    confirmsDelete = true
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier(AccessibilityIdentifiers.deleteTodoButton)
                .padding(.top, 16)
            }
            .padding()
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "Delete this todo?",
            isPresented: $confirmsDelete,
            titleVisibility: .visible
        ) {
            Button("Delete Todo", role: .destructive) {
                Task { await viewModel.delete() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .onChange(of: viewModel.shouldDismiss) { _, shouldDismiss in
            if shouldDismiss { dismiss() }
        }
    }
}

struct ActionStepsView: View {
    @ObservedObject var viewModel: TodoDetailViewModel
    @ObservedObject var store: TodoStore

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("ACTION STEPS")
                .font(.caption)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 10) {
                Text(viewModel.progressLabel)
                    .accessibilityIdentifier(AccessibilityIdentifiers.stepsProgressLabel)
                ProgressView(
                    value: Double(viewModel.todo.steps.filter(\.isCompleted).count),
                    total: Double(viewModel.todo.steps.count)
                )
            }

            ForEach(viewModel.todo.steps.sorted { $0.order < $1.order }) { step in
                Divider()
                HStack(alignment: .top, spacing: 12) {
                    Button {
                        Task { await viewModel.toggle(step: step) }
                    } label: {
                        Image(systemName: step.isCompleted ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .foregroundStyle(step.isCompleted ? .green : .secondary)
                    }
                    .disabled(store.pendingStepIDs.contains(step.id))
                    .accessibilityLabel(step.isCompleted ? "Mark step incomplete" : "Mark step complete")
                    .accessibilityIdentifier(AccessibilityIdentifiers.stepToggle(step.order))

                    Text("\(step.order)")
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 20)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(step.title)
                            .strikethrough(step.isCompleted)
                            .foregroundStyle(step.isCompleted ? .secondary : .primary)
                        Text(step.description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 16))
    }
}
