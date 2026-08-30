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

	it("preserves string whitespace and URL comment markers", () => {
		const result = evaluateSource('url = "https://example.com/a b"');
		expect(result.variableSnapshot.url).toBe("https://example.com/a b");
	});

	it("uses // as integer division outside line-leading comments", () => {
		const result = evaluateSource("8 // 3\n  // comment");
		expect(result.lineResults.map((line) => line.text)).toEqual(["2", ""]);
	});

	it("does not expose browser or JavaScript globals", () => {
		const result = evaluateSource("globalThis");
		expect(result.lineResults[0]).toMatchObject({ type: "error" });
	});
});
