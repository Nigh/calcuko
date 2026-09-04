import { formatNumeric, isNumericValue, toDecimal } from "./numeric";
import { invokeUserFunction, isUserFunction, type RuntimeValue } from "./interpreter";
import { arithmeticBinary, formatQuantity, isArithmeticValue, isQuantity, type ArithmeticValue } from "./units";

const arrayArg = (value: RuntimeValue): RuntimeValue[] => {
	if (!Array.isArray(value)) throw new Error("参数必须是数组");
	return value;
};
const arithmeticArray = (value: RuntimeValue): ArithmeticValue[] => arrayArg(value).map((item) => {
	if (!isArithmeticValue(item)) throw new Error("数组元素必须是数值或量纲值");
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
	sum: (value: RuntimeValue) => { const values=arithmeticArray(value); return values.length ? values.slice(1).reduce((total,item)=>arithmeticBinary("+",total,item) as ArithmeticValue,values[0]) : 0n; },
	ave: (value: RuntimeValue) => {
		const values = arithmeticArray(value); if (!values.length) throw new Error("空数组没有平均值");
		const total=values.slice(1).reduce((sum,item)=>arithmeticBinary("+",sum,item) as ArithmeticValue,values[0]);
		return arithmeticBinary("/", total, BigInt(values.length));
	},
	minArray: (value: RuntimeValue) => arithmeticArray(value).reduce((best, item) => arithmeticBinary("<",item,best) ? item : best),
	maxArray: (value: RuntimeValue) => arithmeticArray(value).reduce((best, item) => arithmeticBinary(">",item,best) ? item : best),
	map: (value: RuntimeValue, fn: RuntimeValue) => arrayArg(value).map((item, index) => call(fn, [item, BigInt(index)])),
	filter: (value: RuntimeValue, fn: RuntimeValue) => arrayArg(value).filter((item, index) => Boolean(call(fn, [item, BigInt(index)]))),
	aggregate: (value: RuntimeValue, fn: RuntimeValue) => {
		const values = arrayArg(value); if (!values.length) throw new Error("空数组不能聚合");
		return values.slice(1).reduce((acc, item) => call(fn, [acc, item]), values[0]);
	},
	sort: (value: RuntimeValue, fn?: RuntimeValue) => [...arrayArg(value)].sort((a, b) => {
		if (fn) { const result = call(fn, [a, b]); if (!isNumericValue(result)) throw new Error("排序函数必须返回数值"); return toDecimal(result).toNumber(); }
		if (isArithmeticValue(a) && isArithmeticValue(b)) return arithmeticBinary("<",a,b) ? -1 : arithmeticBinary(">",a,b) ? 1 : 0;
		return String(a).localeCompare(String(b));
	}),
	unique: (value: RuntimeValue) => {
		const seen = new Set<string>();
		return arrayArg(value).filter((item) => { const key = isQuantity(item) ? `q:${formatQuantity(item)}` : isNumericValue(item) ? `n:${formatNumeric(item)}` : `${typeof item}:${String(item)}`; if (seen.has(key)) return false; seen.add(key); return true; });
	},
};
