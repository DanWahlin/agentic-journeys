import XCTest

// Proves the UI test target can launch the app. Delete it in the Phase 2 red phase.
final class StarterUITests: XCTestCase {
    func testAppLaunches() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["starterTitle"].waitForExistence(timeout: 10))
    }
}
