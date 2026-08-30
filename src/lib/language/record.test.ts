import { describe, expect, it } from "vitest";
import { formatValue } from "../evaluator";
import { RuntimeRecord } from "./interpreter";

describe("RuntimeRecord", () => {
	it("formats nested values deterministically", () => {
		const value = new RuntimeRecord({ data: 5n, state: "clean", detail: new RuntimeRecord({ bit: 0n }) });
		expect(formatValue(value)).toBe('{ data: 5, state: "clean", detail: { bit: 0 } }');
	});

	it("freezes its public entries", () => {
		const value = new RuntimeRecord({ data: 5n });
		expect(Object.isFrozen(value.entries)).toBe(true);
	});
});
