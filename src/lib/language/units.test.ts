import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";
import { sampleFormula, sampleFormulaEnglish } from "../constants";

const evaluateUnits = (source: string) => evaluateSource(source, "en", { dimensions: true });

describe("physical dimensions and units", () => {
	it("keeps the bundled samples free of unit-name assignments", () => {
		for (const source of [sampleFormula,sampleFormulaEnglish]) {
			expect(source).not.toMatch(/^\s*(?:C|h)\s*=/m);
			expect(evaluateUnits(source).lineResults.every((line)=>line.type!=="error")).toBe(true);
		}
	});
	it("is disabled by default and enabled explicitly", () => {
		expect(evaluateSource("3 km").lineResults[0]).toMatchObject({ type: "error", errorCode: "DIMENSIONS_DISABLED" });
		expect(evaluateUnits("3 km").lineResults[0].text).toBe("3 km");
		expect(evaluateUnits("m**2").lineResults[0].text).toBe("1 ㎡");
	});

	it("converts compatible units and rejects mismatched dimensions", () => {
		expect(evaluateUnits("120 km/h -> mph").lineResults[0].text).toBe("74.5645430684801 mph");
		expect(evaluateUnits("1 m + 1 s").lineResults[0]).toMatchObject({ type: "error", errorCode: "DIMENSION_ERROR" });
	});

	it("simplifies compound calculations using input unit hints", () => {
		expect(evaluateUnits("15 km/h * 30 min").lineResults[0].text).toBe("7.5 km");
		expect(evaluateUnits("force = 2 kg * 3 m/s^2").lineResults[0].text).toBe("6 N");
		expect(evaluateUnits("10 m**2\n10 m^2\n(10 m)**2\n10 m^2 -> ha\n1 m/s^2").lineResults.map((line)=>line.text)).toEqual(["100 ㎡", "10 ㎡", "100 ㎡", "0.001 ha", "1 m/s²"]);
	});

	it("preserves a powered unit through dimensionless factors and variables", () => {
		const result=evaluateUnits("半径 = 5 m\nπ = PI\n面积 = π * 半径**2");
		expect(result.lineResults.map((line)=>line.text)).toEqual(["5 m", "3.141592653589793238462643383279503", "78.5398163397448 ㎡"]);
	});

	it("supports temperature offsets and dimensional functions", () => {
		expect(evaluateUnits("25 degC -> degF").lineResults[0].text).toBe("77 degF");
		expect(evaluateUnits("20 degC - 10 degC").lineResults[0].text).toBe("10 K");
		expect(evaluateUnits("sin(30 deg)").lineResults[0].text).toBe("0.5");
		expect(evaluateUnits("sqrt(9 m^2)").lineResults[0].text).toBe("3 m");
	});

	it("keeps compact SI suffixes distinct from spaced units", () => {
		expect(evaluateUnits("10m\n10 m").lineResults.map((line) => line.text)).toEqual(["10m", "10 m"]);
	});

	it("propagates quantities through arrays, matrices, and statistics", () => {
		const result = evaluateUnits("sum([1 m, 50 cm])\nmean(1 s, 3 s)\nmatrix([[1 m,2 m]]) * 2");
		expect(result.lineResults.map((line) => line.text)).toEqual(["1.5 m", "2 s", "matrix([[2 m, 4 m]])"]);
	});

	it("keeps colliding built-in functions callable and supports dimensional ranges", () => {
		const result=evaluateUnits("min(3, 2)\nrange(1 m, 3 m)\nfn travel(v,t)=v*t\ntravel(10 m/s, 2 s)");
		expect(result.lineResults.map((line)=>line.text)).toEqual(["2", "[1 m, 2 m]", "<function travel(v, t)>", "20 m"]);
	});

	it("does not change inverse-trigonometric results while the mode is off", () => {
		expect(evaluateSource("asin(1)", "en").lineResults[0].text).toBe("1.5707963267948966");
		expect(evaluateUnits("asin(1) -> deg").lineResults[0].text).toMatch(/^90(?:\.0+)? deg$/);
	});

	it("keeps caret as bitwise xor outside dimension mode", () => {
		expect(evaluateSource("10 ^ 3", "en").lineResults[0].text).toBe("9");
	});
});
