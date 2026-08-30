import type { BinaryExpression, Expression, Statement } from "./ast";
import { LanguageError, type SourceSpan, type Token } from "./token";
import { tokenize } from "./tokenizer";

const precedence: Record<string, number> = {
	"||": 1, "&&": 2, "|": 3, "^": 4, "&": 5,
	"==": 6, "!=": 6, ">": 7, ">=": 7, "<": 7, "<=": 7,
	"<<": 8, ">>": 8, "+": 9, "-": 9, "*": 10, "/": 10, "//": 10, "%": 10, "$": 10,
	"**": 11,
};

const mergeSpan = (start: SourceSpan, end: SourceSpan): SourceSpan => ({ start: start.start, end: end.end });

export function parse(source: string): Statement {
	return new Parser(tokenize(source)).parseStatement();
}

export class Parser {
	private current = 0;
	constructor(private readonly tokens: Token[]) {}

	parseStatement(): Statement {
		while (this.peek().kind === "comment") this.advance();
		if (this.peek().kind === "eof") return { kind: "empty", span: this.peek().span };
		if (this.peek().kind === "identifier" && this.peek().lexeme === "def") {
			const start = this.advance();
			const name = this.expect("identifier", "def 后需要函数名");
			this.expect("leftParen", "函数名后需要参数列表");
			const parameters = this.parseParameters();
			this.expectOperator("=", "函数定义缺少等号");
			const body = this.parseExpression();
			this.expect("eof", "函数定义末尾存在多余内容");
			return { kind: "functionDefinition", name: name.lexeme, parameters, body, span: mergeSpan(start.span, body.span) };
		}

		if (this.peek().kind === "identifier" && this.peek(1).kind === "operator" && this.peek(1).lexeme === "=") {
			const name = this.advance();
			this.advance();
			const value = this.parseExpression();
			this.expect("eof", "表达式末尾存在多余内容");
			return { kind: "assignment", name: name.lexeme, value, span: mergeSpan(name.span, value.span) };
		}

		const expression = this.parseExpression();
		this.expect("eof", "表达式末尾存在多余内容");
		return { kind: "expression", expression, span: expression.span };
	}

	private parseExpression(minPrecedence = 0): Expression {
		if (minPrecedence === 0 && this.isLambdaStart()) return this.parseLambda();
		let left = this.parsePrefix();
		left = this.parsePostfix(left);

		while (true) {
			const token = this.peek();
			const implicit = this.startsPrimary(token);
			const operator = implicit ? "*" : token.kind === "operator" ? token.lexeme : "";
			const level = precedence[operator];
			if (level === undefined || level < minPrecedence) break;
			if (!implicit) this.advance();
			const right = this.parseExpression(operator === "**" ? level : level + 1);
			left = {
				kind: "binary", operator, left, right, implicit,
				span: mergeSpan(left.span, right.span),
			} satisfies BinaryExpression;
		}

		if (minPrecedence === 0 && this.match("question")) {
			const whenTrue = this.parseExpression();
			this.expect("colon", "条件表达式缺少冒号");
			const whenFalse = this.parseExpression();
			left = { kind: "conditional", condition: left, whenTrue, whenFalse, span: mergeSpan(left.span, whenFalse.span) };
		}
		return left;
	}

	private isLambdaStart(): boolean {
		if (this.peek().kind === "identifier" && this.peek(1).kind === "operator" && this.peek(1).lexeme === "=>") return true;
		if (this.peek().kind !== "leftParen") return false;
		let index = 1;
		if (this.peek(index).kind === "rightParen") index++;
		else {
			while (true) {
				if (this.peek(index++).kind !== "identifier") return false;
				if (this.peek(index).kind === "comma") { index++; continue; }
				if (this.peek(index).kind === "rightParen") { index++; break; }
				return false;
			}
		}
		return this.peek(index).kind === "operator" && this.peek(index).lexeme === "=>";
	}

	private parseLambda(): Expression {
		const start = this.peek();
		let parameters: string[];
		if (this.match("leftParen")) parameters = this.parseParameters();
		else parameters = [this.expect("identifier", "Lambda 需要参数名").lexeme];
		this.expectOperator("=>", "Lambda 缺少 =>");
		const body = this.parseExpression();
		return { kind: "lambda", parameters, body, span: mergeSpan(start.span, body.span) };
	}

	private parseParameters(): string[] {
		const parameters: string[] = [];
		if (this.peek().kind !== "rightParen") do parameters.push(this.expect("identifier", "参数必须是标识符").lexeme); while (this.match("comma"));
		this.expect("rightParen", "参数列表缺少右括号");
		if (new Set(parameters).size !== parameters.length) throw new LanguageError("DUPLICATE_PARAMETER", "函数参数不能重名", this.peek().span);
		return parameters;
	}

	private parsePrefix(): Expression {
		const token = this.advance();
		if (token.kind === "number") return { kind: "number", raw: token.lexeme, span: token.span };
		if (token.kind === "string") return { kind: "string", value: token.value ?? "", span: token.span };
		if (token.kind === "identifier") return { kind: "identifier", name: token.lexeme, span: token.span };
		if (token.kind === "operator" && ["+", "-", "!", "~"].includes(token.lexeme)) {
			const operand = this.parseExpression(11);
			return { kind: "unary", operator: token.lexeme, operand, span: mergeSpan(token.span, operand.span) };
		}
		if (token.kind === "leftParen") {
			const expression = this.parseExpression();
			this.expect("rightParen", "缺少右括号");
			return expression;
		}
		if (token.kind === "leftBracket") {
			const elements: Expression[] = [];
			if (this.peek().kind !== "rightBracket") {
				do elements.push(this.parseExpression()); while (this.match("comma"));
			}
			const end = this.expect("rightBracket", "数组缺少右方括号");
			return { kind: "array", elements, span: mergeSpan(token.span, end.span) };
		}
		throw new LanguageError("EXPECTED_EXPRESSION", "此处需要表达式", token.span);
	}

	private parsePostfix(callee: Expression): Expression {
		while (this.match("leftParen")) {
			const args: Expression[] = [];
			if (this.peek().kind !== "rightParen") do args.push(this.parseExpression()); while (this.match("comma"));
			const end = this.expect("rightParen", "函数调用缺少右括号");
			callee = { kind: "call", callee, args, span: mergeSpan(callee.span, end.span) };
		}
		return callee;
	}

	private startsPrimary(token: Token): boolean {
		return token.kind === "identifier" || token.kind === "number" || token.kind === "string" || token.kind === "leftParen" || token.kind === "leftBracket";
	}
	private peek(distance = 0): Token { return this.tokens[Math.min(this.current + distance, this.tokens.length - 1)]; }
	private advance(): Token { return this.tokens[this.current++]; }
	private match(kind: Token["kind"]): boolean { if (this.peek().kind !== kind) return false; this.advance(); return true; }
	private expect(kind: Token["kind"], message: string): Token {
		const token = this.peek();
		if (token.kind !== kind) throw new LanguageError("UNEXPECTED_TOKEN", message, token.span);
		return this.advance();
	}
	private expectOperator(operator: string, message: string): Token {
		const token = this.peek();
		if (token.kind !== "operator" || token.lexeme !== operator) throw new LanguageError("UNEXPECTED_TOKEN", message, token.span);
		return this.advance();
	}
}
