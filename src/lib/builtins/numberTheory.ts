import { toBigIntExact, type NumericValue } from "../language/numeric";
import type { RuntimeValue } from "../language/interpreter";

const integer = (value: unknown) => toBigIntExact(value as NumericValue);
const abs = (n: bigint) => n < 0n ? -n : n;
export function gcdValue(a: bigint, b: bigint): bigint { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
export function isPrimeValue(value: bigint): boolean {
	if (value < 2n) return false; if (value % 2n === 0n) return value === 2n;
	for (let divisor = 3n; divisor * divisor <= value; divisor += 2n) if (value % divisor === 0n) return false;
	return true;
}
export function factors(value: bigint): bigint[] {
	let remaining = abs(value); if (remaining < 2n) return [];
	const result: bigint[] = [];
	for (let divisor = 2n; divisor * divisor <= remaining; divisor += divisor === 2n ? 1n : 2n) while (remaining % divisor === 0n) { result.push(divisor); remaining /= divisor; }
	if (remaining > 1n) result.push(remaining); return result;
}
const values = (args: RuntimeValue[]) => args.length === 1 && Array.isArray(args[0]) ? args[0] as RuntimeValue[] : args;
export const numberTheoryBuiltins = {
	isPrime: (value: unknown) => isPrimeValue(integer(value)),
	primeFact: (value: unknown) => factors(integer(value)),
	gcd: (...args: RuntimeValue[]) => values(args).map(integer).reduce(gcdValue),
	lcm: (...args: RuntimeValue[]) => values(args).map(integer).reduce((a, b) => a === 0n || b === 0n ? 0n : abs(a / gcdValue(a, b) * b)),
};
