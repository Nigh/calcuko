import { describe, expect, it } from "vitest";
import { evaluateSource, expandRadixLiterals } from "./evaluator";

describe("legacy evaluator", () => {
	it("preserves decimal fractions while expanding octal literals", () => {
		expect(expandRadixLiterals("0.00001")).toBe("0.00001");
		expect(expandRadixLiterals("077")).toBe("63");
	});

	it("evaluates dependent variables", () => {
		const result = evaluateSource("a = 2\nb = a * 3");
		expect(result.lineResults.map((line) => line.text)).toEqual(["a = 2", "b = 6"]);
	});
});
