import XCTest

final class SmartTodoFlowUITests: XCTestCase {
    func testAddGenerateCompleteFlow() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing")
        app.launch()

        XCTAssertTrue(app.otherElements["todoRow-todo-1"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.otherElements["todoRow-todo-2"].exists)
        XCTAssertTrue(app.otherElements["todoRow-todo-3"].exists)

        app.buttons["addTodoButton"].tap()
        let titleField = app.textFields["newTodoTitleField"]
        XCTAssertTrue(titleField.waitForExistence(timeout: 10))
        titleField.tap()
        titleField.typeText("Plan a weekend camping trip")
        app.buttons["saveTodoButton"].tap()

        let newTodo = app.staticTexts["Plan a weekend camping trip"]
        XCTAssertTrue(newTodo.waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["statusBadge-todo-4"].label, "pending")
        newTodo.tap()
        XCTAssertEqual(app.buttons["generateStepsButton"].label, "Generate Steps")
        app.buttons["generateStepsButton"].tap()

        XCTAssertTrue(app.staticTexts["stepsProgressLabel"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["stepsProgressLabel"].label, "0 of 4 complete")
        for order in 1...4 {
            let checkbox = app.buttons["stepToggle-\(order)"]
            XCTAssertTrue(checkbox.exists)
            checkbox.tap()
            waitForProgress("\(order) of 4 complete", in: app)
        }

        app.navigationBars.buttons.element(boundBy: 0).tap()
        let newBadge = app.staticTexts["statusBadge-todo-4"]
        XCTAssertTrue(newBadge.waitForExistence(timeout: 10))
        let completed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", "completed"),
            object: newBadge
        )
        XCTAssertEqual(XCTWaiter.wait(for: [completed], timeout: 10), .completed)
    }

    private func waitForProgress(
        _ expectedProgress: String,
        in app: XCUIApplication,
        timeout: TimeInterval = 10
    ) {
        let progressLabel = app.staticTexts["stepsProgressLabel"]
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", expectedProgress),
            object: progressLabel
        )

        XCTAssertEqual(
            XCTWaiter.wait(for: [expectation], timeout: timeout),
            .completed,
            "Expected progress to reach \(expectedProgress)"
        )
    }
}
