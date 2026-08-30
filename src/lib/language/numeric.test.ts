import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { Rational, formatNumeric, numericBinary, parseNumeric } from "./numeric";
import { evaluateSource } from "../evaluator";

describe("numeric tower", () => {
	it("parses integers beyond the JavaScript safe range", () => {
		expect(parseNumeric("18446744073709551615")).toBe(18446744073709551615n);
		expect(formatNumeric(parseNumeric("0xFFFFFFFFFFFFFFFF"))).toBe("18446744073709551615");
	});

	it("uses 34-digit decimal arithmetic", () => {
		const result = numericBinary("/", 1n, 3n);
		expect(result).toBeInstanceOf(Decimal);
		expect(formatNumeric(result as Decimal)).toBe("0.3333333333333333333333333333333333");
	});

	it("normalizes exact fractions", () => {
		expect(new Rational(6n, -8n).toString()).toBe("-3$4");
		expect(formatNumeric(numericBinary("+", new Rational(1n, 3n), new Rational(1n, 6n)) as Rational)).toBe("1$2");
	});

	it("evaluates fraction literals and arbitrary-precision radix output", () => {
		const result = evaluateSource("fraction = 2$4\nhex(18446744073709551615)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["fraction = 1$2", "0xFFFF FFFF FFFF FFFF"]);
	});
});
