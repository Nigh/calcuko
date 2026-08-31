import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";

describe("array operations", () => {
	it("vectorizes operators recursively and broadcasts scalars", () => {
		const result = evaluateSource("[1,2,3]*4\n[[1,2],[3,4]]+10\n[1,2]+[3]");
		expect(result.lineResults[0].text).toBe("[4, 8, 12]");
		expect(result.lineResults[1].text).toBe("[[11, 12], [13, 14]]");
		expect(result.lineResults[2]).toMatchObject({ type: "error", errorCode: "ARRAY_SHAPE" });
	});

	it("aggregates, maps, filters, sorts and deduplicates", () => {
		const source = "values=[3,1,2,2]\nsum(values)\nave(values)\nmap(values,x=>x*2)\nfilter(values,x=>x>1)\nsort(values)\nunique(values)\naggregate(values,(a,b)=>a+b)";
		const result = evaluateSource(source);
		expect(result.lineResults.slice(1).map((line) => line.text)).toEqual(["8", "2", "[6, 2, 4, 4]", "[3, 2, 2]", "[1, 2, 2, 3]", "[3, 1, 2]", "8"]);
	});
});
