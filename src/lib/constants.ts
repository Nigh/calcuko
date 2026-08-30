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
	bigint: "bigint(x) — 转任意精度整数",
	decimal: "decimal(x) — 转 34 位高精度小数",
	rat: "rat(a, b) — 构造精确分数 a$b",
	range: "range(start, stop, step?) — 生成不含终点的数值范围",
	sum: "sum(array) — 数组求和",
	ave: "ave(array) — 数组平均值",
	map: "map(array, fn) — 映射数组",
	filter: "filter(array, fn) — 过滤数组",
	sort: "sort(array, fn?) — 排序数组",
	unique: "unique(array) — 数组去重",
	matrix: "matrix(rows) — 从二维数组构造矩阵",
	det: "det(matrix) — 精确计算方阵行列式",
	isPrime: "isPrime(n) — 判断 BigInt 是否为素数",
	primeFact: "primeFact(n) — 质因数分解",
	gcd: "gcd(values...) — 最大公约数",
	lcm: "lcm(values...) — 最小公倍数",
	eccEncode: "eccEncode(width, value) — Hamming SECDED 编码",
	eccDecode: "eccDecode(width, encoded) — 检测并纠正单比特错误",
	rgb: "rgb(r,g,b) — 构造 RGB 颜色",
	hsl: "hsl(h,s,l) — 构造 HSL 颜色",
	hsv: "hsv(h,s,v) — 构造 HSV 颜色",
	yuv: "yuv(y,u,v) — 构造 BT.601 YUV 颜色",
	hexColor: "hexColor(text) — 解析 Web Hex 颜色",
	rgb565: "rgb565(value) — 解析 16 位 RGB565",
	toRgb: "toRgb(color) — 转 RGB",
	toHsl: "toHsl(color) — 转 HSL",
	toHsv: "toHsv(color) — 转 HSV",
	toYuv: "toYuv(color) — 转 BT.601 YUV",
	toRgb565: "toRgb565(color) — 转 RGB565",
	toHexColor: "toHexColor(color) — 转 #RRGGBB",
	utf8Enc: "utf8Enc(text) — UTF-8 字节编码",
	utf8Dec: "utf8Dec(bytes) — 严格 UTF-8 解码",
	base64Enc: "base64Enc(text) — Base64 编码文本",
	base64Dec: "base64Dec(text) — Base64 解码文本",
	base64EncBytes: "base64EncBytes(bytes) — Base64 编码字节",
	base64DecBytes: "base64DecBytes(text) — Base64 解码字节",
	urlEnc: "urlEnc(text) — URL 百分号编码",
	urlDec: "urlDec(text) — URL 百分号解码",
	mean: "mean(values...) — 算术平均值",
	geoMean: "geoMean(values...) — 几何平均值",
	harMean: "harMean(values...) — 调和平均值",
	median: "median(values...) — 中位数",
	variance: "variance(values...) — 总体方差",
	std: "std(values...) — 总体标准差",
	sampleVariance: "sampleVariance(values...) — 样本方差",
	sampleStd: "sampleStd(values...) — 样本标准差",
	rand: "rand(min?, max?) — Web Crypto 随机小数",
	randInt: "randInt(min, max) — 半开区间随机整数",
	solve: "solve(fn, initial?, max?) — Newton-Raphson 数值求根",
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
