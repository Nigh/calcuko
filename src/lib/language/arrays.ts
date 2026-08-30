import { formatNumeric, isNumericValue, numericBinary, toDecimal, type NumericValue } from "./numeric";
import { invokeUserFunction, isUserFunction, type RuntimeValue } from "./interpreter";

const arrayArg = (value: RuntimeValue): RuntimeValue[] => {
	if (!Array.isArray(value)) throw new Error("参数必须是数组");
	return value;
};
const numericArray = (value: RuntimeValue): NumericValue[] => arrayArg(value).map((item) => {
	if (!isNumericValue(item)) throw new Error("数组元素必须是数值");
	return item;
});
const call = (fn: RuntimeValue, args: RuntimeValue[]): RuntimeValue => {
	if (isUserFunction(fn)) return invokeUserFunction(fn, args.slice(0, fn.parameters.length));
	if (typeof fn === "function") return fn(...args);
	throw new Error("参数必须是函数");
};

export const arrayBuiltins = {
	len: (value: RuntimeValue) => BigInt(arrayArg(value).length),
	reverse: (value: RuntimeValue) => [...arrayArg(value)].reverse(),
	sum: (value: RuntimeValue) => numericArray(value).reduce((total, item) => numericBinary("+", total, item) as NumericValue, 0n),
	ave: (value: RuntimeValue) => {
		const values = numericArray(value); if (!values.length) throw new Error("空数组没有平均值");
		return numericBinary("/", values.reduce((total, item) => numericBinary("+", total, item) as NumericValue, 0n), BigInt(values.length));
	},
	minArray: (value: RuntimeValue) => numericArray(value).reduce((best, item) => toDecimal(item).lt(toDecimal(best)) ? item : best),
	maxArray: (value: RuntimeValue) => numericArray(value).reduce((best, item) => toDecimal(item).gt(toDecimal(best)) ? item : best),
	map: (value: RuntimeValue, fn: RuntimeValue) => arrayArg(value).map((item, index) => call(fn, [item, BigInt(index)])),
	filter: (value: RuntimeValue, fn: RuntimeValue) => arrayArg(value).filter((item, index) => Boolean(call(fn, [item, BigInt(index)]))),
	aggregate: (value: RuntimeValue, fn: RuntimeValue) => {
		const values = arrayArg(value); if (!values.length) throw new Error("空数组不能聚合");
		return values.slice(1).reduce((acc, item) => call(fn, [acc, item]), values[0]);
	},
	sort: (value: RuntimeValue, fn?: RuntimeValue) => [...arrayArg(value)].sort((a, b) => {
		if (fn) { const result = call(fn, [a, b]); if (!isNumericValue(result)) throw new Error("排序函数必须返回数值"); return toDecimal(result).toNumber(); }
		if (isNumericValue(a) && isNumericValue(b)) return toDecimal(a).comparedTo(toDecimal(b));
		return String(a).localeCompare(String(b));
	}),
	unique: (value: RuntimeValue) => {
		const seen = new Set<string>();
		return arrayArg(value).filter((item) => { const key = isNumericValue(item) ? `n:${formatNumeric(item)}` : `${typeof item}:${String(item)}`; if (seen.has(key)) return false; seen.add(key); return true; });
	},
};
