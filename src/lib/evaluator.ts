import type { LineResult } from "./types";
import { SI_MAP } from "./constants";
import { evaluateStatement, isRuntimeRecord, isUserFunction, type RuntimeScope } from "./language/interpreter";
import { parse } from "./language/parser";
import { LanguageError } from "./language/token";
import Decimal from "decimal.js";
import { Rational, decimalFromNumber, formatNumeric, isNumericValue, numericToNumber, toBigIntExact, toDecimal, type NumericValue } from "./language/numeric";
import { asNumeric, createRange } from "./language/ranges";
import { arrayBuiltins } from "./language/arrays";
import { Matrix, determinant, isMatrix } from "./language/matrix";
import { bitBuiltins } from "./builtins/bits";
import { numberTheoryBuiltins } from "./builtins/numberTheory";
import { eccBuiltins } from "./builtins/ecc";
import { colorBuiltins, isColorValue } from "./builtins/colors";
import { encodingBuiltins } from "./builtins/encoding";

// 展开进制字面量：0x→十六进制，0b→二进制，0→八进制
export function expandRadixLiterals(expr: string): string {
	// 先替换 0x（十六进制）
	expr = expr.replace(/0x([0-9a-fA-F]+)/g, (_m, digits) => String(parseInt(digits, 16)));
	// 再替换 0b（二进制）
	expr = expr.replace(/0b([01]+)/g, (_m, digits) => String(parseInt(digits, 2)));
	// 最后替换 0（八进制）：前导 0 + [0-7]+，排除小数部分（如 0.00001 中的 00001）
	expr = expr.replace(/(?<!\d)(?<!\.)0([0-7]+)/g, (_m, digits) => String(parseInt(digits, 8)));
	return expr;
}

// 若标识符含 emoji，用 scope["name"] 包装（JS 解析器不支持 emoji 标识符）
export function wrapIdent(ident: string): string {
	if (/\p{Extended_Pictographic}/u.test(ident)) {
		const escaped = ident.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return `scope["${escaped}"]`;
	}
	return ident;
}

export function expandSiSuffixes(expr: string, scope: Record<string, unknown>): { expanded: string; hasSi: boolean } {
	let hasSi = false;
	// 按词缀长度降序排列，长词缀优先匹配
	const siEntries = Object.entries(SI_MAP).sort((a, b) => b[0].length - a[0].length);

	const expanded = expr.replace(
		/(\d*\.?\d+)((?:[\p{ID_Start}$]|\p{Extended_Pictographic})(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})*)/gu,
		(_match, num: string, ident: string) => {
			// Stage 1: 完整标识符为已知变量/常量 → 隐式乘法
			if (ident in scope) {
				return `(${num}*${wrapIdent(ident)})`;
			}

			// Stage 2: 检查是否为 SI 词缀(+后续变量)
			for (const [siSuffix, factor] of siEntries) {
				if (ident.startsWith(siSuffix)) {
					const rest = ident.slice(siSuffix.length);
					if (rest === '') {
						// 纯 SI 词缀: 10k → (10*1000)
						hasSi = true;
						return `(${num}*${factor})`;
					} else if (/^(?:[\p{ID_Start}$]|\p{Extended_Pictographic})(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})*$/u.test(rest)) {
						// SI 词缀 + 变量: 10kOhm → (10*0.001*Ohm)
						hasSi = true;
						return `(${num}*${factor}*${wrapIdent(rest)})`;
					}
				}
			}

			// Stage 3: 兜底隐式乘法（eval 时若 ident 不存在会报 ReferenceError）
			return `(${num}*${wrapIdent(ident)})`;
		},
	);
	return { expanded, hasSi };
}

export function formatValueWithSi(value: number): string {
	if (value === 0) return "0";
	const absValue = Math.abs(value);
	const suffixes: [number, string][] = [
		[1e12, "T"],
		[1e9, "G"],
		[1e6, "M"],
		[1e3, "k"],
		[1e-3, "m"],
		[1e-6, "u"],
		[1e-9, "n"],
		[1e-12, "p"],
	];

	for (const [threshold, suffix] of suffixes) {
		const normalized = absValue / threshold;
		if (normalized >= 1 && normalized < 1000) {
			const roundedStr = (value / threshold).toFixed(4);
			const rounded = Number(roundedStr);
			// 回环校验：如果取整后的值无法还原原值，说明精度丢失，回退到标准格式
			if (Math.abs(rounded * threshold - value) > 1e-9 * Math.max(1, value)) {
				return formatValue(value);
			}
			return `${Number(roundedStr)}${suffix}`;
		}
	}

	return formatValue(value);
}

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
export function prepareExpression(expr: string): string {
	return expr.replace(
		/(?:[\p{ID_Start}$]|\p{Extended_Pictographic})(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})*/gu,
		(match) => {
			// 若包含 emoji，用 scope["name"] 替代（JS 解析器不支持 emoji 标识符）
			if (/\p{Extended_Pictographic}/u.test(match)) {
				const escaped = match.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
				return `scope["${escaped}"]`;
			}
			return match;
		},
	);
}

const numericArg = (value: unknown): NumericValue => {
	if (typeof value === "bigint" || value instanceof Decimal || value instanceof Rational) return value;
	throw new Error("函数参数必须是数值");
};
const unaryMath = (fn: (value: number) => number) => (value: unknown) => decimalFromNumber(fn(numericToNumber(numericArg(value))));
const variadicMath = (fn: (...values: number[]) => number) => (...values: unknown[]) => decimalFromNumber(fn(...values.map((value) => numericToNumber(numericArg(value)))));
const convertBigInt = (value: unknown) => typeof value === "string" ? BigInt(value) : toBigIntExact(numericArg(value));
const convertDecimal = (value: unknown) => typeof value === "string" ? new Decimal(value) : toDecimal(numericArg(value));

export const mathContext: RuntimeScope = {
	abs: (value: unknown) => {
		const numeric = numericArg(value);
		if (typeof numeric === "bigint") return numeric < 0n ? -numeric : numeric;
		if (numeric instanceof Rational) return new Rational(numeric.numerator < 0n ? -numeric.numerator : numeric.numerator, numeric.denominator);
		return numeric.abs();
	},
	acos: unaryMath(Math.acos),
	asin: unaryMath(Math.asin),
	atan: unaryMath(Math.atan),
	ceil: (value: unknown) => BigInt(new Decimal(formatNumeric(numericArg(value))).ceil().toFixed(0)),
	cos: unaryMath(Math.cos),
	exp: unaryMath(Math.exp),
	floor: (value: unknown) => BigInt(new Decimal(formatNumeric(numericArg(value))).floor().toFixed(0)),
	log: unaryMath(Math.log),
	max: variadicMath(Math.max),
	min: variadicMath(Math.min),
	pow: (left: unknown, right: unknown) => new Decimal(formatNumeric(numericArg(left))).pow(new Decimal(formatNumeric(numericArg(right)))),
	round: (value: unknown) => BigInt(new Decimal(formatNumeric(numericArg(value))).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toFixed(0)),
	sin: unaryMath(Math.sin),
	sqrt: (value: unknown) => new Decimal(formatNumeric(numericArg(value))).sqrt(),
	tan: unaryMath(Math.tan),
	PI: new Decimal("3.141592653589793238462643383279503"),
	E: new Decimal("2.718281828459045235360287471352662"),
	bigint: convertBigInt,
	decimal: convertDecimal,
	rat: (numerator: unknown, denominator: unknown = 1n) => new Rational(convertBigInt(numerator), convertBigInt(denominator)),
	range: (start: unknown, stop: unknown, step?: unknown) => createRange(asNumeric(start), asNumeric(stop), step === undefined ? undefined : asNumeric(step)),
	...arrayBuiltins,
	matrix: (rows: unknown) => {
		if (!Array.isArray(rows)) throw new Error("matrix() 需要二维数组");
		return new Matrix(rows);
	},
	det: (value: unknown) => {
		if (!isMatrix(value)) throw new Error("det() 需要 Matrix 值");
		return determinant(value);
	},
	...bitBuiltins,
	...numberTheoryBuiltins,
	...eccBuiltins,
	...colorBuiltins,
	...encodingBuiltins,
	hex: toHex,
	bin: toBin,
	oct: toOct,
};

export function evaluateSource(input: string): { lines: string[]; lineResults: LineResult[]; variableSnapshot: Record<string, unknown> } {
	const normalized = input.replace(/\r\n?/g, "\n");
	const nextLines = normalized.split("\n");
	const scope: RuntimeScope = { ...mathContext };
	const nextLineResults: LineResult[] = [];
	const nextSnapshot: Record<string, unknown> = {};

	for (const [lineIndex, rawLine] of nextLines.entries()) {
		if (!rawLine.trim() || rawLine.trimStart().startsWith("//")) {
			nextLineResults.push({ type: "empty", text: "" });
			continue;
		}
		try {
			const { value, name, names, hasSi } = evaluateStatement(parse(rawLine), scope);
			if (names) {
				for (const assignedName of names) nextSnapshot[assignedName] = scope[assignedName];
				nextLineResults.push({ type: "success", text: `[${names.join(", ")}] = ${formatValue(value)}` });
				continue;
			}
			if (name) {
				nextSnapshot[name] = value;
				const displayValue = hasSi && isNumericValue(value) ? formatNumericWithSi(value) : formatValue(value);
				nextLineResults.push({ 
					type: "success", 
					text: `${name} = ${displayValue}`,
					varName: name,
					preview: isColorValue(value) ? { type: "color", css: value.css } : undefined,
				});
			} else if (value !== null) {
				const displayValue = hasSi && isNumericValue(value) ? formatNumericWithSi(value) : formatValue(value);
				nextLineResults.push({ 
					type: "success", 
					text: displayValue,
					preview: isColorValue(value) ? { type: "color", css: value.css } : undefined,
				});
			}
		} catch (error) {
			if (error instanceof LanguageError) {
				nextLineResults.push({
					type: "error",
					text: `第 ${lineIndex + 1} 行，第 ${error.span.start.column} 列：${error.message}`,
					errorCode: error.code,
					line: lineIndex + 1,
					column: error.span.start.column,
				});
				continue;
			}
			nextLineResults.push({
				type: "error",
				text: error instanceof Error ? error.message : String(error),
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

// ponytail: dev-only self-check; upgrade path → test runner when project adds one
if (import.meta.env?.DEV) {
	const chk = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`evaluator: ${msg}`);
	};
	chk(expandRadixLiterals("0.00001") === "0.00001", "preserve decimal fraction zeros");
	chk(expandRadixLiterals("0.077") === "0.077", "do not octal-parse fractional part");
	chk(expandRadixLiterals("077") === "63", "octal literal still works");
}
