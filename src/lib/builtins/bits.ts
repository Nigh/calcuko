import { toBigIntExact, type NumericValue } from "../language/numeric";
import type { RuntimeValue } from "../language/interpreter";

const integer = (value: unknown) => toBigIntExact(value as NumericValue);
const widthArg = (value: unknown): bigint => { const width = integer(value); if (width <= 0n) throw new Error("位宽必须是正整数"); return width; };
const mask = (width: bigint) => (1n << width) - 1n;
const normalize = (width: bigint, value: bigint) => value & mask(width);
const shiftArg = (value: unknown, width: bigint) => { const shift = integer(value); return ((shift % width) + width) % width; };

export const bitBuiltins = {
	count1: (widthValue: unknown, value: unknown) => {
		let bits = normalize(widthArg(widthValue), integer(value)); let count = 0n;
		while (bits) { count += bits & 1n; bits >>= 1n; } return count;
	},
	rotateL: (widthValue: unknown, value: unknown, amount: unknown = 1n) => {
		const width = widthArg(widthValue), shift = shiftArg(amount, width), bits = normalize(width, integer(value));
		return normalize(width, (bits << shift) | (bits >> (width - shift)));
	},
	rotateR: (widthValue: unknown, value: unknown, amount: unknown = 1n) => {
		const width = widthArg(widthValue), shift = shiftArg(amount, width), bits = normalize(width, integer(value));
		return normalize(width, (bits >> shift) | (bits << (width - shift)));
	},
	reverseBits: (widthValue: unknown, value: unknown) => {
		const width = widthArg(widthValue); let source = normalize(width, integer(value)), result = 0n;
		for (let i = 0n; i < width; i++) { result = (result << 1n) | (source & 1n); source >>= 1n; } return result;
	},
	reverseBytes: (widthValue: unknown, value: unknown) => {
		const width = widthArg(widthValue); if (width % 8n) throw new Error("字节翻转的位宽必须是 8 的倍数");
		let result = 0n, source = normalize(width, integer(value)); for (let i = 0n; i < width / 8n; i++) { result = (result << 8n) | (source & 255n); source >>= 8n; } return result;
	},
	swapNib: (widthValue: unknown, value: unknown) => {
		const width = widthArg(widthValue); if (width % 8n) throw new Error("半字节交换的位宽必须是 8 的倍数");
		const bits = normalize(width, integer(value)); return ((bits & 0x0f0f0f0f0f0f0f0fn) << 4n | (bits & 0xf0f0f0f0f0f0f0f0n) >> 4n) & mask(width);
	},
	evenParity: (widthValue: unknown, value: unknown) => (bitBuiltins.count1(widthValue, value) as bigint) & 1n,
	oddParity: (widthValue: unknown, value: unknown) => 1n ^ ((bitBuiltins.count1(widthValue, value) as bigint) & 1n),
	pack: (byteWidthValue: unknown, values: RuntimeValue) => {
		const byteWidth = widthArg(byteWidthValue); if (!Array.isArray(values)) throw new Error("pack 需要数组");
		return values.reduce((result: bigint, value) => (result << byteWidth) | normalize(byteWidth, integer(value)), 0n);
	},
	unpack: (byteWidthValue: unknown, countValue: unknown, value: unknown) => {
		const byteWidth = widthArg(byteWidthValue), count = widthArg(countValue), values: bigint[] = []; let source = integer(value);
		for (let i = 0n; i < count; i++) { values.unshift(normalize(byteWidth, source)); source >>= byteWidth; } return values;
	},
};
