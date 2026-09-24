import SwiftUI

@main
struct SmartTodoApp: App {
    @StateObject private var store: TodoStore

    init() {
        let arguments = ProcessInfo.processInfo.arguments
        let client: APIClientProtocol = AppDependencies.usesInMemoryClient(arguments: arguments)
            ? InMemoryAPIClient()
            : APIClient()
        _store = StateObject(wrappedValue: TodoStore(client: client))
    }

    var body: some Scene {
        WindowGroup {
            TodoListView(store: store)
        }
    }
}
