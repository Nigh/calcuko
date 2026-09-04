import Decimal from "decimal.js";
import { Rational, formatNumeric, isNumericValue, numericBinary, toDecimal, type NumericValue } from "./numeric";

export type Dimension = Readonly<Record<string, number>>;
const EPSILON = 1e-12;

const normalizeDimension = (input: Record<string, number>): Dimension => Object.freeze(Object.fromEntries(
	Object.entries(input).filter(([, exponent]) => Math.abs(exponent) > EPSILON).sort(([a], [b]) => a.localeCompare(b)),
));
const combineDimension = (left: Dimension, right: Dimension, sign = 1): Dimension => {
	const result: Record<string, number> = { ...left };
	for (const [name, exponent] of Object.entries(right)) result[name] = (result[name] ?? 0) + sign * exponent;
	return normalizeDimension(result);
};
export const sameDimension = (left: Dimension, right: Dimension) => {
	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	return [...keys].every((key) => Math.abs((left[key] ?? 0) - (right[key] ?? 0)) <= EPSILON);
};
export const SCALAR_DIMENSION = normalizeDimension({});

export class UnitValue {
	readonly kind = "unit";
	constructor(
		readonly symbol: string,
		readonly dimension: Dimension,
		readonly factor: Decimal,
		readonly offset = new Decimal(0),
	) {}
}

export class Quantity {
	readonly kind = "quantity";
	constructor(
		readonly value: NumericValue,
		readonly dimension: Dimension,
		readonly displayUnit?: UnitValue,
		readonly hints: ReadonlySet<string> = new Set(displayUnit ? [displayUnit.symbol] : []),
	) {}
}

export const isUnitValue = (value: unknown): value is UnitValue => value instanceof UnitValue;
export const isQuantity = (value: unknown): value is Quantity => value instanceof Quantity;
export type ArithmeticValue = NumericValue | Quantity;
export const isArithmeticValue = (value: unknown): value is ArithmeticValue => isNumericValue(value) || isQuantity(value);
export const isScalarQuantity = (value: Quantity) => sameDimension(value.dimension, SCALAR_DIMENSION);

const units = new Map<string, UnitValue>();
const canonicalUnits: UnitValue[] = [];
const d = (values: Record<string, number>) => normalizeDimension(values);
const L=d({L:1}), M=d({M:1}), TIME=d({T:1}), I=d({I:1}), TEMP=d({Th:1}), AMOUNT=d({N:1}), LIGHT=d({J:1}), ANGLE=d({A:1}), DATA=d({D:1});
const factor = (value: string | number) => new Decimal(value);

function add(symbol: string, dimension: Dimension, scale: string | number, aliases: string[] = [], offset?: string | number) {
	const unit = new UnitValue(symbol, dimension, factor(scale), factor(offset ?? 0));
	canonicalUnits.push(unit);
	for (const name of [symbol, ...aliases]) units.set(name, unit);
	return unit;
}
const metricPrefixes: Array<[string,string]> = [["p","1e-12"],["n","1e-9"],["u","1e-6"],["c","1e-2"],["m","1e-3"],["k","1e3"],["M","1e6"],["G","1e9"],["T","1e12"]];
function addMetric(symbol: string, dimension: Dimension, scale: string | number, aliases: string[] = []) {
	const base = add(symbol, dimension, scale, aliases);
	for (const [prefix, multiplier] of metricPrefixes) {
		if (prefix + symbol === symbol || units.has(prefix + symbol)) continue;
		add(prefix + symbol, dimension, base.factor.mul(multiplier).toString());
	}
	return base;
}

// SI base and commonly used derived units. Mass is canonicalized to kilograms.
addMetric("m", L, 1, ["meter","meters","metre","metres"]);
addMetric("s", TIME, 1, ["second","seconds","sec"]);
addMetric("g", M, "1e-3", ["gram","grams","gramme","grammes"]);
addMetric("A", I, 1, ["ampere","amperes"]);
add("K", TEMP, 1, ["kelvin","kelvins"]);
addMetric("mol", AMOUNT, 1, ["mole","moles"]);
addMetric("cd", LIGHT, 1, ["candela"]);
add("rad", ANGLE, 1, ["radian","radians"]);
addMetric("Hz", d({T:-1}), 1, ["hertz"]);
addMetric("N", d({M:1,L:1,T:-2}), 1, ["newton","newtons"]);
addMetric("Pa", d({M:1,L:-1,T:-2}), 1, ["pascal","pascals"]);
addMetric("J", d({M:1,L:2,T:-2}), 1, ["joule","joules"]);
addMetric("W", d({M:1,L:2,T:-3}), 1, ["watt","watts"]);
addMetric("C", d({I:1,T:1}), 1, ["coulomb","coulombs"]);
addMetric("V", d({M:1,L:2,T:-3,I:-1}), 1, ["volt","volts"]);
addMetric("F", d({M:-1,L:-2,T:4,I:2}), 1, ["farad","farads"]);
addMetric("ohm", d({M:1,L:2,T:-3,I:-2}), 1, ["ohms","Ω","Ω"]);
addMetric("S", d({M:-1,L:-2,T:3,I:2}), 1, ["siemens"]);
addMetric("Wb", d({M:1,L:2,T:-2,I:-1}), 1, ["weber","webers"]);
addMetric("T", d({M:1,T:-2,I:-1}), 1, ["tesla","teslas"]);
addMetric("H", d({M:1,L:2,T:-2,I:-2}), 1, ["henry","henries"]);
addMetric("lm", LIGHT, 1, ["lumen","lumens"]);
addMetric("lx", d({J:1,L:-2}), 1, ["lux"]);
addMetric("Bq", d({T:-1}), 1, ["becquerel"]);
addMetric("Gy", d({L:2,T:-2}), 1, ["gray"]);
addMetric("Sv", d({L:2,T:-2}), 1, ["sievert"]);
addMetric("kat", d({N:1,T:-1}), 1, ["katal"]);

add("min", TIME, 60, ["minute","minutes"]); add("h", TIME, 3600, ["hour","hours","hr"]);
add("day", TIME, 86400, ["days","d"]); add("week", TIME, 604800, ["weeks"]); add("year", TIME, "31557600", ["years","yr"]);
addMetric("L", d({L:3}), "1e-3", ["liter","liters","litre","litres"]);
add("ha", d({L:2}), 10000, ["hectare","hectares"]); add("acre", d({L:2}), "4046.8564224", ["acres"]);
add("in", L, "0.0254", ["inch","inches"]); add("ft", L, "0.3048", ["foot","feet"]);
add("yd", L, "0.9144", ["yard","yards"]); add("mi", L, "1609.344", ["mile","miles"]);
add("nmi", L, 1852, ["nautical_mile","nautical_miles","NM"]);
add("gal", d({L:3}), "0.003785411784", ["gallon","gallons"]); add("qt", d({L:3}), "0.000946352946", ["quart"]);
add("pt", d({L:3}), "0.000473176473", ["pint"]); add("cup", d({L:3}), "0.0002365882365", ["cups"]);
add("tbsp", d({L:3}), "0.00001478676478125", ["tablespoon"]); add("tsp", d({L:3}), "0.00000492892159375", ["teaspoon"]);
add("lb", M, "0.45359237", ["lbs","pound","pounds"]); add("oz", M, "0.028349523125", ["ounce","ounces"]);
add("tonne", M, 1000, ["ton","metricton"]); add("Da", M, "1.66053906892e-27", ["dalton"]);
add("lbf", d({M:1,L:1,T:-2}), "4.4482216152605", ["pound_force"]);
add("bar", d({M:1,L:-1,T:-2}), 100000, ["bars"]); add("atm", d({M:1,L:-1,T:-2}), 101325, ["atmosphere"]);
add("torr", d({M:1,L:-1,T:-2}), new Decimal(101325).div(760).toString()); add("psi", d({M:1,L:-1,T:-2}), "6894.757293168");
add("cal", d({M:1,L:2,T:-2}), "4.184", ["calorie"]); add("BTU", d({M:1,L:2,T:-2}), "1055.05585262", ["Btu"]);
addMetric("eV", d({M:1,L:2,T:-2}), "1.602176634e-19", ["electronvolt"]); addMetric("Wh", d({M:1,L:2,T:-2}), 3600, ["watthour"]);
add("hp", d({M:1,L:2,T:-3}), "735.49875", ["horsepower"]);
add("deg", ANGLE, Decimal.acos(-1).div(180).toString(), ["degree","degrees"]); add("rev", ANGLE, Decimal.acos(-1).mul(2).toString(), ["revolution","turn"]);
add("degC", TEMP, 1, ["celsius","degree_celsius"], "273.15");
add("degF", TEMP, new Decimal(5).div(9).toString(), ["fahrenheit","degree_fahrenheit"], new Decimal("459.67").mul(5).div(9).toString());
add("mph", d({L:1,T:-1}), "0.44704"); add("knot", d({L:1,T:-1}), new Decimal(1852).div(3600).toString(), ["knots"]);
add("au", L, "149597870700", ["AU","astronomicalunit"]); add("ly", L, "9460730472580800", ["lightyear"]);
add("pc", L, "30856775814913673", ["parsec"]); add("angstrom", L, "1e-10", ["Å","Å"]); add("bohr", L, "5.29177210903e-11");
add("hartree", d({M:1,L:2,T:-2}), "4.3597447222071e-18");
addMetric("bit", DATA, 1, ["bits"]); const byte = addMetric("B", DATA, 8, ["byte","bytes","octet"]);
for (const [prefix, power] of [["Ki",10],["Mi",20],["Gi",30],["Ti",40]] as const) add(prefix+"B", DATA, byte.factor.mul(new Decimal(2).pow(power)).toString());

export const unitContext = (): Record<string, UnitValue> => Object.fromEntries(units);
export const unitNames = (): string[] => [...units.keys()].sort((a,b)=>a.localeCompare(b));
export const isKnownUnitName = (name: string): boolean => units.has(name);

const SUPERSCRIPTS: Record<string,string> = { "0":"⁰", "1":"¹", "2":"²", "3":"³", "4":"⁴", "5":"⁵", "6":"⁶", "7":"⁷", "8":"⁸", "9":"⁹", "-":"⁻" };
const superscriptNumber = (value: string) => [...value].map((character)=>SUPERSCRIPTS[character] ?? character).join("");
export const formatUnitSymbol = (symbol: string): string => {
	if (symbol === "m^2") return "㎡";
	if (symbol === "m^3") return "㎥";
	return symbol.replace(/\^(-?\d+)/g, (_, exponent: string) => superscriptNumber(exponent));
};

const unitFrom = (value: UnitValue) => new Quantity(value.factor.add(value.offset), value.dimension, value);
const asQuantity = (value: NumericValue | Quantity | UnitValue): Quantity => {
	if (isQuantity(value)) return value;
	if (isUnitValue(value)) return unitFrom(value);
	return new Quantity(value, SCALAR_DIMENSION);
};
const numericExponent = (value: NumericValue): number => {
	if (value instanceof Rational) return Number(value.numerator) / Number(value.denominator);
	const decimal = toDecimal(value); const number = decimal.toNumber();
	if (!Number.isFinite(number)) throw new Error("量纲指数必须是有限数值");
	return number;
};
const hints = (left: Quantity, right: Quantity) => new Set([...left.hints, ...right.hints]);

export function quantityBinary(operator: string, leftValue: NumericValue | Quantity | UnitValue, rightValue: NumericValue | Quantity | UnitValue): NumericValue | Quantity | UnitValue | boolean {
	if (operator === "->") {
		if (!isUnitValue(rightValue)) throw new Error("换算目标必须是单位表达式");
		const left = asQuantity(leftValue);
		if (!sameDimension(left.dimension, rightValue.dimension)) throw new Error("换算目标与原值量纲不一致");
		return new Quantity(left.value, left.dimension, rightValue, new Set([rightValue.symbol]));
	}
	if (isUnitValue(leftValue) && isUnitValue(rightValue) && ["*","/","**"].includes(operator)) {
		if (operator === "**") throw new Error("单位幂的指数必须是无量纲数值");
		if (leftValue.offset.isZero() && rightValue.offset.isZero()) return new UnitValue(
			operator === "*" ? `${leftValue.symbol}·${rightValue.symbol}` : `${leftValue.symbol}/${rightValue.symbol}`,
			combineDimension(leftValue.dimension, rightValue.dimension, operator === "*" ? 1 : -1),
			operator === "*" ? leftValue.factor.mul(rightValue.factor) : leftValue.factor.div(rightValue.factor),
		);
	}
	if (operator === "**" && isUnitValue(leftValue) && isNumericValue(rightValue)) {
		if (!leftValue.offset.isZero()) throw new Error("偏移温标不能用于复合单位");
		const exponent = numericExponent(rightValue);
		return new UnitValue(`${leftValue.symbol}^${formatNumeric(rightValue)}`, normalizeDimension(Object.fromEntries(Object.entries(leftValue.dimension).map(([k,v])=>[k,v*exponent]))), leftValue.factor.pow(toDecimal(rightValue)));
	}
	if (operator === "*" && isNumericValue(leftValue) && isUnitValue(rightValue)) {
		const value = toDecimal(leftValue).mul(rightValue.factor);
		return new Quantity(rightValue.offset.isZero() ? value : value.add(rightValue.offset), rightValue.dimension, rightValue);
	}
	if (operator === "*" && isUnitValue(leftValue) && isNumericValue(rightValue)) {
		const value = toDecimal(rightValue).mul(leftValue.factor);
		return new Quantity(leftValue.offset.isZero() ? value : value.add(leftValue.offset), leftValue.dimension, leftValue);
	}
	const left = asQuantity(leftValue), right = asQuantity(rightValue);
	if (["+","-",">",">=","<","<=","==","!="].includes(operator)) {
		if (!sameDimension(left.dimension, right.dimension)) throw new Error("操作数的量纲不一致");
		const result = numericBinary(operator, left.value, right.value);
		if (typeof result === "boolean") return result;
		const temperatureDifference = operator === "-" && left.displayUnit && right.displayUnit && !left.displayUnit.offset.isZero() && !right.displayUnit.offset.isZero();
		return new Quantity(result, left.dimension, temperatureDifference ? units.get("K") : left.displayUnit ?? right.displayUnit, hints(left,right));
	}
	if (operator === "*" || operator === "/") {
		const result = numericBinary(operator, left.value, right.value) as NumericValue;
		const dimension=combineDimension(left.dimension, right.dimension, operator === "*" ? 1 : -1);
		const leftUnit=left.displayUnit, rightUnit=right.displayUnit;
		let displayUnit: UnitValue | undefined;
		if (operator === "*" && isScalarQuantity(left)) displayUnit=rightUnit;
		else if (isScalarQuantity(right)) displayUnit=leftUnit;
		else if (leftUnit&&rightUnit&&leftUnit.offset.isZero()&&rightUnit.offset.isZero()) displayUnit=new UnitValue(
			operator === "*"?`${leftUnit.symbol}·${rightUnit.symbol}`:`${leftUnit.symbol}/${rightUnit.symbol}`,
			dimension,
			operator === "*"?leftUnit.factor.mul(rightUnit.factor):leftUnit.factor.div(rightUnit.factor),
		);
		return new Quantity(result, dimension, displayUnit, hints(left,right));
	}
	if (operator === "**") {
		if (!isScalarQuantity(right) || !isNumericValue(right.value)) throw new Error("幂指数必须无量纲");
		const exponent = numericExponent(right.value);
		const result = numericBinary("**", left.value, right.value) as NumericValue;
		const dimension=normalizeDimension(Object.fromEntries(Object.entries(left.dimension).map(([k,v])=>[k,v*exponent])));
		const displayUnit=left.displayUnit&&left.displayUnit.offset.isZero()
			? new UnitValue(`${left.displayUnit.symbol}^${formatNumeric(right.value)}`,dimension,left.displayUnit.factor.pow(toDecimal(right.value)))
			: undefined;
		return new Quantity(result, dimension, displayUnit, left.hints);
	}
	throw new Error("该操作符不支持量纲值");
}
export const arithmeticBinary = (operator: string, left: ArithmeticValue, right: ArithmeticValue): ArithmeticValue | boolean =>
	isQuantity(left) || isQuantity(right) ? quantityBinary(operator, left, right) as ArithmeticValue | boolean : numericBinary(operator, left, right);

const bestUnit = (quantity: Quantity): UnitValue | undefined => {
	const candidates = canonicalUnits.filter((unit) => unit.offset.isZero() && sameDimension(unit.dimension, quantity.dimension));
	const hinted = candidates.filter((unit) => quantity.hints.has(unit.symbol));
	if (hinted.length) return hinted.map((unit)=>({unit,magnitude:toDecimal(quantity.value).div(unit.factor).abs()})).sort((a,b)=>Number(b.magnitude.gte(1)&&b.magnitude.lt(1000))-Number(a.magnitude.gte(1)&&a.magnitude.lt(1000)))[0].unit;
	if (quantity.displayUnit) {
		const named=candidates.find((unit)=>unit.factor.eq(quantity.displayUnit!.factor));
		return named ?? quantity.displayUnit;
	}
	const pool = hinted.length ? hinted : candidates;
	if (!pool.length) return undefined;
	return pool.map((unit) => ({ unit, magnitude: toDecimal(quantity.value).div(unit.factor).abs() }))
		.sort((a,b) => {
			if (!hinted.length) { const aSi=a.unit.factor.eq(1), bSi=b.unit.factor.eq(1); if(aSi!==bSi)return aSi?-1:1; }
			const aGood=a.magnitude.gte(1)&&a.magnitude.lt(1000), bGood=b.magnitude.gte(1)&&b.magnitude.lt(1000);
			if(aGood!==bGood)return aGood?-1:1;
			return Math.abs(a.magnitude.plus(1).logarithm().toNumber())-Math.abs(b.magnitude.plus(1).logarithm().toNumber());
		})[0]?.unit;
};
export const quantityMagnitude = (quantity: Quantity, target = bestUnit(quantity)): NumericValue => {
	if (!target) return quantity.value;
	const result=toDecimal(quantity.value).sub(target.offset).div(target.factor);
	const nearest=result.toDecimalPlaces(0); return result.sub(nearest).abs().lt("1e-14") ? nearest : result;
};
const superscript = (value: number) => Math.abs(value-1)<EPSILON ? "" : `^${Number.isInteger(value)?value:Number(value.toFixed(8))}`;
export const formatDimension = (dimension: Dimension) => {
	if (sameDimension(dimension,SCALAR_DIMENSION)) return "";
	const positive=Object.entries(dimension).filter(([,v])=>v>0).map(([k,v])=>`${k}${superscript(v)}`);
	const negative=Object.entries(dimension).filter(([,v])=>v<0).map(([k,v])=>`${k}${superscript(-v)}`);
	return `${positive.join("·")||"1"}${negative.length?`/${negative.join("·")}`:""}`;
};
const formatReadableNumeric = (value: NumericValue) => value instanceof Decimal ? value.toSignificantDigits(15).toString() : formatNumeric(value);
export function formatQuantity(quantity: Quantity, format: (value: NumericValue)=>string = formatReadableNumeric): string {
	const target=bestUnit(quantity); const magnitude=quantityMagnitude(quantity,target);
	return `${format(magnitude)}${target?` ${formatUnitSymbol(target.symbol)}`:formatDimension(quantity.dimension)?` ${formatUnitSymbol(formatDimension(quantity.dimension))}`:""}`;
}
