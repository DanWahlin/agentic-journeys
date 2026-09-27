import XCTest
@testable import SmartTodo

final class ViewContractTests: XCTestCase {
    func testStatusBadgeLayoutAdaptsWithoutWrapping() {
        XCTAssertTrue(StatusBadgeLayout.keepsTextOnOneLine)
        XCTAssertTrue(StatusBadgeLayout.stacksAtAccessibilitySizes)
    }

    func testUITestingLaunchUsesInMemoryClient() {
        XCTAssertTrue(AppDependencies.usesInMemoryClient(arguments: ["SmartTodo", "-ui-testing"]))
        XCTAssertFalse(AppDependencies.usesInMemoryClient(arguments: ["SmartTodo"]))
    }

    func testRequiredAccessibilityIdentifiers() {
        XCTAssertEqual(AccessibilityIdentifiers.addTodoButton, "addTodoButton")
        XCTAssertEqual(AccessibilityIdentifiers.todoRow("todo-1"), "todoRow-todo-1")
        XCTAssertEqual(AccessibilityIdentifiers.statusBadge("todo-1"), "statusBadge-todo-1")
        XCTAssertEqual(AccessibilityIdentifiers.newTodoTitleField, "newTodoTitleField")
        XCTAssertEqual(AccessibilityIdentifiers.saveTodoButton, "saveTodoButton")
        XCTAssertEqual(AccessibilityIdentifiers.generateStepsButton, "generateStepsButton")
        XCTAssertEqual(AccessibilityIdentifiers.statusPicker, "statusPicker")
        XCTAssertEqual(AccessibilityIdentifiers.stepToggle(4), "stepToggle-4")
        XCTAssertEqual(AccessibilityIdentifiers.stepsProgressLabel, "stepsProgressLabel")
        XCTAssertEqual(AccessibilityIdentifiers.deleteTodoButton, "deleteTodoButton")
    }
}
