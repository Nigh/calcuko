import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";

describe("bit built-ins", () => {
	it("rotates, reverses and counts arbitrary-width values", () => {
		const result = evaluateSource("hex(rotateL(8,0x81,1))\nhex(reverseBits(8,0x12))\ncount1(128,0xFFFFFFFFFFFFFFFF)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["0x3", "0x48", "64"]);
	});
	it("reverses bytes, swaps nibbles and computes parity", () => {
		const result = evaluateSource("hex(reverseBytes(32,0x12345678))\nhex(swapNib(16,0x12AB))\nevenParity(8,0b1011)\noddParity(8,0b1011)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["0x7856 3412", "0x21BA", "1", "0"]);
	});
	it("packs and unpacks fields", () => {
		const result = evaluateSource("hex(pack(8,[0x12,0x34,0x56]))\nunpack(8,3,0x123456)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["0x12 3456", "[18, 52, 86]"]);
	});
});
