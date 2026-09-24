import Foundation
import XCTest
@testable import SmartTodo

func makeStep(
    id: String = "step-1",
    todoId: String = "todo-1",
    order: Int = 1,
    isCompleted: Bool = false
) -> ActionStep {
    ActionStep(
        id: id,
        todoId: todoId,
        title: "Step \(order)",
        description: "Description \(order)",
        order: order,
        isCompleted: isCompleted
    )
}

func makeTodo(
    id: String = "todo-1",
    title: String = "Test todo",
    status: TodoStatus = .pending,
    stepsGenerated: Bool = false,
    steps: [ActionStep] = []
) -> Todo {
    Todo(
        id: id,
        title: title,
        status: status,
        stepsGenerated: stepsGenerated,
        steps: steps
    )
}

final class MockAPIClient: APIClientProtocol {
    var getTodosHandler: () async throws -> [Todo] = { [] }
    var createTodoHandler: (String) async throws -> Todo = { title in makeTodo(title: title) }
    var updateTodoHandler: (String, String?, String?) async throws -> Todo = { id, title, _ in
        makeTodo(id: id, title: title ?? "Test todo")
    }
    var deleteTodoHandler: (String) async throws -> Void = { _ in }
    var generateStepsHandler: (String) async throws -> Todo = { id in makeTodo(id: id) }
    var updateStepHandler: (String, String, Bool) async throws -> ActionStep = { todoId, stepId, completed in
        makeStep(id: stepId, todoId: todoId, isCompleted: completed)
    }

    func getTodos() async throws -> [Todo] {
        try await getTodosHandler()
    }

    func createTodo(title: String) async throws -> Todo {
        try await createTodoHandler(title)
    }

    func updateTodo(id: String, title: String?, status: String?) async throws -> Todo {
        try await updateTodoHandler(id, title, status)
    }

    func deleteTodo(id: String) async throws {
        try await deleteTodoHandler(id)
    }

    func generateSteps(todoId: String) async throws -> Todo {
        try await generateStepsHandler(todoId)
    }

    func updateStep(todoId: String, stepId: String, isCompleted: Bool) async throws -> ActionStep {
        try await updateStepHandler(todoId, stepId, isCompleted)
    }
}

struct TestFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

final class URLProtocolStub: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            XCTFail("URLProtocolStub received a request without a handler")
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

func makeAPIClient(
    handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
) -> APIClient {
    URLProtocolStub.requestHandler = handler
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [URLProtocolStub.self]
    return APIClient(
        session: URLSession(configuration: configuration),
        baseURL: URL(string: "http://localhost:7071")!
    )
}

func jsonResponse(
    for request: URLRequest,
    status: Int = 200,
    body: String
) -> (HTTPURLResponse, Data) {
    (
        HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!,
        Data(body.utf8)
    )
}

let todoFixture = """
{
  "id": "todo-2",
  "title": "Set up home office",
  "status": "in_progress",
  "userId": "user-1",
  "stepsGenerated": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "steps": [{
    "id": "step-2-1",
    "todoId": "todo-2",
    "title": "Choose a desk and chair",
    "description": "Compare ergonomic options.",
    "order": 1,
    "isCompleted": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }]
}
"""
