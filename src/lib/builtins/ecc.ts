import { RuntimeRecord } from "../language/interpreter";
import { toBigIntExact, type NumericValue } from "../language/numeric";

const integer = (value: unknown) => toBigIntExact(value as NumericValue);
const dataWidth = (value: unknown): number => {
	const width = integer(value);
	if (width <= 0n || width > 4096n) throw new Error("ECC 数据位宽必须在 1–4096 之间");
	return Number(width);
};
const parityWidth = (width: number): number => { let parity = 0; while (2 ** parity < width + parity + 1) parity++; return parity; };
const popcount = (value: bigint): bigint => { let count = 0n; while (value) { count ^= value & 1n; value >>= 1n; } return count; };

export function eccEncode(widthValue: unknown, dataValue: unknown): bigint {
	const width = dataWidth(widthValue), parity = parityWidth(width), hammingLength = width + parity;
	const data = integer(dataValue);
	if (data < 0n || data >= (1n << BigInt(width))) throw new Error("ECC 数据超出指定位宽");
	let encoded = 0n, dataIndex = 0n;
	for (let position = 1; position <= hammingLength; position++) {
		if ((position & (position - 1)) === 0) continue;
		if ((data >> dataIndex) & 1n) encoded |= 1n << BigInt(position - 1);
		dataIndex++;
	}
	for (let parityPosition = 1; parityPosition <= hammingLength; parityPosition <<= 1) {
		let bit = 0n;
		for (let position = 1; position <= hammingLength; position++) if (position & parityPosition) bit ^= (encoded >> BigInt(position - 1)) & 1n;
		if (bit) encoded |= 1n << BigInt(parityPosition - 1);
	}
	if (popcount(encoded)) encoded |= 1n << BigInt(hammingLength);
	return encoded;
}

export function eccDecode(widthValue: unknown, encodedValue: unknown): RuntimeRecord {
	const width = dataWidth(widthValue), parity = parityWidth(width), hammingLength = width + parity, totalLength = hammingLength + 1;
	let encoded = integer(encodedValue);
	if (encoded < 0n || encoded >= (1n << BigInt(totalLength))) throw new Error("ECC 码字超出预期位宽");
	let syndrome = 0;
	for (let parityPosition = 1; parityPosition <= hammingLength; parityPosition <<= 1) {
		let bit = 0n;
		for (let position = 1; position <= hammingLength; position++) if (position & parityPosition) bit ^= (encoded >> BigInt(position - 1)) & 1n;
		if (bit) syndrome |= parityPosition;
	}
	const overallMismatch = popcount(encoded) === 1n;
	let status = "clean", errorBit = 0n;
	if (syndrome && overallMismatch && syndrome <= hammingLength) {
		encoded ^= 1n << BigInt(syndrome - 1); status = "corrected"; errorBit = BigInt(syndrome);
	} else if (!syndrome && overallMismatch) {
		encoded ^= 1n << BigInt(hammingLength); status = "corrected"; errorBit = BigInt(totalLength);
	} else if (syndrome) status = "double-error";
	let data = 0n, dataIndex = 0n;
	for (let position = 1; position <= hammingLength; position++) {
		if ((position & (position - 1)) === 0) continue;
		if ((encoded >> BigInt(position - 1)) & 1n) data |= 1n << dataIndex;
		dataIndex++;
	}
	return new RuntimeRecord({ data, status, errorBit, corrected: encoded });
}

export const eccBuiltins = { eccEncode, eccDecode };
