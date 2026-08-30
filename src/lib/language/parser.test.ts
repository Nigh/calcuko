import { describe, expect, it } from "vitest";
import { parse } from "./parser";

describe("parse", () => {
	it("respects precedence and right-associative power", () => {
		const statement = parse("result = 2 + 3 * 4 ** 2");
		expect(statement.kind).toBe("assignment");
		if (statement.kind !== "assignment" || statement.value.kind !== "binary") return;
		expect(statement.value.operator).toBe("+");
		expect(statement.value.right).toMatchObject({ operator: "*", right: { operator: "**" } });
	});

	it("parses function calls, arrays and conditional expressions", () => {
		expect(parse("max([1, 2, 3])")).toMatchObject({ kind: "expression", expression: { kind: "call", args: [{ kind: "array" }] } });
		expect(parse("a > 0 ? a : -a")).toMatchObject({ kind: "expression", expression: { kind: "conditional" } });
	});

	it("parses implicit multiplication", () => {
		expect(parse("2PI")).toMatchObject({ kind: "expression", expression: { kind: "binary", operator: "*", implicit: true } });
	});

	it("keeps integer division distinct from comments", () => {
		expect(parse("8 // 3")).toMatchObject({ kind: "expression", expression: { kind: "binary", operator: "//" } });
		expect(parse(" // comment")).toMatchObject({ kind: "empty" });
	});
});
