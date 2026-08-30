import Decimal from "decimal.js";
import { numericToNumber, toBigIntExact, type NumericValue } from "../language/numeric";

export type ColorSpace = "rgb" | "hsl" | "hsv" | "yuv" | "rgb565";
export class ColorValue {
	constructor(public readonly space: ColorSpace, public readonly channels: readonly Decimal[], public readonly rgb: readonly [number, number, number], public readonly alpha = 1) {}
	get css(): string { return `rgba(${this.rgb.map((value) => Math.round(value)).join(", ")}, ${this.alpha})`; }
}
export const isColorValue = (value: unknown): value is ColorValue => value instanceof ColorValue;
const n = (value: unknown) => numericToNumber(value as NumericValue);
const bounded = (name: string, value: number, min: number, max: number) => { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 必须在 ${min}–${max} 范围内`); return value; };
const d = (...values: number[]) => values.map((value) => new Decimal(value));
const color = (space: ColorSpace, channels: number[], rgb: [number, number, number], alpha = 1) => new ColorValue(space, d(...channels), rgb, alpha);
const requireColor = (value: unknown) => { if (!isColorValue(value)) throw new Error("参数必须是 Color"); return value; };

function hsvRgb(h: number, s: number, v: number): [number, number, number] {
	const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
	const base = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
	return base.map((value) => (value + m) * 255) as [number, number, number];
}
function rgbHsv([r0,g0,b0]: readonly number[]): [number, number, number] {
	const r=r0/255,g=g0/255,b=b0/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
	let h=delta===0?0:max===r?60*(((g-b)/delta)%6):max===g?60*((b-r)/delta+2):60*((r-g)/delta+4); if(h<0)h+=360;
	return [h,max===0?0:delta/max,max];
}
function rgbHsl(rgb: readonly number[]): [number, number, number] {
	const [h,,] = rgbHsv(rgb), values=rgb.map((x)=>x/255), max=Math.max(...values), min=Math.min(...values), l=(max+min)/2, delta=max-min;
	return [h,delta===0?0:delta/(1-Math.abs(2*l-1)),l];
}
const fromRgb = (space: ColorSpace, rgb: [number,number,number]): ColorValue => {
	if(space==="rgb") return color(space,rgb,rgb);
	if(space==="hsv"){const [h,s,v]=rgbHsv(rgb);return color(space,[h,s*100,v*100],rgb);}
	if(space==="hsl"){const [h,s,l]=rgbHsl(rgb);return color(space,[h,s*100,l*100],rgb);}
	if(space==="yuv"){const [r,g,b]=rgb;return color(space,[.299*r+.587*g+.114*b,-.168736*r-.331264*g+.5*b+128,.5*r-.418688*g-.081312*b+128],rgb);}
	const packed=((Math.round(rgb[0]*31/255)<<11)|(Math.round(rgb[1]*63/255)<<5)|Math.round(rgb[2]*31/255)); return color(space,[packed],rgb);
};

export const colorBuiltins = {
	rgb: (r:unknown,g:unknown,b:unknown) => { const values:[number,number,number]=[bounded("R",n(r),0,255),bounded("G",n(g),0,255),bounded("B",n(b),0,255)]; return fromRgb("rgb",values); },
	hsv: (h:unknown,s:unknown,v:unknown) => { const hv=bounded("H",n(h),0,360),sv=bounded("S",n(s),0,100),vv=bounded("V",n(v),0,100); return color("hsv",[hv,sv,vv],hsvRgb(hv%360,sv/100,vv/100)); },
	hsl: (h:unknown,s:unknown,l:unknown) => { const hv=bounded("H",n(h),0,360),sv=bounded("S",n(s),0,100),lv=bounded("L",n(l),0,100); const c=(1-Math.abs(2*lv/100-1))*sv/100; const rgb=hsvRgb(hv%360,c/(lv/100+c/2||1),lv/100+c/2); return color("hsl",[hv,sv,lv],rgb); },
	yuv: (y:unknown,u:unknown,v:unknown) => { const Y=bounded("Y",n(y),0,255),U=bounded("U",n(u),0,255)-128,V=bounded("V",n(v),0,255)-128; const clamp=(x:number)=>Math.max(0,Math.min(255,x)); return color("yuv",[Y,U+128,V+128],[clamp(Y+1.402*V),clamp(Y-.344136*U-.714136*V),clamp(Y+1.772*U)]); },
	hexColor: (text:unknown) => { if(typeof text!=="string"||!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) throw new Error("颜色必须是 #RGB 或 #RRGGBB"); const hex=text.length===4?text.slice(1).split("").map(x=>x+x).join(""):text.slice(1); return fromRgb("rgb",[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number]); },
	rgb565: (value:unknown) => { const packed=toBigIntExact(value as NumericValue); if(packed<0n||packed>65535n)throw new Error("RGB565 必须在 0–65535 范围内"); const x=Number(packed); return color("rgb565",[x],[((x>>11)&31)*255/31,((x>>5)&63)*255/63,(x&31)*255/31]); },
	toRgb: (value:unknown) => fromRgb("rgb",[...requireColor(value).rgb] as [number,number,number]),
	toHsl: (value:unknown) => fromRgb("hsl",[...requireColor(value).rgb] as [number,number,number]),
	toHsv: (value:unknown) => fromRgb("hsv",[...requireColor(value).rgb] as [number,number,number]),
	toYuv: (value:unknown) => fromRgb("yuv",[...requireColor(value).rgb] as [number,number,number]),
	toRgb565: (value:unknown) => fromRgb("rgb565",[...requireColor(value).rgb] as [number,number,number]),
	toHexColor: (value:unknown) => `#${requireColor(value).rgb.map(x=>Math.round(x).toString(16).padStart(2,"0")).join("").toUpperCase()}`,
};
