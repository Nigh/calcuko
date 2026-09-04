import Decimal from "decimal.js";
import { isNumericValue, toDecimal } from "../language/numeric";
import type { RuntimeValue } from "../language/interpreter";
import { arithmeticBinary, isArithmeticValue, isQuantity, type ArithmeticValue } from "../language/units";

const arithmeticInputs = (args: RuntimeValue[]): ArithmeticValue[] => {
	const values = args.length===1&&Array.isArray(args[0]) ? args[0] : args;
	if(!values.length)throw new Error("统计函数不接受空集合");
	return values.map((value)=>{if(!isArithmeticValue(value))throw new Error("统计值必须是数值或量纲值");return value;});
};
const arithmeticTotal=(values:ArithmeticValue[])=>values.slice(1).reduce((sum,value)=>arithmeticBinary("+",sum,value) as ArithmeticValue,values[0]);
const arithmeticMean=(values:ArithmeticValue[])=>arithmeticBinary("/",arithmeticTotal(values),BigInt(values.length)) as ArithmeticValue;
const arithmeticVariance=(values:ArithmeticValue[],sample:boolean)=>{
	if(sample&&values.length<2)throw new Error("样本方差至少需要两个值");
	const avg=arithmeticMean(values);
	const squares=values.map(value=>{const delta=arithmeticBinary("-",value,avg) as ArithmeticValue;return arithmeticBinary("*",delta,delta) as ArithmeticValue;});
	return arithmeticBinary("/",arithmeticTotal(squares),BigInt(values.length-(sample?1:0))) as ArithmeticValue;
};

export const statisticsBuiltins = {
	sum: (...args:RuntimeValue[])=>arithmeticTotal(arithmeticInputs(args)),
	ave: (...args:RuntimeValue[])=>arithmeticMean(arithmeticInputs(args)),
	mean: (...args:RuntimeValue[])=>arithmeticMean(arithmeticInputs(args)),
	geoMean: (...args:RuntimeValue[])=>{const values=arithmeticInputs(args);if(values.some(x=>toDecimal(isQuantity(x)?x.value:x).isNegative()))throw new Error("几何平均不接受负数");const product=values.slice(1).reduce((p,x)=>arithmeticBinary("*",p,x) as ArithmeticValue,values[0]);return arithmeticBinary("**",product,new Decimal(1).div(values.length)) as ArithmeticValue;},
	harMean: (...args:RuntimeValue[])=>{const values=arithmeticInputs(args);if(values.some(x=>toDecimal(isQuantity(x)?x.value:x).isZero()))throw new Error("调和平均不接受零");const inverses=values.map(x=>arithmeticBinary("/",1n,x) as ArithmeticValue);return arithmeticBinary("/",BigInt(values.length),arithmeticTotal(inverses)) as ArithmeticValue;},
	median: (...args:RuntimeValue[])=>{const v=arithmeticInputs(args).sort((a,b)=>arithmeticBinary("<",a,b)?-1:arithmeticBinary(">",a,b)?1:0),m=Math.floor(v.length/2);return v.length%2?v[m]:arithmeticBinary("/",arithmeticBinary("+",v[m-1],v[m]) as ArithmeticValue,2n);},
	variance: (...args:RuntimeValue[])=>arithmeticVariance(arithmeticInputs(args),false),
	std: (...args:RuntimeValue[])=>arithmeticBinary("**",arithmeticVariance(arithmeticInputs(args),false),new Decimal("0.5")),
	sampleVariance: (...args:RuntimeValue[])=>arithmeticVariance(arithmeticInputs(args),true),
	sampleStd: (...args:RuntimeValue[])=>arithmeticBinary("**",arithmeticVariance(arithmeticInputs(args),true),new Decimal("0.5")),
	minArray: (...args:RuntimeValue[])=>arithmeticInputs(args).reduce((a,b)=>arithmeticBinary("<",a,b)?a:b),
	maxArray: (...args:RuntimeValue[])=>arithmeticInputs(args).reduce((a,b)=>arithmeticBinary(">",a,b)?a:b),
};

const randomBytes=(length:number)=>{const result=new Uint8Array(length);crypto.getRandomValues(result);return result;};
const randomBigIntBelow=(limit:bigint):bigint=>{if(limit<=0n)throw new Error("随机整数范围必须为正");const bits=limit.toString(2).length,bytes=Math.ceil(bits/8),mask=(1n<<BigInt(bits))-1n;while(true){let value=0n;for(const byte of randomBytes(bytes))value=(value<<8n)|BigInt(byte);value&=mask;if(value<limit)return value;}};
export const randomBuiltins = {
	rand: (minValue:unknown=0n,maxValue:unknown=1n)=>{if(!isArithmeticValue(minValue)||!isArithmeticValue(maxValue))throw new Error("rand 参数必须是数值或量纲值");if(!arithmeticBinary("<",minValue,maxValue))throw new Error("rand 上界必须大于下界");const bytes=randomBytes(7);let value=0n;for(const byte of bytes)value=(value<<8n)|BigInt(byte);const unit=new Decimal(value.toString()).div((1n<<56n).toString());return arithmeticBinary("+",minValue,arithmeticBinary("*",arithmeticBinary("-",maxValue,minValue) as ArithmeticValue,unit) as ArithmeticValue);},
	randInt: (minValue:unknown,maxValue:unknown)=>{if(!isNumericValue(minValue)||!isNumericValue(maxValue))throw new Error("randInt 参数必须是整数");const min=BigInt(toDecimal(minValue).toFixed(0)),max=BigInt(toDecimal(maxValue).toFixed(0));if(!toDecimal(minValue).isInteger()||!toDecimal(maxValue).isInteger()||max<=min)throw new Error("randInt 需要有效的半开整数范围");return min+randomBigIntBelow(max-min);},
};
