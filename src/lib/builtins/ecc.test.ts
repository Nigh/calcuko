import { describe, expect, it } from "vitest";
import { eccDecode, eccEncode } from "./ecc";

describe("Hamming SECDED", () => {
	it("round-trips clean codewords", () => {
		const encoded = eccEncode(16n, 0xBEEFn);
		expect(eccDecode(16n, encoded).entries).toMatchObject({ data: 0xBEEFn, status: "clean", errorBit: 0n, corrected: encoded });
	});
	it("corrects every single bit including overall parity", () => {
		const encoded = eccEncode(8n, 0xA5n);
		for (let bit = 0n; bit < 13n; bit++) {
			const result = eccDecode(8n, encoded ^ (1n << bit)).entries;
			expect(result).toMatchObject({ data: 0xA5n, status: "corrected", errorBit: bit + 1n, corrected: encoded });
		}
	});
	it("detects but does not correct double-bit errors", () => {
		const encoded = eccEncode(8n, 0x5An);
		expect(eccDecode(8n, encoded ^ 1n ^ 2n).entries.status).toBe("double-error");
	});
});
