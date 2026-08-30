import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";
import { MAX_RANGE_ITEMS, createRange } from "./ranges";

describe("ranges", () => {
	it("supports exclusive and inclusive operators", () => {
		const result = evaluateSource("1..5\n1..=5");
		expect(result.lineResults.map((line) => line.text)).toEqual(["[1, 2, 3, 4]", "[1, 2, 3, 4, 5]"]);
	});

	it("supports explicit decimal and descending steps", () => {
		const result = evaluateSource("range(1,3,0.5)\nrange(3,0,-1)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["[1, 1.5, 2, 2.5]", "[3, 2, 1]"]);
	});

	it("rejects zero steps and excessive output", () => {
		expect(evaluateSource("range(1,5,0)").lineResults[0]).toMatchObject({ type: "error", errorCode: "FUNCTION_ERROR" });
		expect(() => createRange(0n, BigInt(MAX_RANGE_ITEMS + 1))).toThrow(/最多生成/);
	});
});
