export const storageKey = "calcuko-formulas";

export const SI_MAP: Record<string, number> = {
	T: 1e12,
	G: 1e9,
	M: 1e6,
	k: 1e3,
	m: 1e-3,
	u: 1e-6,
	n: 1e-9,
	p: 1e-12,
};

export const mathFunctions: Record<string, string> = {
	abs: "Math.abs(x) — 绝对值",
	acos: "Math.acos(x) — 反余弦",
	asin: "Math.asin(x) — 反正弦",
	atan: "Math.atan(x) — 反正切",
	ceil: "Math.ceil(x) — 向上取整",
	cos: "Math.cos(x) — 余弦",
	exp: "Math.exp(x) — e^x 指数",
	floor: "Math.floor(x) — 向下取整",
	log: "Math.log(x) — 自然对数 ln(x)",
	max: "Math.max(a, b, ...) — 最大值",
	min: "Math.min(a, b, ...) — 最小值",
	pow: "Math.pow(x, y) — x 的 y 次幂",
	round: "Math.round(x) — 四舍五入",
	sin: "Math.sin(x) — 正弦",
	sqrt: "Math.sqrt(x) — 平方根",
	tan: "Math.tan(x) — 正切",
	hex: "hex(n) — 转十六进制 (0xFFFF)",
	bin: "bin(n) — 转二进制 (0b1100 1010)",
	oct: "oct(n) — 转八进制 (0777)",
};

export const mathConstants: Record<string, string> = {
	PI: "π (圆周率 ≈ 3.14159)",
	E: "自然对数的底数 (≈ 2.71828)",
};

export const sampleFormula = `Vo = 13
Vref = 2.5
R1 = 11
R2 = 2.87
R3 = 10

// Unicode 变量名
半径 = 5
π = PI
面积 = π * 半径**2

// Emoji 变量名
😊 = 10
🔥 = 42
快乐 = 😊 * 🔥

// 隐式乘法：数字后直接接变量名
Omega = 2PI*R1 + 3R2

// SI 词缀示例
R = 10k
C = 100n
f = 1/(2PI*R*C)

// 进制字面量：0x十六进制 0b二进制 0八进制
hexVal = 0xFF
binVal = 0b1101
octVal = 0777
sum = hexVal + binVal + octVal

// 进制转换函数：hex() bin() oct()
dec = 255
h = hex(dec)
b = bin(dec)
o = oct(dec)`;
