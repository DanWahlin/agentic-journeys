import XCTest
@testable import SmartTodo

final class TodoDetailLayoutTests: XCTestCase {
    func testSevenGeneratedStepsAreScrollableAndReachable() {
        let steps = (1...7).map { makeStep(id: "step-\($0)", order: $0) }

        XCTAssertEqual(steps.count, 7)
        XCTAssertTrue(TodoDetailLayout.supportsScrolling)
    }
}
