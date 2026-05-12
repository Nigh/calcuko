import type { LineResult } from "./types";
import { SI_MAP } from "./constants";

// 展开进制字面量：0x→十六进制，0b→二进制，0→八进制
export function expandRadixLiterals(expr: string): string {
	// 先替换 0x（十六进制）
	expr = expr.replace(/0x([0-9a-fA-F]+)/g, (_m, digits) => String(parseInt(digits, 16)));
	// 再替换 0b（二进制）
	expr = expr.replace(/0b([01]+)/g, (_m, digits) => String(parseInt(digits, 2)));
	// 最后替换 0（八进制），谨慎匹配：前导0且后跟至少一位[0-7]，但排除单独0和0紧跟小数点
	expr = expr.replace(/(?<!\d)0([0-7]+)/g, (_m, digits) => String(parseInt(digits, 8)));
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
export function toHex(n: number): string {
	if (!Number.isFinite(n)) return String(n);
	const int = Math.round(n);
	const hexStr = (int >>> 0).toString(16).toUpperCase();
	return "0x" + formatRadixString(hexStr, 4);
}

export function toBin(n: number): string {
	if (!Number.isFinite(n)) return String(n);
	const int = Math.round(n);
	// 使用无符号右移处理负数
	const binStr = (int >>> 0).toString(2);
	return "0b" + formatRadixString(binStr, 4);
}

export function toOct(n: number): string {
	if (!Number.isFinite(n)) return String(n);
	const int = Math.round(n);
	const octStr = (int >>> 0).toString(8);
	return "0" + formatRadixString(octStr, 4);
}

export function formatValue(value: unknown): string {
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

export const mathContext: Record<string, unknown> = {
	abs: Math.abs,
	acos: Math.acos,
	asin: Math.asin,
	atan: Math.atan,
	ceil: Math.ceil,
	cos: Math.cos,
	exp: Math.exp,
	floor: Math.floor,
	log: Math.log,
	max: Math.max,
	min: Math.min,
	pow: Math.pow,
	round: Math.round,
	sin: Math.sin,
	sqrt: Math.sqrt,
	tan: Math.tan,
	PI: Math.PI,
	E: Math.E,
	hex: toHex,
	bin: toBin,
	oct: toOct,
};

export function evaluateSource(input: string): { lines: string[]; lineResults: LineResult[]; variableSnapshot: Record<string, unknown> } {
	const normalized = input.replace(/\r\n?/g, "\n");
	const nextLines = normalized.split("\n");
	const scope: Record<string, unknown> = { ...mathContext };
	const nextLineResults: LineResult[] = [];
	const nextSnapshot: Record<string, unknown> = {};

	for (const rawLine of nextLines) {
		let line = rawLine.trim();

		if (!line || line.startsWith("//")) {
			nextLineResults.push({ type: "empty", text: "" });
			continue;
		}

		// 分离行内注释
		const commentIdx = line.indexOf("//");
		if (commentIdx !== -1) {
			line = line.slice(0, commentIdx).trim();
		}

		if (!line) {
			nextLineResults.push({ type: "empty", text: "" });
			continue;
		}

		// 忽略行内空格
		line = line.replace(/\s+/g, "");

		// 展开进制字面量：0xFF, 0b1010, 077 → 十进制数字
		line = expandRadixLiterals(line);

		// 展开 SI 词缀（传入 scope 以检查已知变量名）
		const { expanded, hasSi } = expandSiSuffixes(line, scope);

		const assignmentMatch = expanded.match(/^((?:[\p{ID_Start}$]|\p{Extended_Pictographic})(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})*)=(.+)$/u);

		let name: string | undefined;
		let expression: string;

		if (assignmentMatch) {
			[, name, expression] = assignmentMatch;
		} else {
			expression = expanded;
		}

		// 处理 emoji 变量名，替换为 scope["name"] 语法
		expression = prepareExpression(expression);

		try {
			const evaluator = new Function(
				"scope",
				`with (scope) { return (${expression}); }`,
			) as (scope: Record<string, unknown>) => unknown;

			const value = evaluator(scope);
			if (name) {
				scope[name] = value;
				nextSnapshot[name] = value;
				const displayValue = hasSi && typeof value === "number" ? formatValueWithSi(value) : formatValue(value);
				nextLineResults.push({ 
					type: "success", 
					text: `${name} = ${displayValue}`,
					varName: name
				});
			} else {
				const displayValue = hasSi && typeof value === "number" ? formatValueWithSi(value) : formatValue(value);
				nextLineResults.push({ 
					type: "success", 
					text: displayValue,
				});
			}
		} catch (error) {
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
