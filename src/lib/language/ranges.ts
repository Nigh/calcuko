import Decimal from "decimal.js";
import { numericBinary, toDecimal, type NumericValue } from "./numeric";

export const MAX_RANGE_ITEMS = 10_000;

export function createRange(start: NumericValue, stop: NumericValue, step?: NumericValue, inclusive = false): NumericValue[] {
	const direction = toDecimal(stop).comparedTo(toDecimal(start));
	const actualStep = step ?? (direction < 0 ? -1n : 1n);
	const decimalStep = toDecimal(actualStep);
	if (decimalStep.isZero()) throw new Error("范围步长不能为零");
	if (direction > 0 && decimalStep.isNegative()) throw new Error("递增范围不能使用负步长");
	if (direction < 0 && decimalStep.isPositive()) throw new Error("递减范围不能使用正步长");

	const values: NumericValue[] = [];
	let current = start;
	const forward = decimalStep.isPositive();
	while (inclusive
		? (forward ? toDecimal(current).lte(toDecimal(stop)) : toDecimal(current).gte(toDecimal(stop)))
		: (forward ? toDecimal(current).lt(toDecimal(stop)) : toDecimal(current).gt(toDecimal(stop)))) {
		if (values.length >= MAX_RANGE_ITEMS) throw new Error(`范围最多生成 ${MAX_RANGE_ITEMS} 个元素`);
		values.push(current);
		current = numericBinary("+", current, actualStep) as NumericValue;
	}
	return values;
}

export const asNumeric = (value: unknown): NumericValue => {
	if (typeof value === "bigint" || value instanceof Decimal || (typeof value === "object" && value !== null && "numerator" in value && "denominator" in value)) return value as NumericValue;
	throw new Error("范围参数必须是数值");
};
