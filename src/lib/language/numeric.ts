import Decimal from "decimal.js";

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_EVEN });

export type NumericValue = bigint | Decimal | Rational;

const absBigInt = (value: bigint) => value < 0n ? -value : value;
const gcdBigInt = (a: bigint, b: bigint): bigint => {
	a = absBigInt(a); b = absBigInt(b);
	while (b !== 0n) [a, b] = [b, a % b];
	return a;
};

export class Rational {
	readonly numerator: bigint;
	readonly denominator: bigint;
	constructor(numerator: bigint, denominator: bigint) {
		if (denominator === 0n) throw new Error("分数的分母不能为零");
		const sign = denominator < 0n ? -1n : 1n;
		const divisor = gcdBigInt(numerator, denominator);
		this.numerator = sign * numerator / divisor;
		this.denominator = absBigInt(denominator) / divisor;
	}
	toDecimal(): Decimal { return new Decimal(this.numerator.toString()).div(this.denominator.toString()); }
	toString(): string { return this.denominator === 1n ? this.numerator.toString() : `${this.numerator}$${this.denominator}`; }
}

const SI_FACTORS: Record<string, string> = { T: "1e12", G: "1e9", M: "1e6", k: "1e3", m: "1e-3", u: "1e-6", n: "1e-9", p: "1e-12" };

export function parseNumeric(raw: string): NumericValue {
	const compact = raw.replaceAll("_", "");
	const suffix = compact.at(-1) ?? "";
	const factor = SI_FACTORS[suffix];
	const numeric = factor ? compact.slice(0, -1) : compact;
	if (!factor && /^0x/i.test(numeric)) return BigInt(numeric);
	if (!factor && /^0b/i.test(numeric)) return BigInt(numeric);
	if (!factor && /^0[0-7]+$/.test(numeric)) return BigInt(`0o${numeric.slice(1)}`);
	if (!factor && !/[.eE]/.test(numeric)) return BigInt(numeric);
	const value = new Decimal(numeric);
	return factor ? value.mul(factor) : value;
}

export function toDecimal(value: NumericValue): Decimal {
	if (value instanceof Decimal) return value;
	if (value instanceof Rational) return value.toDecimal();
	return new Decimal(value.toString());
}

export function toRational(value: NumericValue): Rational {
	if (value instanceof Rational) return value;
	if (typeof value === "bigint") return new Rational(value, 1n);
	throw new Error("高精度小数不能无损转换为分数");
}

export function toBigIntExact(value: NumericValue): bigint {
	if (typeof value === "bigint") return value;
	if (value instanceof Rational) {
		if (value.denominator !== 1n) throw new Error("该分数不是整数");
		return value.numerator;
	}
	if (!value.isInteger()) throw new Error("该小数不是整数");
	return BigInt(value.toFixed(0));
}

export function numericBinary(operator: string, left: NumericValue, right: NumericValue): NumericValue | boolean {
	if ([">", ">=", "<", "<=", "==", "!="].includes(operator)) {
		const compared = toDecimal(left).comparedTo(toDecimal(right));
		return operator === ">" ? compared > 0 : operator === ">=" ? compared >= 0 : operator === "<" ? compared < 0 : operator === "<=" ? compared <= 0 : operator === "==" ? compared === 0 : compared !== 0;
	}
	if (operator === "$") return new Rational(toBigIntExact(left), toBigIntExact(right));
	if (operator === "//") return BigInt(toDecimal(left).div(toDecimal(right)).trunc().toFixed(0));
	if (operator === "%") {
		if (typeof left === "bigint" && typeof right === "bigint") return left % right;
		return toDecimal(left).mod(toDecimal(right));
	}
	if (operator === "**") {
		if (typeof left === "bigint" && typeof right === "bigint" && right >= 0n) return left ** right;
		return toDecimal(left).pow(toDecimal(right));
	}
	if (operator === "/") return toDecimal(left).div(toDecimal(right));
	if (left instanceof Decimal || right instanceof Decimal) return decimalOperation(operator, toDecimal(left), toDecimal(right));
	if (left instanceof Rational || right instanceof Rational) {
		const a = toRational(left); const b = toRational(right);
		if (operator === "+") return new Rational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
		if (operator === "-") return new Rational(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
		if (operator === "*") return new Rational(a.numerator * b.numerator, a.denominator * b.denominator);
	}
	if (typeof left === "bigint" && typeof right === "bigint") {
		if (operator === "+") return left + right;
		if (operator === "-") return left - right;
		if (operator === "*") return left * right;
	}
	throw new Error(`不支持的数值操作符“${operator}”`);
}

function decimalOperation(operator: string, left: Decimal, right: Decimal): Decimal {
	if (operator === "+") return left.add(right);
	if (operator === "-") return left.sub(right);
	if (operator === "*") return left.mul(right);
	throw new Error(`不支持的十进制操作符“${operator}”`);
}

export function formatNumeric(value: NumericValue): string {
	if (typeof value === "bigint") return value.toString();
	if (value instanceof Rational) return value.toString();
	return value.toSignificantDigits(34).toString();
}

export function numericToNumber(value: NumericValue): number { return toDecimal(value).toNumber(); }
export const decimalFromNumber = (value: number): Decimal => new Decimal(value);
export function isNumericValue(value: unknown): value is NumericValue {
	return typeof value === "bigint" || value instanceof Decimal || value instanceof Rational;
}
