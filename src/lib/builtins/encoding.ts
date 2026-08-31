import { toBigIntExact, type NumericValue } from "../language/numeric";
import type { RuntimeValue } from "../language/interpreter";

const text = (value: unknown) => { if (typeof value !== "string") throw new Error("参数必须是字符串"); return value; };
const bytes = (value: unknown): Uint8Array => {
	if (!Array.isArray(value)) throw new Error("参数必须是字节数组");
	return Uint8Array.from((value as RuntimeValue[]).map((item) => { const byte=toBigIntExact(item as NumericValue); if(byte<0n||byte>255n)throw new Error("字节必须在 0–255 范围内"); return Number(byte); }));
};
const byteArray = (value: Uint8Array) => Array.from(value, BigInt);
const bytesToBase64 = (value: Uint8Array) => { let binary=""; for(const byte of value)binary+=String.fromCharCode(byte); return btoa(binary); };
const base64ToBytes = (value: string): Uint8Array => {
	if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Base64 格式无效");
	try { return Uint8Array.from(atob(value), (char)=>char.charCodeAt(0)); } catch { throw new Error("Base64 格式无效"); }
};

export const encodingBuiltins = {
	utf8Enc: (value: unknown) => byteArray(new TextEncoder().encode(text(value))),
	utf8Dec: (value: unknown) => { try { return new TextDecoder("utf-8",{fatal:true}).decode(bytes(value)); } catch { throw new Error("UTF-8 字节序列无效"); } },
	base64Enc: (value: unknown) => bytesToBase64(new TextEncoder().encode(text(value))),
	base64EncBytes: (value: unknown) => bytesToBase64(bytes(value)),
	base64Dec: (value: unknown) => { try { return new TextDecoder("utf-8",{fatal:true}).decode(base64ToBytes(text(value))); } catch(error) { if(error instanceof Error && error.message.includes("Base64"))throw error; throw new Error("Base64 内容不是有效 UTF-8"); } },
	base64DecBytes: (value: unknown) => byteArray(base64ToBytes(text(value))),
	urlEnc: (value: unknown) => encodeURIComponent(text(value)),
	urlDec: (value: unknown) => { try { return decodeURIComponent(text(value)); } catch { throw new Error("URL 百分号编码无效"); } },
};
