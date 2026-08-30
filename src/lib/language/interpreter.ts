import type { Expression, Statement } from "./ast";
import { LanguageError, type SourceSpan } from "./token";
import Decimal from "decimal.js";
import { numericBinary, parseNumeric, toBigIntExact, type NumericValue } from "./numeric";
import { createRange } from "./ranges";

export type RuntimeValue = NumericValue | string | boolean | RuntimeValue[] | BuiltinFunction | UserFunction | null;
// Built-ins are adapted at the registry boundary; permissive parameters allow
// native Math functions while call results are still validated by the runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BuiltinFunction = (...args: any[]) => RuntimeValue;
export type RuntimeScope = Record<string, RuntimeValue>;
export interface UserFunction {
	kind: "userFunction";
	name?: string;
	parameters: string[];
	body: Expression;
	closure: RuntimeScope;
}

const runtimeError = (code: string, message: string, span: SourceSpan): never => {
	throw new LanguageError(code, message, span);
};

export function evaluateStatement(statement: Statement, scope: RuntimeScope): { value: RuntimeValue; name?: string; names?: string[]; hasSi: boolean } {
	if (statement.kind === "empty") return { value: null, hasSi: false };
	if (statement.kind === "functionDefinition") {
		const value: UserFunction = { kind: "userFunction", name: statement.name, parameters: statement.parameters, body: statement.body, closure: scope };
		scope[statement.name] = value;
		return { value, name: statement.name, hasSi: false };
	}
	if (statement.kind === "assignment") {
		const value = evaluateExpression(statement.value, scope);
		scope[statement.name] = value;
		return { value, name: statement.name, hasSi: expressionHasSi(statement.value) };
	}
	if (statement.kind === "destructuringAssignment") {
		const value = evaluateExpression(statement.value, scope);
		if (!Array.isArray(value)) return runtimeError("EXPECTED_ARRAY", "解构赋值右侧必须是数组", statement.value.span);
		if (value.length !== statement.names.length) return runtimeError("DESTRUCTURE_LENGTH", `解构需要 ${statement.names.length} 个值，实际收到 ${value.length} 个`, statement.value.span);
		// Validate the complete value before mutating scope so assignment is atomic.
		statement.names.forEach((name, index) => { scope[name] = value[index]; });
		return { value, names: statement.names, hasSi: false };
	}
	return { value: evaluateExpression(statement.expression, scope), hasSi: expressionHasSi(statement.expression) };
}

export function evaluateExpression(expression: Expression, scope: RuntimeScope): RuntimeValue {
	switch (expression.kind) {
		case "number": return parseNumeric(expression.raw);
		case "string": return expression.value;
		case "identifier":
			if (!(expression.name in scope)) return runtimeError("UNKNOWN_IDENTIFIER", `未定义标识符“${expression.name}”`, expression.span);
			return scope[expression.name];
		case "array": return expression.elements.map((element) => evaluateExpression(element, scope));
		case "lambda": return { kind: "userFunction", parameters: expression.parameters, body: expression.body, closure: scope };
		case "unary": {
			const operand = evaluateExpression(expression.operand, scope);
			if (expression.operator === "!") return !truthy(operand);
			const number = requireNumeric(operand, expression.span);
			if (expression.operator === "+") return number;
			if (expression.operator === "-") return numericBinary("-", 0n, number) as NumericValue;
			if (expression.operator === "~") return ~toBigIntExact(number);
			return runtimeError("UNKNOWN_OPERATOR", `未知一元操作符“${expression.operator}”`, expression.span);
		}
		case "binary": {
			if (expression.operator === ".." || expression.operator === "..=") {
				const left = requireNumeric(evaluateExpression(expression.left, scope), expression.left.span);
				const right = requireNumeric(evaluateExpression(expression.right, scope), expression.right.span);
				try { return createRange(left, right, undefined, expression.operator === "..="); }
				catch (error) { return runtimeError("RANGE_ERROR", error instanceof Error ? error.message : String(error), expression.span); }
			}
			if (expression.operator === "&&") return truthy(evaluateExpression(expression.left, scope)) && truthy(evaluateExpression(expression.right, scope));
			if (expression.operator === "||") return truthy(evaluateExpression(expression.left, scope)) || truthy(evaluateExpression(expression.right, scope));
			const left = evaluateExpression(expression.left, scope);
			const right = evaluateExpression(expression.right, scope);
			if (Array.isArray(left) || Array.isArray(right)) return vectorBinary(expression.operator, left, right, expression.span);
			if (expression.operator === "+" && (typeof left === "string" || typeof right === "string")) return String(left) + String(right);
			if (["==", "!="].includes(expression.operator) && (!isNumeric(left) || !isNumeric(right))) return expression.operator === "==" ? left === right : left !== right;
			const a = requireNumeric(left, expression.left.span);
			const b = requireNumeric(right, expression.right.span);
			switch (expression.operator) {
				case "+": case "-": case "*": case "/": case "//": case "%": case "**": case "$":
				case ">": case ">=": case "<": case "<=": case "==": case "!=":
					try { return numericBinary(expression.operator, a, b); }
					catch (error) { return runtimeError("NUMERIC_ERROR", error instanceof Error ? error.message : String(error), expression.span); }
				case "&": return toBigIntExact(a) & toBigIntExact(b);
				case "|": return toBigIntExact(a) | toBigIntExact(b);
				case "^": return toBigIntExact(a) ^ toBigIntExact(b);
				case "<<": return toBigIntExact(a) << toBigIntExact(b);
				case ">>": return toBigIntExact(a) >> toBigIntExact(b);
				default: return runtimeError("UNKNOWN_OPERATOR", `未知操作符“${expression.operator}”`, expression.span);
			}
		}
		case "conditional": return truthy(evaluateExpression(expression.condition, scope))
			? evaluateExpression(expression.whenTrue, scope) : evaluateExpression(expression.whenFalse, scope);
		case "call": {
			const callee = evaluateExpression(expression.callee, scope);
			const args = expression.args.map((arg) => evaluateExpression(arg, scope));
			if (isUserFunction(callee)) {
				if (args.length !== callee.parameters.length) return runtimeError("ARITY_MISMATCH", `函数需要 ${callee.parameters.length} 个参数，实际收到 ${args.length} 个`, expression.span);
				const local = Object.create(callee.closure) as RuntimeScope;
				callee.parameters.forEach((parameter, index) => { local[parameter] = args[index]; });
				return evaluateExpression(callee.body, local);
			}
			if (typeof callee !== "function") return runtimeError("NOT_CALLABLE", "该值不能作为函数调用", expression.callee.span);
			try { return callee(...args); }
			catch (error) { return runtimeError("FUNCTION_ERROR", error instanceof Error ? error.message : String(error), expression.span); }
		}
	}
}

function vectorBinary(operator: string, left: RuntimeValue, right: RuntimeValue, span: SourceSpan): RuntimeValue {
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return runtimeError("ARRAY_SHAPE", "数组形状不一致", span);
		return left.map((value, index) => vectorBinary(operator, value, right[index], span));
	}
	if (Array.isArray(left)) return left.map((value) => vectorBinary(operator, value, right, span));
	if (Array.isArray(right)) return right.map((value) => vectorBinary(operator, left, value, span));
	const a = requireNumeric(left, span); const b = requireNumeric(right, span);
	try { return numericBinary(operator, a, b); }
	catch (error) { return runtimeError("NUMERIC_ERROR", error instanceof Error ? error.message : String(error), span); }
}

export function invokeUserFunction(callee: UserFunction, args: RuntimeValue[]): RuntimeValue {
	if (args.length !== callee.parameters.length) throw new Error(`函数需要 ${callee.parameters.length} 个参数，实际收到 ${args.length} 个`);
	const local = Object.create(callee.closure) as RuntimeScope;
	callee.parameters.forEach((parameter, index) => { local[parameter] = args[index]; });
	return evaluateExpression(callee.body, local);
}

function requireNumeric(value: RuntimeValue, span: SourceSpan): NumericValue {
	if (!isNumeric(value)) return runtimeError("EXPECTED_NUMBER", "此操作需要数值", span);
	return value;
}
function isNumeric(value: RuntimeValue): value is NumericValue { return typeof value === "bigint" || value instanceof Decimal || (typeof value === "object" && value !== null && "numerator" in value && "denominator" in value); }
function truthy(value: RuntimeValue): boolean { return Boolean(value); }
export function isUserFunction(value: unknown): value is UserFunction { return typeof value === "object" && value !== null && "kind" in value && value.kind === "userFunction"; }
function expressionHasSi(expression: Expression): boolean {
	if (expression.kind === "number") return /[TGMkmunp]$/.test(expression.raw);
	if (expression.kind === "unary") return expressionHasSi(expression.operand);
	if (expression.kind === "binary") return expressionHasSi(expression.left) || expressionHasSi(expression.right);
	if (expression.kind === "conditional") return expressionHasSi(expression.condition) || expressionHasSi(expression.whenTrue) || expressionHasSi(expression.whenFalse);
	if (expression.kind === "call") return expressionHasSi(expression.callee) || expression.args.some(expressionHasSi);
	if (expression.kind === "array") return expression.elements.some(expressionHasSi);
	return false;
}
