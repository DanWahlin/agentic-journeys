import XCTest
@testable import SmartTodo

// Proves the unit test target builds and can import the app module. Delete it in the Phase 2 red phase.
final class StarterTests: XCTestCase {
    func testAppModuleIsTestable() {
        XCTAssertNotNil(StarterView())
    }
}
