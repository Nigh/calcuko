import type { LineResult } from "./types";
import { enableDimensions, evaluateStatement, isRuntimeRecord, isUserFunction, type RuntimeScope, type RuntimeValue } from "./language/interpreter";
import { parse } from "./language/parser";
import { LanguageError } from "./language/token";
import Decimal from "decimal.js";
import { Rational, decimalFromNumber, formatNumeric, isNumericValue, numericToNumber, toBigIntExact, toDecimal, type NumericValue } from "./language/numeric";
import { asArithmetic, createArithmeticRange } from "./language/ranges";
import { arrayBuiltins } from "./language/arrays";
import { Matrix, determinant, isMatrix } from "./language/matrix";
import { bitBuiltins } from "./builtins/bits";
import { numberTheoryBuiltins } from "./builtins/numberTheory";
import { eccBuiltins } from "./builtins/ecc";
import { colorBuiltins, isColorValue } from "./builtins/colors";
import { encodingBuiltins } from "./builtins/encoding";
import { randomBuiltins, statisticsBuiltins } from "./builtins/statistics";
import { solverBuiltins } from "./builtins/solver";
import { getLocale, localizeError, t, type Locale } from "./i18n";
import { Quantity, formatQuantity, formatUnitSymbol, isQuantity, isScalarQuantity, isUnitValue, quantityBinary, sameDimension, unitContext } from "./language/units";

// 从低位起每 groupSize 位添加空格
export function formatRadixString(str: string, groupSize: number): string {
	// 补齐到 groupSize 的整数倍，从低位分组
	const padLen = str.length % groupSize;
	const padded = padLen !== 0 ? str.padStart(str.length + (groupSize - padLen), "0") : str;
	const groups: string[] = [];
	for (let i = 0; i < padded.length; i += groupSize) {
		groups.push(padded.slice(i, i + groupSize));
	}
	return groups.join(" ").replace(/^0+/, "") || "0";
}

// 判断字符串是否是以进制前缀开头的进制表示
export function isRadixString(s: string): boolean {
	return /^0[xXbB]/.test(s) || /^0[0-7]/.test(s);
}

// 进制转换函数
export function toHex(n: NumericValue): string {
	const hexStr = toBigIntExact(n).toString(16).toUpperCase();
	return "0x" + formatRadixString(hexStr, 4);
}

export function toBin(n: NumericValue): string {
	const binStr = toBigIntExact(n).toString(2);
	return "0b" + formatRadixString(binStr, 4);
}

export function toOct(n: NumericValue): string {
	const octStr = toBigIntExact(n).toString(8);
	return "0" + formatRadixString(octStr, 4);
}

export function formatValue(value: unknown): string {
	if (isQuantity(value)) return formatQuantity(value);
	if (isUnitValue(value)) return `1 ${formatUnitSymbol(value.symbol)}`;
	if (isColorValue(value)) return `${value.space}(${value.channels.map((item) => item.toDecimalPlaces(4).toString()).join(", ")})`;
	if (isRuntimeRecord(value)) return `{ ${Object.entries(value.entries).map(([key, item]) => `${key}: ${formatValue(item)}`).join(", ")} }`;
	if (isMatrix(value)) return `matrix(${formatValue(value.rows)})`;
	if (isUserFunction(value)) return `<function${value.name ? ` ${value.name}` : ""}(${value.parameters.join(", ")})>`;
	if (typeof value === "bigint" || value instanceof Decimal || value instanceof Rational) return formatNumeric(value);
	if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
	if (typeof value === "number") {
		if (Number.isNaN(value)) return "NaN";
		if (!Number.isFinite(value)) return String(value);
		// 限制小数位数
		if (!Number.isInteger(value)) {
			return Number(value.toFixed(4)).toString();
		}
	}

	if (typeof value === "string") {
		// 判断是否为进制字符串（hex/bin/oct 函数返回值），对数字部分每4位分组
		if (isRadixString(value)) {
			const prefix = value.startsWith("0x") ? "0x" : value.startsWith("0b") ? "0b" : "0";
			const digits = value.slice(prefix.length).replace(/\s+/g, "");
			const groupSize = prefix === "0b" ? 4 : 4;
			return prefix + formatRadixString(digits, groupSize);
		}
		return JSON.stringify(value);
	}
	if (typeof value === "undefined") return "undefined";

	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

// 将表达式中含 emoji 的变量名替换为 scope["name"] 语法
const numericArg = (value: unknown): NumericValue => {
	if (typeof value === "bigint" || value instanceof Decimal || value instanceof Rational) return value;
	if (isQuantity(value) && isScalarQuantity(value)) return value.value;
	throw new Error("函数参数必须是数值");
};
const unaryMath = (fn: (value: number) => number) => (value: unknown) => decimalFromNumber(fn(numericToNumber(numericArg(value))));
const variadicMath = (fn: (...values: number[]) => number) => (...values: unknown[]) => decimalFromNumber(fn(...values.map((value) => numericToNumber(numericArg(value)))));
const trig = (fn: (value: number) => number, value: unknown) => {
	if (isQuantity(value)) {
		if (!sameDimension(value.dimension, unitContext().rad.dimension)) throw new Error("三角函数参数必须是角度或无量纲数值");
		return decimalFromNumber(fn(toDecimal(value.value).toNumber()));
	}
	return decimalFromNumber(fn(numericToNumber(numericArg(value))));
};
const inverseTrig = (fn: (value: number) => number, value: unknown) => new Quantity(decimalFromNumber(fn(numericToNumber(numericArg(value)))), unitContext().rad.dimension, unitContext().rad);
const dimensionalExtremum = (values: unknown[], maximum: boolean): RuntimeValue => {
	if (!values.length) return decimalFromNumber(maximum ? -Infinity : Infinity);
	if (values.some(isQuantity)) {
		if (!values.every(isQuantity)) throw new Error("操作数的量纲不一致");
		const quantities = values as Quantity[];
		if (!quantities.every((value) => sameDimension(value.dimension, quantities[0].dimension))) throw new Error("操作数的量纲不一致");
		return quantities.reduce((best, value) => maximum === (toDecimal(value.value).gt(toDecimal(best.value))) ? value : best);
	}
	return variadicMath(maximum ? Math.max : Math.min)(...values);
};
const roundQuantity = (value: Quantity, operation: (value: Decimal)=>Decimal) => {
	const unit=value.displayUnit;
	if(!unit)return new Quantity(operation(toDecimal(value.value)),value.dimension,undefined,value.hints);
	const displayed=toDecimal(value.value).sub(unit.offset).div(unit.factor);
	return new Quantity(operation(displayed).mul(unit.factor).add(unit.offset),value.dimension,unit,value.hints);
};
const convertBigInt = (value: unknown) => typeof value === "string" ? BigInt(value) : toBigIntExact(numericArg(value));
const convertDecimal = (value: unknown) => typeof value === "string" ? new Decimal(value) : toDecimal(numericArg(value));

export const mathContext: RuntimeScope = {
	abs: (value: unknown) => {
		if (isQuantity(value)) return new Quantity(toDecimal(value.value).abs(), value.dimension, value.displayUnit, value.hints);
		const numeric = numericArg(value);
		if (typeof numeric === "bigint") return numeric < 0n ? -numeric : numeric;
		if (numeric instanceof Rational) return new Rational(numeric.numerator < 0n ? -numeric.numerator : numeric.numerator, numeric.denominator);
		return numeric.abs();
	},
	acos: unaryMath(Math.acos),
	asin: unaryMath(Math.asin),
	atan: unaryMath(Math.atan),
	ceil: (value: unknown) => isQuantity(value) ? roundQuantity(value,(number)=>number.ceil()) : BigInt(new Decimal(formatNumeric(numericArg(value))).ceil().toFixed(0)),
	cos: (value: unknown) => trig(Math.cos, value),
	exp: unaryMath(Math.exp),
	floor: (value: unknown) => isQuantity(value) ? roundQuantity(value,(number)=>number.floor()) : BigInt(new Decimal(formatNumeric(numericArg(value))).floor().toFixed(0)),
	log: unaryMath(Math.log),
	max: (...values: unknown[]) => dimensionalExtremum(values, true),
	min: (...values: unknown[]) => dimensionalExtremum(values, false),
	pow: (left: unknown, right: unknown) => isQuantity(left)
		? quantityBinary("**", left, numericArg(right)) as RuntimeValue
		: new Decimal(formatNumeric(numericArg(left))).pow(new Decimal(formatNumeric(numericArg(right)))),
	round: (value: unknown) => isQuantity(value) ? roundQuantity(value,(number)=>number.toDecimalPlaces(0,Decimal.ROUND_HALF_EVEN)) : BigInt(new Decimal(formatNumeric(numericArg(value))).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toFixed(0)),
	sin: (value: unknown) => trig(Math.sin, value),
	sqrt: (value: unknown) => isQuantity(value) ? quantityBinary("**", value, new Rational(1n,2n)) as RuntimeValue : new Decimal(formatNumeric(numericArg(value))).sqrt(),
	tan: (value: unknown) => trig(Math.tan, value),
	PI: new Decimal("3.141592653589793238462643383279503"),
	E: new Decimal("2.718281828459045235360287471352662"),
	bigint: convertBigInt,
	decimal: convertDecimal,
	rat: (numerator: unknown, denominator: unknown = 1n) => new Rational(convertBigInt(numerator), convertBigInt(denominator)),
	range: (start: unknown, stop: unknown, step?: unknown) => createArithmeticRange(asArithmetic(start), asArithmetic(stop), step === undefined ? undefined : asArithmetic(step)),
	...arrayBuiltins,
	matrix: (rows: unknown) => {
		if (!Array.isArray(rows)) throw new Error("matrix() 需要二维数组");
		return new Matrix(rows);
	},
	row: (...values: RuntimeValue[]) => new Matrix([values]),
	col: (...values: RuntimeValue[]) => new Matrix(values.map((value) => [value])),
	det: (value: unknown) => {
		if (!isMatrix(value)) throw new Error("det() 需要 Matrix 值");
		return determinant(value);
	},
	...bitBuiltins,
	...numberTheoryBuiltins,
	...eccBuiltins,
	...colorBuiltins,
	...encodingBuiltins,
	...statisticsBuiltins,
	...randomBuiltins,
	...solverBuiltins,
	hex: toHex,
	bin: toBin,
	oct: toOct,
};
const dimensionalMathContext: RuntimeScope = {
	acos: (value: unknown) => inverseTrig(Math.acos, value),
	asin: (value: unknown) => inverseTrig(Math.asin, value),
	atan: (value: unknown) => inverseTrig(Math.atan, value),
};

const resultValueKind = (value: unknown): LineResult["valueKind"] => {
	if (isQuantity(value)) return "quantity";
	if (typeof value === "bigint") return "bigint";
	if (value instanceof Decimal) return "decimal";
	if (value instanceof Rational) return "rational";
	if (isColorValue(value)) return "color";
	if (isMatrix(value)) return "matrix";
	return "other";
};

export type EvaluationOptions = { dimensions?: boolean };
export function evaluateSource(input: string, locale: Locale = getLocale(), options: EvaluationOptions = {}): { lines: string[]; lineResults: LineResult[]; variableSnapshot: Record<string, unknown> } {
	const normalized = input.replace(/\r\n?/g, "\n");
	const nextLines = normalized.split("\n");
	const scope: RuntimeScope = { ...mathContext, ...(options.dimensions ? { ...dimensionalMathContext, ...unitContext() } : {}) };
	if (options.dimensions) for (const [name,value] of Object.entries({ ...mathContext, ...dimensionalMathContext })) if (typeof value === "function") scope[`__function__${name}`] = value;
	if (options.dimensions) enableDimensions(scope);
	const nextLineResults: LineResult[] = [];
	const nextSnapshot: Record<string, unknown> = {};

	for (const [lineIndex, rawLine] of nextLines.entries()) {
		if (!rawLine.trim() || rawLine.trimStart().startsWith("//")) {
			nextLineResults.push({ type: "empty", text: "" });
			continue;
		}
		try {
			const { value, name, names, hasSi } = evaluateStatement(parse(rawLine, { dimensions: options.dimensions }), scope);
			if (names) {
				for (const assignedName of names) nextSnapshot[assignedName] = scope[assignedName];
				nextLineResults.push({ type: "success", text: formatValue(value), value, valueKind: resultValueKind(value), hasSi });
				continue;
			}
			if (name) {
				nextSnapshot[name] = value;
				const displayValue = hasSi && isNumericValue(value) ? formatNumericWithSi(value) : formatValue(value);
				nextLineResults.push({ 
					type: "success", 
					text: displayValue,
					value, valueKind: resultValueKind(value), hasSi,
					varName: name,
					preview: isColorValue(value) ? { type: "color", css: value.css } : undefined,
				});
			} else if (value !== null) {
				const displayValue = hasSi && isNumericValue(value) ? formatNumericWithSi(value) : formatValue(value);
				nextLineResults.push({ 
					type: "success", 
					text: displayValue,
					value, valueKind: resultValueKind(value), hasSi,
					preview: isColorValue(value) ? { type: "color", css: value.css } : undefined,
				});
			}
		} catch (error) {
			if (error instanceof LanguageError) {
				nextLineResults.push({
					type: "error",
					text: t("lineError", { line: lineIndex + 1, column: error.span.start.column, message: localizeError(error.message, locale) }, locale),
					errorCode: error.code,
					line: lineIndex + 1,
					column: error.span.start.column,
				});
				continue;
			}
			nextLineResults.push({
				type: "error",
				text: localizeError(error instanceof Error ? error.message : String(error), locale),
			});
		}
	}

	return {
		lines: nextLines,
		lineResults: nextLineResults,
		variableSnapshot: nextSnapshot,
	};
}

function formatNumericWithSi(value: NumericValue): string {
	const decimal = toDecimal(value);
	if (decimal.isZero()) return "0";
	const suffixes: Array<[string, string]> = [["1e12", "T"], ["1e9", "G"], ["1e6", "M"], ["1e3", "k"], ["1e-3", "m"], ["1e-6", "u"], ["1e-9", "n"], ["1e-12", "p"]];
	for (const [factor, suffix] of suffixes) {
		const normalized = decimal.abs().div(factor);
		if (normalized.gte(1) && normalized.lt(1000)) return `${decimal.div(factor).toSignificantDigits(34)}${suffix}`;
	}
	return formatNumeric(value);
}
