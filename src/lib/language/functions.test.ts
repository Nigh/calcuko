import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";
import { parse } from "./parser";

describe("user functions", () => {
	it("parses fn and lambda forms", () => {
		expect(parse("fn add(a,b)=a+b")).toMatchObject({ kind: "functionDefinition", name: "add", parameters: ["a", "b"] });
		expect(parse("f = (a,b) => a*b")).toMatchObject({ kind: "assignment", value: { kind: "lambda", parameters: ["a", "b"] } });
	});

	it("rejects def as a function definition keyword", () => {
		expect(() => parse("def add(a,b)=a+b")).toThrow();
	});

	it("evaluates definitions and lambdas", () => {
		const result = evaluateSource("fn square(x)=x**2\nsquare(12)\ntriple = x => x*3\ntriple(7)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["<function square(x)>", "144", "<function(x)>", "21"]);
	});

	it("captures lexical scope", () => {
		const result = evaluateSource("factor = 5\nscale = x => x*factor\nscale(4)");
		expect(result.lineResults[2].text).toBe("20");
	});

	it("supports recursion and validates arity", () => {
		const result = evaluateSource("fn fact(n)=n<=1?1:n*fact(n-1)\nfact(10)\nfact()");
		expect(result.lineResults[1].text).toBe("3628800");
		expect(result.lineResults[2]).toMatchObject({ type: "error", errorCode: "ARITY_MISMATCH" });
	});
});
