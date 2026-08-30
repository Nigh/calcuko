import Decimal from "decimal.js";
import { isNumericValue, toDecimal, type NumericValue } from "../language/numeric";
import type { RuntimeValue } from "../language/interpreter";

const inputs = (args: RuntimeValue[]): NumericValue[] => {
	const values = args.length===1&&Array.isArray(args[0]) ? args[0] : args;
	if(!values.length)throw new Error("统计函数不接受空集合");
	return values.map((value)=>{if(!isNumericValue(value))throw new Error("统计值必须是数值");return value;});
};
const decimals=(args:RuntimeValue[])=>inputs(args).map(toDecimal);
const total=(values:Decimal[])=>values.reduce((sum,value)=>sum.add(value),new Decimal(0));
const mean=(values:Decimal[])=>total(values).div(values.length);
const variance=(values:Decimal[],sample:boolean)=>{if(sample&&values.length<2)throw new Error("样本方差至少需要两个值");const avg=mean(values);return values.reduce((sum,value)=>sum.add(value.sub(avg).pow(2)),new Decimal(0)).div(values.length-(sample?1:0));};

export const statisticsBuiltins = {
	sum: (...args:RuntimeValue[])=>total(decimals(args)),
	ave: (...args:RuntimeValue[])=>mean(decimals(args)),
	mean: (...args:RuntimeValue[])=>mean(decimals(args)),
	geoMean: (...args:RuntimeValue[])=>{const values=decimals(args);if(values.some(x=>x.isNegative()))throw new Error("几何平均不接受负数");return values.reduce((p,x)=>p.mul(x),new Decimal(1)).pow(new Decimal(1).div(values.length));},
	harMean: (...args:RuntimeValue[])=>{const values=decimals(args);if(values.some(x=>x.isZero()))throw new Error("调和平均不接受零");return new Decimal(values.length).div(values.reduce((s,x)=>s.add(new Decimal(1).div(x)),new Decimal(0)));},
	median: (...args:RuntimeValue[])=>{const v=decimals(args).sort((a,b)=>a.comparedTo(b)),m=Math.floor(v.length/2);return v.length%2?v[m]:v[m-1].add(v[m]).div(2);},
	variance: (...args:RuntimeValue[])=>variance(decimals(args),false),
	std: (...args:RuntimeValue[])=>variance(decimals(args),false).sqrt(),
	sampleVariance: (...args:RuntimeValue[])=>variance(decimals(args),true),
	sampleStd: (...args:RuntimeValue[])=>variance(decimals(args),true).sqrt(),
	minArray: (...args:RuntimeValue[])=>decimals(args).reduce((a,b)=>Decimal.min(a,b)),
	maxArray: (...args:RuntimeValue[])=>decimals(args).reduce((a,b)=>Decimal.max(a,b)),
};

const randomBytes=(length:number)=>{const result=new Uint8Array(length);crypto.getRandomValues(result);return result;};
const randomBigIntBelow=(limit:bigint):bigint=>{if(limit<=0n)throw new Error("随机整数范围必须为正");const bits=limit.toString(2).length,bytes=Math.ceil(bits/8),mask=(1n<<BigInt(bits))-1n;while(true){let value=0n;for(const byte of randomBytes(bytes))value=(value<<8n)|BigInt(byte);value&=mask;if(value<limit)return value;}};
export const randomBuiltins = {
	rand: (minValue:unknown=0n,maxValue:unknown=1n)=>{const min=toDecimal(minValue as NumericValue),max=toDecimal(maxValue as NumericValue);if(max.lte(min))throw new Error("rand 上界必须大于下界");const bytes=randomBytes(7);let value=0n;for(const byte of bytes)value=(value<<8n)|BigInt(byte);const unit=new Decimal(value.toString()).div((1n<<56n).toString());return min.add(max.sub(min).mul(unit));},
	randInt: (minValue:unknown,maxValue:unknown)=>{if(!isNumericValue(minValue)||!isNumericValue(maxValue))throw new Error("randInt 参数必须是整数");const min=BigInt(toDecimal(minValue).toFixed(0)),max=BigInt(toDecimal(maxValue).toFixed(0));if(!toDecimal(minValue).isInteger()||!toDecimal(maxValue).isInteger()||max<=min)throw new Error("randInt 需要有效的半开整数范围");return min+randomBigIntBelow(max-min);},
};
