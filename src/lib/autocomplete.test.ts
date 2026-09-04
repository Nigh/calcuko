import { describe, expect, it } from "vitest";
import { completionOptions } from "./autocomplete";

describe("completionOptions", () => {
	it("includes earlier variables, custom functions, and built-in functions", () => {
		const source = "金额 = 12\nfn double(value)=value*2\ndou";
		const options = completionOptions(source, source.length);

		expect(options).toEqual(expect.arrayContaining([
			expect.objectContaining({ label: "金额", type: "variable", detail: "上方变量" }),
			expect.objectContaining({ label: "double", type: "function", detail: "自定义函数 (value)" }),
			expect.objectContaining({ label: "sqrt", type: "function", detail: "Math.sqrt(x) — 平方根" }),
		]));
	});

	it("does not suggest declarations from the current or following lines", () => {
		const source = "first = 1\ncurrent = fir\nlater = 3";
		const labels = completionOptions(source, source.indexOf("fir", source.indexOf("current")) + 3).map(({ label }) => label);

		expect(labels).toContain("first");
		expect(labels).not.toContain("current");
		expect(labels).not.toContain("later");
	});

	it("keeps a shadowing user function instead of its built-in namesake", () => {
		const source = "fn sqrt(value)=value\nsq";
		const sqrt = completionOptions(source, source.length).find(({ label }) => label === "sqrt");

		expect(sqrt).toMatchObject({ detail: "自定义函数 (value)", boost: 2 });
	});
});
