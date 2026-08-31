import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";
import { parse } from "./parser";

describe("destructuring assignment", () => {
	it("parses and assigns equal-length arrays", () => {
		expect(parse("[a,b,c] = [10,20,30]")).toMatchObject({ kind: "destructuringAssignment", names: ["a", "b", "c"] });
		const result = evaluateSource("[a,b,c] = [10,20,30]\na+b+c");
		expect(result.lineResults.map((line) => line.text)).toEqual(["[10, 20, 30]", "60"]);
		expect(result.variableSnapshot).toMatchObject({ a: 10n, b: 20n, c: 30n });
	});

	it("rejects mismatched lengths without partially assigning", () => {
		const result = evaluateSource("a = 1\n[a,b] = [2]\na\nb");
		expect(result.lineResults[1]).toMatchObject({ type: "error", errorCode: "DESTRUCTURE_LENGTH" });
		expect(result.lineResults[2].text).toBe("1");
		expect(result.lineResults[3]).toMatchObject({ type: "error", errorCode: "UNKNOWN_IDENTIFIER" });
	});
});
