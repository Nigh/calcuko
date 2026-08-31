import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { evaluateSource } from "./evaluator";
import { formatOptions, formatResult } from "./resultFormatting";
import { Rational } from "./language/numeric";

const valueAt = (source: string) => evaluateSource(source).lineResults[0].value;

describe("result formatting", () => {
	it("formats exact integers in decimal and grouped radices", () => {
		expect(formatResult(-65535n, { name: "hex" })).toBe("-0xFFFF");
		expect(formatResult(255n, { name: "binary" })).toBe("0b1111 1111");
		expect(formatResult(511n, { name: "octal" })).toBe("0777");
		expect(formatOptions(new Decimal("2.0")).map((item) => item.name)).toContain("hex");
	});
	it("applies decimal-place and significant-digit precision", () => {
		expect(formatResult(new Decimal("1.2"), { name: "decimal", precision: 4 })).toBe("1.2000");
		expect(formatResult(new Decimal("12345"), { name: "scientific", precision: 4 })).toBe("1.234e+4");
		expect(formatResult(new Rational(1n, 8n), { name: "decimal", precision: 4 })).toBe("0.1250");
		expect(formatResult(new Decimal("0.00000123"), { name: "si", precision: 3 })).toBe("1.23u");
	});
	it("converts color display formats without changing the value", () => {
		const color = valueAt('hexColor("#FF0000")');
		expect(formatResult(color, { name: "hexColor" })).toBe("#FF0000");
		expect(formatResult(color, { name: "hsl" })).toBe("hsl(0, 100, 50)");
		expect(formatOptions(color).map((item) => item.name)).toContain("rgb565");
	});
});
