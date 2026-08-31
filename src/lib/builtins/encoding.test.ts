import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";

describe("encoding built-ins", () => {
	it("round-trips UTF-8 including Chinese and emoji", () => {
		const result=evaluateSource('bytes=utf8Enc("算子😊")\nutf8Dec(bytes)');
		expect(result.lineResults[1].text).toBe('"算子😊"');
	});
	it("encodes and decodes Base64 text and bytes", () => {
		const result=evaluateSource('base64Enc("算子")\nbase64Dec("566X5a2Q")\nbase64DecBytes("AAH/")\nbase64EncBytes([0,1,255])');
		expect(result.lineResults.map(x=>x.text)).toEqual(['"566X5a2Q"','"算子"','[0, 1, 255]','"AAH/"']);
	});
	it("round-trips URL encoding and rejects malformed inputs", () => {
		const result=evaluateSource('urlDec(urlEnc("a b/算子"))\nbase64Dec("@@")\nutf8Dec([255])\nurlDec("%ZZ")');
		expect(result.lineResults[0].text).toBe('"a b/算子"');
		expect(result.lineResults.slice(1).every(x=>x.type==="error")).toBe(true);
	});
});
