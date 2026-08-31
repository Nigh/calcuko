import Decimal from "decimal.js";
import { colorBuiltins, isColorValue, type ColorValue } from "./builtins/colors";
import { formatNumeric, isNumericValue, toBigIntExact, toDecimal, type NumericValue, Rational } from "./language/numeric";
import { formatRadixString, formatValue } from "./evaluator";
import { isMatrix } from "./language/matrix";

export type ResultValueKind = "bigint" | "decimal" | "rational" | "color" | "matrix" | "other";
export type ResultFormatName = "default" | "decimal" | "hex" | "binary" | "octal" | "scientific" | "si" | "rgb" | "hsl" | "hsv" | "yuv" | "rgb565" | "hexColor";
export type ResultFormat = { name: ResultFormatName; precision?: number };
export type FormatOption = { name: ResultFormatName; label: string; precisionMode?: "decimalPlaces" | "significantDigits" };

export const resultValueKind = (value: unknown): ResultValueKind => {
	if (typeof value === "bigint") return "bigint";
	if (value instanceof Decimal) return "decimal";
	if (value instanceof Rational) return "rational";
	if (isColorValue(value)) return "color";
	if (isMatrix(value)) return "matrix";
	return "other";
};

const integerOptions: FormatOption[] = [
	{ name: "default", label: "默认" }, { name: "decimal", label: "十进制" }, { name: "hex", label: "十六进制" },
	{ name: "binary", label: "二进制" }, { name: "octal", label: "八进制" },
	{ name: "scientific", label: "科学计数", precisionMode: "significantDigits" }, { name: "si", label: "SI", precisionMode: "significantDigits" },
];
const decimalOptions: FormatOption[] = [
	{ name: "default", label: "默认" }, { name: "decimal", label: "普通小数", precisionMode: "decimalPlaces" },
	{ name: "scientific", label: "科学计数", precisionMode: "significantDigits" }, { name: "si", label: "SI", precisionMode: "significantDigits" },
];
const rationalOptions: FormatOption[] = [
	{ name: "default", label: "默认分数" }, { name: "decimal", label: "普通小数", precisionMode: "decimalPlaces" },
	{ name: "scientific", label: "科学计数", precisionMode: "significantDigits" }, { name: "si", label: "SI", precisionMode: "significantDigits" },
];
const colorOptions: FormatOption[] = [
	{ name: "default", label: "原始色彩空间" }, { name: "rgb", label: "RGB" }, { name: "hsl", label: "HSL" },
	{ name: "hsv", label: "HSV" }, { name: "yuv", label: "YUV" }, { name: "rgb565", label: "RGB565" }, { name: "hexColor", label: "Hex" },
];

export function formatOptions(value: unknown): FormatOption[] {
	if (isColorValue(value)) return colorOptions;
	if (!isNumericValue(value)) return [];
	try { toBigIntExact(value); return integerOptions; } catch { /* not an exact integer */ }
	return value instanceof Rational ? rationalOptions : decimalOptions;
}

const radix = (value: NumericValue, base: 2 | 8 | 16, prefix: string) => {
	const integer = toBigIntExact(value);
	const digits = (integer < 0n ? -integer : integer).toString(base).toUpperCase();
	return (integer < 0n ? "-" : "") + prefix + formatRadixString(digits, 4);
};
const significant = (format: ResultFormat) => format.precision ?? 6;
const decimalPlaces = (format: ResultFormat) => format.precision ?? 4;
const scientific = (value: NumericValue, precision: number) => toDecimal(value).toExponential(Math.max(0, precision - 1));
const si = (value: NumericValue, precision: number) => {
	const decimal = toDecimal(value);
	if (decimal.isZero()) return "0";
	const suffixes: Array<[number, string]> = [[12,"T"],[9,"G"],[6,"M"],[3,"k"],[-3,"m"],[-6,"u"],[-9,"n"],[-12,"p"]];
	for (const [power, suffix] of suffixes) {
		const scaled = decimal.div(new Decimal(10).pow(power));
		if (scaled.abs().gte(1) && scaled.abs().lt(1000)) return `${scaled.toSignificantDigits(precision)}${suffix}`;
	}
	return scientific(value, precision);
};
const colorText = (value: ColorValue, format: ResultFormat): string => {
	if (format.name === "hexColor") return colorBuiltins.toHexColor(value) as string;
	const converted = format.name === "default" ? value : colorBuiltins[`to${format.name[0].toUpperCase()}${format.name.slice(1)}` as "toRgb" | "toHsl" | "toHsv" | "toYuv" | "toRgb565"](value) as ColorValue;
	return `${converted.space}(${converted.channels.map((channel) => channel.toDecimalPlaces(4).toString()).join(", ")})`;
};

export function formatResult(value: unknown, format: ResultFormat = { name: "default" }, hasSi = false): string {
	if (format.name === "default") {
		if (hasSi && isNumericValue(value)) return si(value, 6);
		return formatValue(value);
	}
	if (isColorValue(value)) return colorText(value, format);
	if (!isNumericValue(value)) return formatValue(value);
	if (format.name === "hex") return radix(value, 16, "0x");
	if (format.name === "binary") return radix(value, 2, "0b");
	if (format.name === "octal") return radix(value, 8, "0");
	if (format.name === "decimal") return value instanceof Rational || value instanceof Decimal ? toDecimal(value).toFixed(decimalPlaces(format)) : value.toString();
	if (format.name === "scientific") return scientific(value, significant(format));
	if (format.name === "si") return si(value, significant(format));
	return formatNumeric(value);
}
