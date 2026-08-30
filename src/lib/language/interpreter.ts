import type { Expression, Statement } from "./ast";
import { LanguageError, type SourceSpan } from "./token";

export type RuntimeValue = number | string | boolean | RuntimeValue[] | BuiltinFunction | null;
// Built-ins are adapted at the registry boundary; permissive parameters allow
// native Math functions while call results are still validated by the runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BuiltinFunction = (...args: any[]) => RuntimeValue;
export type RuntimeScope = Record<string, RuntimeValue>;

const SI_FACTORS: Record<string, number> = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 };

const runtimeError = (code: string, message: string, span: SourceSpan): never => {
	throw new LanguageError(code, message, span);
};

export function parseLegacyNumber(raw: string): number {
	const compact = raw.replaceAll("_", "");
	const suffix = compact.at(-1) ?? "";
	const factor = SI_FACTORS[suffix];
	const numeric = factor ? compact.slice(0, -1) : compact;
	let value: number;
	if (/^0x/i.test(numeric)) value = Number.parseInt(numeric.slice(2), 16);
	else if (/^0b/i.test(numeric)) value = Number.parseInt(numeric.slice(2), 2);
	else if (/^0[0-7]+$/.test(numeric)) value = Number.parseInt(numeric.slice(1), 8);
	else value = Number(numeric);
	return value * (factor ?? 1);
}

export function evaluateStatement(statement: Statement, scope: RuntimeScope): { value: RuntimeValue; name?: string; hasSi: boolean } {
	if (statement.kind === "empty") return { value: null, hasSi: false };
	if (statement.kind === "assignment") {
		const value = evaluateExpression(statement.value, scope);
		scope[statement.name] = value;
		return { value, name: statement.name, hasSi: expressionHasSi(statement.value) };
	}
	return { value: evaluateExpression(statement.expression, scope), hasSi: expressionHasSi(statement.expression) };
}

export function evaluateExpression(expression: Expression, scope: RuntimeScope): RuntimeValue {
	switch (expression.kind) {
		case "number": return parseLegacyNumber(expression.raw);
		case "string": return expression.value;
		case "identifier":
			if (!(expression.name in scope)) return runtimeError("UNKNOWN_IDENTIFIER", `未定义标识符“${expression.name}”`, expression.span);
			return scope[expression.name];
		case "array": return expression.elements.map((element) => evaluateExpression(element, scope));
		case "unary": {
			const operand = evaluateExpression(expression.operand, scope);
			if (expression.operator === "!") return !truthy(operand);
			const number = requireNumber(operand, expression.span);
			if (expression.operator === "+") return number;
			if (expression.operator === "-") return -number;
			if (expression.operator === "~") return ~number;
			return runtimeError("UNKNOWN_OPERATOR", `未知一元操作符“${expression.operator}”`, expression.span);
		}
		case "binary": {
			if (expression.operator === "&&") return truthy(evaluateExpression(expression.left, scope)) && truthy(evaluateExpression(expression.right, scope));
			if (expression.operator === "||") return truthy(evaluateExpression(expression.left, scope)) || truthy(evaluateExpression(expression.right, scope));
			const left = evaluateExpression(expression.left, scope);
			const right = evaluateExpression(expression.right, scope);
			if (expression.operator === "+" && (typeof left === "string" || typeof right === "string")) return String(left) + String(right);
			if (["==", "!="].includes(expression.operator)) return expression.operator === "==" ? left === right : left !== right;
			const a = requireNumber(left, expression.left.span);
			const b = requireNumber(right, expression.right.span);
			switch (expression.operator) {
				case "+": return a + b; case "-": return a - b; case "*": return a * b;
				case "/": if (b === 0) return runtimeError("DIVISION_BY_ZERO", "不能除以零", expression.right.span); return a / b;
				case "//": if (b === 0) return runtimeError("DIVISION_BY_ZERO", "不能除以零", expression.right.span); return Math.trunc(a / b);
				case "%": return a % b; case "**": return a ** b;
				case ">": return a > b; case ">=": return a >= b; case "<": return a < b; case "<=": return a <= b;
				case "&": return a & b; case "|": return a | b; case "^": return a ^ b; case "<<": return a << b; case ">>": return a >> b;
				default: return runtimeError("UNKNOWN_OPERATOR", `未知操作符“${expression.operator}”`, expression.span);
			}
		}
		case "conditional": return truthy(evaluateExpression(expression.condition, scope))
			? evaluateExpression(expression.whenTrue, scope) : evaluateExpression(expression.whenFalse, scope);
		case "call": {
			const callee = evaluateExpression(expression.callee, scope);
			if (typeof callee !== "function") return runtimeError("NOT_CALLABLE", "该值不能作为函数调用", expression.callee.span);
			try { return callee(...expression.args.map((arg) => evaluateExpression(arg, scope))); }
			catch (error) { return runtimeError("FUNCTION_ERROR", error instanceof Error ? error.message : String(error), expression.span); }
		}
	}
}

function requireNumber(value: RuntimeValue, span: SourceSpan): number {
	if (typeof value !== "number") return runtimeError("EXPECTED_NUMBER", "此操作需要数值", span);
	return value;
}
function truthy(value: RuntimeValue): boolean { return Boolean(value); }
function expressionHasSi(expression: Expression): boolean {
	if (expression.kind === "number") return /[TGMkmunp]$/.test(expression.raw);
	if (expression.kind === "unary") return expressionHasSi(expression.operand);
	if (expression.kind === "binary") return expressionHasSi(expression.left) || expressionHasSi(expression.right);
	if (expression.kind === "conditional") return expressionHasSi(expression.condition) || expressionHasSi(expression.whenTrue) || expressionHasSi(expression.whenFalse);
	if (expression.kind === "call") return expressionHasSi(expression.callee) || expression.args.some(expressionHasSi);
	if (expression.kind === "array") return expression.elements.some(expressionHasSi);
	return false;
}
