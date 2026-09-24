import SwiftUI

// Placeholder for the detail screen. Phase 2 replaces this file with the
// "TodoDetailView" and "ActionStepsView" sections of PLAN-phase2-ios.md.
struct TodoDetailView: View {
    let todo: Todo
    @ObservedObject var store: TodoStore

    init(todo: Todo, store: TodoStore) {
        self.todo = todo
        self.store = store
    }

    var body: some View {
        Text(todo.title)
            .font(.title3)
            .padding()
            .navigationBarTitleDisplayMode(.inline)
    }
}
