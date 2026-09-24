import Foundation
import XCTest
@testable import SmartTodo

final class APIClientTests: XCTestCase {
    func testDecodesTodoWithNestedSteps() throws {
        let todo = try JSONDecoder().decode(Todo.self, from: Data(todoFixture.utf8))

        XCTAssertEqual(todo.id, "todo-2")
        XCTAssertEqual(todo.status, .inProgress)
        XCTAssertEqual(todo.steps.map(\.id), ["step-2-1"])
        XCTAssertTrue(todo.steps[0].isCompleted)
    }

    func testDecodesAPIErrorMessageForNonSuccessResponse() async {
        let client = makeAPIClient { request in
            jsonResponse(
                for: request,
                status: 400,
                body: #"{"error":{"code":"VALIDATION_ERROR","message":"Title is required"}}"#
            )
        }

        do {
            _ = try await client.createTodo(title: "")
            XCTFail("Expected createTodo to throw")
        } catch {
            XCTAssertEqual((error as? LocalizedError)?.errorDescription, "Title is required")
        }
    }

    func testGetTodosSendsExpectedRequest() async throws {
        let client = makeAPIClient { request in
            XCTAssertEqual(request.httpMethod, "GET")
            XCTAssertEqual(request.url?.path, "/api/todos")
            XCTAssertEqual(
                URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "userId" })?.value,
                "user-1"
            )
            return jsonResponse(for: request, body: "[]")
        }

        _ = try await client.getTodos()
    }

    func testCreateTodoSendsExpectedRequestBody() async throws {
        let client = makeAPIClient { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/api/todos")
            let body = try XCTUnwrap(request.httpBody)
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
            XCTAssertEqual(json, ["title": "Plan a trip", "userId": "user-1"])
            return jsonResponse(for: request, status: 201, body: todoFixture)
        }

        _ = try await client.createTodo(title: "  Plan a trip  ")
    }

    func testUpdateTodoOmitsNilFieldsFromRequestBody() async throws {
        let client = makeAPIClient { request in
            XCTAssertEqual(request.httpMethod, "PATCH")
            XCTAssertEqual(request.url?.path, "/api/todos/todo-2")
            let body = try XCTUnwrap(request.httpBody)
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(json["status"] as? String, "completed")
            XCTAssertNil(json["title"])
            return jsonResponse(for: request, body: todoFixture)
        }

        _ = try await client.updateTodo(id: "todo-2", title: nil, status: "completed")
    }

    func testDeleteTodoAcceptsNoContentResponse() async throws {
        let client = makeAPIClient { request in
            XCTAssertEqual(request.httpMethod, "DELETE")
            XCTAssertEqual(request.url?.path, "/api/todos/todo-2")
            return (
                HTTPURLResponse(url: request.url!, statusCode: 204, httpVersion: nil, headerFields: nil)!,
                Data()
            )
        }

        try await client.deleteTodo(id: "todo-2")
    }

    func testGenerateStepsSendsExpectedRequest() async throws {
        let client = makeAPIClient { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/api/todos/todo-2/generate-steps")
            return jsonResponse(for: request, body: todoFixture)
        }

        _ = try await client.generateSteps(todoId: "todo-2")
    }

    func testUpdateStepSendsExpectedRequestBody() async throws {
        let client = makeAPIClient { request in
            XCTAssertEqual(request.httpMethod, "PATCH")
            XCTAssertEqual(request.url?.path, "/api/todos/todo-2/steps/step-2-1")
            let body = try XCTUnwrap(request.httpBody)
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Bool])
            XCTAssertEqual(json, ["isCompleted": true])
            return jsonResponse(
                for: request,
                body: """
                {"id":"step-2-1","todoId":"todo-2","title":"Choose a desk","description":"Compare options","order":1,"isCompleted":true,"createdAt":"2026-01-01T00:00:00.000Z"}
                """
            )
        }

        _ = try await client.updateStep(todoId: "todo-2", stepId: "step-2-1", isCompleted: true)
    }

    func testAPIMethodsSurfaceDecodedServerErrors() async {
        let operations: [(APIClient) async throws -> Void] = [
            { _ = try await $0.getTodos() },
            { _ = try await $0.createTodo(title: "Title") },
            { _ = try await $0.updateTodo(id: "todo-1", title: "Title", status: nil) },
            { try await $0.deleteTodo(id: "todo-1") },
            { _ = try await $0.generateSteps(todoId: "todo-1") },
            { _ = try await $0.updateStep(todoId: "todo-1", stepId: "step-1", isCompleted: true) },
        ]

        for operation in operations {
            let client = makeAPIClient { request in
                jsonResponse(
                    for: request,
                    status: 503,
                    body: #"{"error":{"code":"UNAVAILABLE","message":"Try again later"}}"#
                )
            }
            do {
                try await operation(client)
                XCTFail("Expected every API method to throw")
            } catch {
                XCTAssertEqual((error as? LocalizedError)?.errorDescription, "Try again later")
            }
        }
    }
}
