import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";
describe("number theory", () => {
	it("checks primes and factors integers", () => {
		const result = evaluateSource("isPrime(2)\nisPrime(1)\nprimeFact(360)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["true", "false", "[2, 2, 2, 3, 3, 5]"]);
	});
	it("computes gcd and lcm for arguments or arrays", () => {
		const result = evaluateSource("gcd(48,18)\nlcm([4,6,10])\ngcd(-12,0)");
		expect(result.lineResults.map((line) => line.text)).toEqual(["6", "60", "12"]);
	});
});
