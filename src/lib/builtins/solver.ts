import Decimal from "decimal.js";
import { invokeUserFunction, isUserFunction, type RuntimeValue } from "../language/interpreter";
import { isNumericValue, toDecimal, type NumericValue } from "../language/numeric";
import { Quantity, isQuantity, sameDimension } from "../language/units";

const MAX_ITERATIONS=100, MAX_EVALUATIONS=25_000;
const TOLERANCE=new Decimal("1e-28"), RESIDUAL_TOLERANCE=new Decimal("1e-14"), ROOT_MERGE=new Decimal("1e-12"), DERIVATIVE_STEP=new Decimal("1e-8"), MIN_DERIVATIVE=new Decimal("1e-30");
const numeric=(value:unknown):Decimal=>{if(!isNumericValue(value))throw new Error("solve 函数必须返回数值");const result=toDecimal(value);if(!result.isFinite())throw new Error("solve 函数返回了非有限值");return result;};
const callable=(fn:RuntimeValue,args:RuntimeValue[])=>{if(isUserFunction(fn))return invokeUserFunction(fn,args);if(typeof fn==="function")return fn(...args);throw new Error("solve 第一个参数必须是函数");};

export function solveRoots(fn:RuntimeValue, initial?:NumericValue, maximum?:NumericValue): Decimal[] {
	let evaluations=0;
	const evaluate=(x:Decimal)=>{if(++evaluations>MAX_EVALUATIONS)throw new Error("solve 超出函数求值预算");return numeric(callable(fn,[x]));};
	let seeds:Decimal[], strict=false, bounds:readonly [Decimal,Decimal]|undefined;
	if(initial!==undefined&&maximum!==undefined){const min=toDecimal(initial),max=toDecimal(maximum);if(max.lte(min))throw new Error("solve 区间上界必须大于下界");bounds=[min,max];const step=max.sub(min).div(100);seeds=Array.from({length:101},(_,i)=>min.add(step.mul(i)));}
	else if(initial!==undefined){seeds=[toDecimal(initial)];strict=true;}
	else seeds=[-100,-10,-1,0,1,10,100].map(x=>new Decimal(x));
	const roots:Decimal[]=[];
	for(const seed of seeds){let x=seed,root:Decimal|undefined;
		try{for(let iteration=0;iteration<MAX_ITERATIONS;iteration++){const fx=evaluate(x);if(fx.abs().lte(RESIDUAL_TOLERANCE)){root=x;break;}const derivative=evaluate(x.add(DERIVATIVE_STEP)).sub(evaluate(x.sub(DERIVATIVE_STEP))).div(DERIVATIVE_STEP.mul(2));if(derivative.abs().lte(MIN_DERIVATIVE))break;const next=x.sub(fx.div(derivative));if(next.sub(x).abs().lte(TOLERANCE)){if(evaluate(next).abs().lte(RESIDUAL_TOLERANCE))root=next;break;}x=next;}}
		catch(error){if(strict)throw error;continue;}
		if(root&&bounds&&(root.lt(bounds[0])||root.gt(bounds[1])))root=undefined;
		if(root&&root.isFinite()&&!roots.some(existing=>existing.sub(root!).abs().lte(ROOT_MERGE)))roots.push(root.toSignificantDigits(34));
	}
	if(strict&&!roots.length)throw new Error(`solve 在 ${MAX_ITERATIONS} 次迭代内未收敛`);
	return roots.sort((a,b)=>a.comparedTo(b));
}

export const solverBuiltins={solve:(fn:RuntimeValue,initial?:RuntimeValue,maximum?:RuntimeValue)=>{
	if(isQuantity(initial)){
		if(maximum!==undefined&&(!isQuantity(maximum)||!sameDimension(initial.dimension,maximum.dimension)))throw new Error("solve 区间端点的量纲必须一致");
		const adapter=(x:RuntimeValue)=>{if(!isNumericValue(x))throw new Error("solve 内部参数无效");const result=callable(fn,[new Quantity(x,initial.dimension,initial.displayUnit,initial.hints)]);if(!isQuantity(result))throw new Error("量纲 solve 函数必须返回量纲值");return result.value;};
		return solveRoots(adapter,initial.value,isQuantity(maximum)?maximum.value:undefined).map(root=>new Quantity(root,initial.dimension,initial.displayUnit,initial.hints));
	}
	if(initial!==undefined&&!isNumericValue(initial))throw new Error("solve 初值必须是数值");if(maximum!==undefined&&!isNumericValue(maximum))throw new Error("solve 上界必须是数值");
	return solveRoots(fn,initial as NumericValue|undefined,maximum as NumericValue|undefined);
}};
