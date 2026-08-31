import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";

describe("matrix", () => {
	it("constructs and formats a dedicated matrix value", () => {
		expect(evaluateSource("matrix([[1,2],[3,4]])").lineResults[0].text).toBe("matrix([[1, 2], [3, 4]])");
	});

	it("constructs row and column matrices with variadic sugar", () => {
		const result = evaluateSource("row(1,2,3)\ncol(1,2,3)\nrow(1,2,3)*col(1,2,3)\nrow()\ncol(1,\"x\")");
		expect(result.lineResults[0].text).toBe("matrix([[1, 2, 3]])");
		expect(result.lineResults[1].text).toBe("matrix([[1], [2], [3]])");
		expect(result.lineResults[2].text).toBe("matrix([[14]])");
		expect(result.lineResults[3]).toMatchObject({ type: "error", errorCode: "FUNCTION_ERROR" });
		expect(result.lineResults[4]).toMatchObject({ type: "error", errorCode: "FUNCTION_ERROR" });
	});

	it("supports scalar, elementwise, and matrix multiplication", () => {
		const source = "a=matrix([[1,2],[3,4]])\na+1\na+a\na*matrix([[2,0],[0,2]])";
		expect(evaluateSource(source).lineResults.slice(1).map((line) => line.text)).toEqual([
			"matrix([[2, 3], [4, 5]])", "matrix([[2, 4], [6, 8]])", "matrix([[2, 4], [6, 8]])",
		]);
	});

	it("computes exact determinants and rejects non-square matrices", () => {
		const result = evaluateSource("det(matrix([[1$2,1],[2,3]]))\ndet(matrix([[1,2,3],[4,5,6]]))");
		expect(result.lineResults[0].text).toBe("-1$2");
		expect(result.lineResults[1]).toMatchObject({ type: "error", errorCode: "FUNCTION_ERROR" });
	});
});
