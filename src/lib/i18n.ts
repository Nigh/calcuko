export type Locale = "zh-CN" | "en";

export const localeStorageKey = "calcuko-locale";
let activeLocale: Locale = "zh-CN";

export function detectLocale(): Locale {
	if (typeof localStorage !== "undefined") {
		const saved = localStorage.getItem(localeStorageKey);
		if (saved === "zh-CN" || saved === "en") return saved;
	}
	if (typeof navigator !== "undefined" && navigator.languages.some((language) => language.toLowerCase().startsWith("zh"))) return "zh-CN";
	return "en";
}

export function getLocale(): Locale { return activeLocale; }
export function setLocale(locale: Locale, persist = true) {
	activeLocale = locale;
	if (persist && typeof localStorage !== "undefined") localStorage.setItem(localeStorageKey, locale);
	if (typeof document !== "undefined") {
		document.documentElement.lang = locale;
		document.title = t("pageTitle");
		document.querySelector('meta[name="description"]')?.setAttribute("content", t("pageDescription"));
		window.dispatchEvent(new CustomEvent("calcuko-locale-change", { detail: locale }));
	}
}

const messages = {
	"zh-CN": {
		pageTitle: "Calcuko - 多行公式计算器", pageDescription: "支持多行变量赋值、逐行结果实时预览与依赖联动更新的网页计算器。",
		language: "语言", switchLanguage: "切换为 English", tagline: "多行公式计算器", starGitHub: "在 GitHub 点赞", version: "版本", help: "帮助", undo: "撤销", undoTitle: "撤销最近一次载入或清空",
		sample: "示例", sampleTitle: "载入示例公式", clear: "清除", clearTitle: "清空编辑器", editorLabel: "公式编辑器",
		loadConfirm: "载入示例将替换当前内容，是否继续？", clearConfirm: "确定要清空全部公式吗？",
		copied: "已复制: {value}", copyFailed: "复制失败", colorPreview: "颜色预览", variables: "变量快照", noVariables: "暂无变量", copyValue: "点击复制值",
		resultFormat: "结果格式", decimalPlaces: "小数位", significantDigits: "有效位", closeHelp: "关闭帮助", basics: "基本用法",
		helpAssignment: "赋值：使用 {code} 定义变量。", helpEvaluation: "求值：直接输入表达式如 {code}。",
		helpComment: "注释：仅忽略前导空白后以 {line} 开头的整行；表达式中的 {division} 表示整数除法。",
		helpFunctions: "函数：内置 Math 所有常用函数和常量。", helpSi: "词缀：支持 SI 词缀如 {codes}。",
		helpSpaces: "空格：行内空格会被忽略，支持自由格式输入。", helpImplicit: "隐式乘法：{codes} 自动展开。",
		helpRadix: "进制：支持 {hex}（十六进制）{bin}（二进制）{oct}（八进制）。使用 {functions} 转换结果进制。",
		commonFunctions: "常用函数", constants: "常量", gotIt: "知道了",
		offlineReady: "应用已可离线使用。", updateAvailable: "发现新版本", updateDescription: "重新加载即可完成更新。",
		close: "关闭", closeUpdate: "关闭更新提示", reload: "重新加载", reloadUpdate: "重新加载并更新应用",
		lineError: "第 {line} 行，第 {column} 列：{message}", builtinFunction: "内置函数", customFunction: "自定义函数 ({params})", earlierVariable: "上方变量",
		default: "默认", decimal: "十进制", hexadecimal: "十六进制", binary: "二进制", octal: "八进制", scientific: "科学计数",
		plainDecimal: "普通小数", defaultFraction: "默认分数", originalColor: "原始色彩空间",
	},
	en: {
		pageTitle: "Calcuko - Multi-line Formula Calculator", pageDescription: "A web calculator with multi-line variables, live per-line results, and dependency updates.",
		language: "Language", switchLanguage: "切换为中文", tagline: "Multi-line Formula Calculator", starGitHub: "Star on GitHub", version: "Version", help: "Help", undo: "Undo", undoTitle: "Undo the latest sample load or clear",
		sample: "Sample", sampleTitle: "Load sample formulas", clear: "Clear", clearTitle: "Clear editor", editorLabel: "Formula editor",
		loadConfirm: "Loading the sample will replace the current content. Continue?", clearConfirm: "Clear all formulas?",
		copied: "Copied: {value}", copyFailed: "Copy failed", colorPreview: "Color preview", variables: "Variables", noVariables: "No variables", copyValue: "Click to copy value",
		resultFormat: "Result format", decimalPlaces: "Decimal places", significantDigits: "Significant digits", closeHelp: "Close help", basics: "Basics",
		helpAssignment: "Assignment: use {code} to define a variable.", helpEvaluation: "Evaluation: enter an expression such as {code}.",
		helpComment: "Comments: a whole line beginning with {line} after optional whitespace is ignored; {division} inside an expression means integer division.",
		helpFunctions: "Functions: common Math functions and constants are built in.", helpSi: "Prefixes: SI prefixes are supported, such as {codes}.",
		helpSpaces: "Whitespace: spaces within a line are ignored, allowing free-form input.", helpImplicit: "Implicit multiplication: {codes} are expanded automatically.",
		helpRadix: "Radix literals: {hex} (hex), {bin} (binary), and {oct} (octal). Use {functions} to convert result radices.",
		commonFunctions: "Common functions", constants: "Constants", gotIt: "Got it",
		offlineReady: "The app is ready for offline use.", updateAvailable: "Update available", updateDescription: "Reload to finish updating.",
		close: "Close", closeUpdate: "Close update notification", reload: "Reload", reloadUpdate: "Reload and update the app",
		lineError: "Line {line}, column {column}: {message}", builtinFunction: "Built-in function", customFunction: "Custom function ({params})", earlierVariable: "Earlier variable",
		default: "Default", decimal: "Decimal", hexadecimal: "Hexadecimal", binary: "Binary", octal: "Octal", scientific: "Scientific",
		plainDecimal: "Decimal", defaultFraction: "Fraction", originalColor: "Original color space",
	},
} as const;

export type MessageKey = keyof typeof messages["zh-CN"];
export function t(key: MessageKey, params: Record<string, string | number> = {}, locale = activeLocale): string {
	let value: string = messages[locale][key];
	for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
	return value;
}

const functionEnglish: Record<string, string> = {
	abs:"Math.abs(x) — Absolute value",acos:"Math.acos(x) — Arc cosine",asin:"Math.asin(x) — Arc sine",atan:"Math.atan(x) — Arc tangent",ceil:"Math.ceil(x) — Round up",cos:"Math.cos(x) — Cosine",exp:"Math.exp(x) — e raised to x",floor:"Math.floor(x) — Round down",log:"Math.log(x) — Natural logarithm",max:"Math.max(a, b, ...) — Maximum",min:"Math.min(a, b, ...) — Minimum",pow:"Math.pow(x, y) — x raised to y",round:"Math.round(x) — Round to nearest integer",sin:"Math.sin(x) — Sine",sqrt:"Math.sqrt(x) — Square root",tan:"Math.tan(x) — Tangent",
	hex:"hex(n) — Convert to hexadecimal",bin:"bin(n) — Convert to binary",oct:"oct(n) — Convert to octal",bigint:"bigint(x) — Convert to arbitrary-precision integer",decimal:"decimal(x) — Convert to 34-digit decimal",rat:"rat(a, b) — Create an exact fraction",range:"range(start, stop, step?) — Create an end-exclusive range",
	len:"len(array) — Array length",reverse:"reverse(array) — Reverse an array",sum:"sum(values...) — Sum values",ave:"ave(values...) — Arithmetic average",minArray:"minArray(array) — Smallest array value",maxArray:"maxArray(array) — Largest array value",map:"map(array, fn) — Map an array",filter:"filter(array, fn) — Filter an array",aggregate:"aggregate(array, fn) — Reduce an array",sort:"sort(array, fn?) — Sort an array",unique:"unique(array) — Remove duplicates",
	count1:"count1(width, value) — Count set bits",rotateL:"rotateL(width, value, n?) — Rotate bits left",rotateR:"rotateR(width, value, n?) — Rotate bits right",reverseBits:"reverseBits(width, value) — Reverse bit order",reverseBytes:"reverseBytes(width, value) — Reverse byte order",swapNib:"swapNib(width, value) — Swap nibbles",evenParity:"evenParity(width, value) — Calculate even parity",oddParity:"oddParity(width, value) — Calculate odd parity",pack:"pack(bytes, values) — Pack integer values",unpack:"unpack(bytes, count, value) — Unpack integer values",
	matrix:"matrix(rows) — Create a matrix",row:"row(values...) — Create a row matrix",col:"col(values...) — Create a column matrix",det:"det(matrix) — Exact determinant",
	isPrime:"isPrime(n) — Test primality",primeFact:"primeFact(n) — Prime factorization",gcd:"gcd(values...) — Greatest common divisor",lcm:"lcm(values...) — Least common multiple",eccEncode:"eccEncode(width, value) — Hamming SECDED encoding",eccDecode:"eccDecode(width, encoded) — Detect and correct one-bit errors",
	rgb:"rgb(r,g,b) — Create an RGB color",hsl:"hsl(h,s,l) — Create an HSL color",hsv:"hsv(h,s,v) — Create an HSV color",yuv:"yuv(y,u,v) — Create a BT.601 YUV color",hexColor:"hexColor(text) — Parse a Web Hex color",rgb565:"rgb565(value) — Parse 16-bit RGB565",toRgb:"toRgb(color) — Convert to RGB",toHsl:"toHsl(color) — Convert to HSL",toHsv:"toHsv(color) — Convert to HSV",toYuv:"toYuv(color) — Convert to BT.601 YUV",toRgb565:"toRgb565(color) — Convert to RGB565",toHexColor:"toHexColor(color) — Convert to #RRGGBB",
	utf8Enc:"utf8Enc(text) — Encode UTF-8 bytes",utf8Dec:"utf8Dec(bytes) — Strictly decode UTF-8",base64Enc:"base64Enc(text) — Base64-encode text",base64Dec:"base64Dec(text) — Base64-decode text",base64EncBytes:"base64EncBytes(bytes) — Base64-encode bytes",base64DecBytes:"base64DecBytes(text) — Base64-decode bytes",urlEnc:"urlEnc(text) — Percent-encode a URL",urlDec:"urlDec(text) — Percent-decode a URL",
	mean:"mean(values...) — Arithmetic mean",geoMean:"geoMean(values...) — Geometric mean",harMean:"harMean(values...) — Harmonic mean",median:"median(values...) — Median",variance:"variance(values...) — Population variance",std:"std(values...) — Population standard deviation",sampleVariance:"sampleVariance(values...) — Sample variance",sampleStd:"sampleStd(values...) — Sample standard deviation",rand:"rand(min?, max?) — Cryptographic random decimal",randInt:"randInt(min, max) — Random integer in a half-open range",solve:"solve(fn, initial?, max?) — Find a numeric root",
};
export function functionDescription(name: string, chinese: string, locale = activeLocale): string {
	return locale === "en" ? functionEnglish[name] ?? t("builtinFunction", {}, locale) : chinese;
}
export function constantDescription(name: string, chinese: string, locale = activeLocale): string {
	if (locale === "zh-CN") return chinese;
	return name === "PI" ? "π (pi ≈ 3.14159)" : "Base of the natural logarithm (≈ 2.71828)";
}

const errorEnglish: Record<string, string> = {
	"函数参数必须是数值":"Function arguments must be numeric","matrix() 需要二维数组":"matrix() requires a two-dimensional array","det() 需要 Matrix 值":"det() requires a Matrix value",
	"范围步长不能为零":"Range step cannot be zero","递增范围不能使用负步长":"An increasing range cannot use a negative step","递减范围不能使用正步长":"A decreasing range cannot use a positive step","范围参数必须是数值":"Range arguments must be numeric",
	"参数必须是数组":"Argument must be an array","数组元素必须是数值":"Array elements must be numeric","参数必须是函数":"Argument must be a function","空数组没有平均值":"An empty array has no average","空数组不能聚合":"An empty array cannot be reduced","排序函数必须返回数值":"Sort function must return a numeric value",
	"分数的分母不能为零":"Fraction denominator cannot be zero","高精度小数不能无损转换为分数":"A high-precision decimal cannot be converted to a fraction without loss","该分数不是整数":"The fraction is not an integer","该小数不是整数":"The decimal is not an integer",
	"矩阵需要非空的二维数组":"A matrix requires a non-empty two-dimensional array","矩阵元素必须是数值":"Matrix elements must be numeric","矩阵各行长度必须一致":"Matrix rows must have equal lengths","矩阵形状不一致":"Matrix shapes do not match","矩阵运算至少需要一个矩阵":"A matrix operation requires at least one matrix","矩阵乘法维度不匹配":"Matrix multiplication dimensions do not match","只有方阵可以计算行列式":"Only square matrices have determinants","矩阵只能与数值或矩阵运算":"A matrix can only operate with a numeric value or matrix","该操作符不支持矩阵":"This operator does not support matrices",
	"统计函数不接受空集合":"Statistical functions do not accept an empty set","统计值必须是数值":"Statistical values must be numeric","样本方差至少需要两个值":"Sample variance requires at least two values","几何平均不接受负数":"Geometric mean does not accept negative values","调和平均不接受零":"Harmonic mean does not accept zero",
	"随机整数范围必须为正":"Random integer range must be positive","rand 上界必须大于下界":"rand upper bound must exceed the lower bound","randInt 参数必须是整数":"randInt arguments must be integers","randInt 需要有效的半开整数范围":"randInt requires a valid half-open integer range",
	"参数必须是字符串":"Argument must be a string","参数必须是字节数组":"Argument must be a byte array","字节必须在 0–255 范围内":"Bytes must be in the range 0–255","UTF-8 字节序列无效":"Invalid UTF-8 byte sequence","Base64 格式无效":"Invalid Base64 format","Base64 内容不是有效 UTF-8":"Base64 content is not valid UTF-8","URL 百分号编码无效":"Invalid URL percent encoding",
	"参数必须是 Color":"Argument must be a Color","颜色必须是 #RGB 或 #RRGGBB":"Color must be #RGB or #RRGGBB","RGB565 必须在 0–65535 范围内":"RGB565 must be in the range 0–65535",
	"位宽必须是正整数":"Bit width must be a positive integer","字节翻转的位宽必须是 8 的倍数":"Byte-reversal width must be a multiple of 8","半字节交换的位宽必须是 8 的倍数":"Nibble-swap width must be a multiple of 8","pack 需要数组":"pack requires an array",
	"ECC 数据位宽必须在 1–4096 之间":"ECC data width must be between 1 and 4096","ECC 数据超出指定位宽":"ECC data exceeds the specified width","ECC 码字超出预期位宽":"ECC codeword exceeds the expected width",
	"solve 函数必须返回数值":"solve function must return a numeric value","solve 函数返回了非有限值":"solve function returned a non-finite value","solve 第一个参数必须是函数":"The first solve argument must be a function","solve 超出函数求值预算":"solve exceeded its evaluation budget","solve 区间上界必须大于下界":"solve interval upper bound must exceed its lower bound","solve 初值必须是数值":"solve initial value must be numeric","solve 上界必须是数值":"solve upper bound must be numeric",
	"字符串没有结束引号":"String is missing a closing quote","fn 后需要函数名":"fn must be followed by a function name","函数名后需要参数列表":"Function name must be followed by parameters","函数定义缺少等号":"Function definition is missing =","函数定义末尾存在多余内容":"Unexpected content after function definition","解构赋值缺少左方括号":"Destructuring assignment is missing [","解构目标必须是变量名":"Destructuring targets must be variable names","解构赋值缺少右方括号":"Destructuring assignment is missing ]","解构赋值缺少等号":"Destructuring assignment is missing =","解构赋值目标不能重名":"Destructuring targets must be unique","解构赋值末尾存在多余内容":"Unexpected content after destructuring assignment","表达式末尾存在多余内容":"Unexpected content after expression","条件表达式缺少冒号":"Conditional expression is missing :","Lambda 需要参数名":"Lambda requires a parameter name","Lambda 缺少 =>":"Lambda is missing =>","参数必须是标识符":"Parameter must be an identifier","参数列表缺少右括号":"Parameter list is missing )","函数参数不能重名":"Function parameters must be unique","缺少右括号":"Missing )","数组缺少右方括号":"Array is missing ]","此处需要表达式":"Expected an expression","函数调用缺少右括号":"Function call is missing )",
	"此操作需要数值":"This operation requires numeric values","数组形状不一致":"Array shapes do not match","解构赋值右侧必须是数组":"The right side of a destructuring assignment must be an array","该值不能作为函数调用":"This value is not callable",
};
export function localizeError(message: string, locale = activeLocale): string {
	if (locale === "zh-CN") return message;
	if (errorEnglish[message]) return errorEnglish[message];
	const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
		[/^无法识别字符“(.+)”$/, (value) => `Unrecognized character “${value}”`],
		[/^未定义标识符“(.+)”$/, (value) => `Undefined identifier “${value}”`],
		[/^未知一元操作符“(.+)”$/, (value) => `Unknown unary operator “${value}”`],
		[/^未知操作符“(.+)”$/, (value) => `Unknown operator “${value}”`],
		[/^不支持的数值操作符“(.+)”$/, (value) => `Unsupported numeric operator “${value}”`],
		[/^不支持的十进制操作符“(.+)”$/, (value) => `Unsupported decimal operator “${value}”`],
		[/^范围最多生成 (\d+) 个元素$/, (count) => `A range can generate at most ${count} items`],
		[/^函数需要 (\d+) 个参数，实际收到 (\d+) 个$/, (expected, actual) => `Function expects ${expected} arguments, received ${actual}`],
		[/^解构需要 (\d+) 个值，实际收到 (\d+) 个$/, (expected, actual) => `Destructuring expects ${expected} values, received ${actual}`],
		[/^solve 在 (\d+) 次迭代内未收敛$/, (count) => `solve did not converge within ${count} iterations`],
		[/^(.+) 必须在 (.+)–(.+) 范围内$/, (name, min, max) => `${name} must be in the range ${min}–${max}`],
	];
	for (const [pattern, format] of patterns) {
		const match = message.match(pattern);
		if (match) return format(...match.slice(1));
	}
	return message;
}
