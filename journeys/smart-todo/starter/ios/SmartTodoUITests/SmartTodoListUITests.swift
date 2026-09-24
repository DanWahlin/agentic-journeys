import XCTest

final class SmartTodoListUITests: XCTestCase {
    func testSeededListAndAddTodo() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing")
        app.launch()

        XCTAssertTrue(app.otherElements["todoRow-todo-1"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.otherElements["todoRow-todo-2"].exists)
        XCTAssertTrue(app.otherElements["todoRow-todo-3"].exists)

        app.buttons["addTodoButton"].tap()
        let titleField = app.textFields["newTodoTitleField"]
        XCTAssertTrue(titleField.waitForExistence(timeout: 2))
        titleField.tap()
        titleField.typeText("Plan a weekend camping trip")
        app.buttons["saveTodoButton"].tap()

        XCTAssertTrue(app.staticTexts["Plan a weekend camping trip"].waitForExistence(timeout: 2))
    }
}
