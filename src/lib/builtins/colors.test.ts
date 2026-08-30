import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";

describe("color spaces", () => {
	it("converts standard red between spaces", () => {
		const result = evaluateSource('c=hexColor("#FF0000")\ntoHsl(c)\ntoHsv(c)\ntoYuv(c)\ntoRgb565(c)\ntoHexColor(c)');
		expect(result.lineResults[0].preview?.css).toBe("rgba(255, 0, 0, 1)");
		expect(result.lineResults[1].text).toBe("hsl(0, 100, 50)");
		expect(result.lineResults[2].text).toBe("hsv(0, 100, 100)");
		expect(result.lineResults[4].text).toBe("rgb565(63488)");
		expect(result.lineResults[5].text).toBe('"#FF0000"');
	});
	it("round-trips RGB565 and validates channels", () => {
		const result = evaluateSource("toHexColor(rgb565(2016))\nrgb(256,0,0)");
		expect(result.lineResults[0].text).toBe('"#00FF00"');
		expect(result.lineResults[1]).toMatchObject({ type: "error", errorCode: "FUNCTION_ERROR" });
	});
});
