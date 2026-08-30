import { LanguageError, type SourcePosition, type Token, type TokenKind } from "./token";

const identStart = /^(?:[\p{ID_Start}$]|\p{Extended_Pictographic})$/u;
const identContinue = /^(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})$/u;
const operators = ["**", "//", "==", "!=", ">=", "<=", "&&", "||", "=>", "<<", ">>", "..=", "..", "+", "-", "*", "/", "%", "$", "=", ">", "<", "!", "~", "&", "|", "^"];

export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let offset = 0;
	let line = 1;
	let column = 1;
	let onlyWhitespaceOnLine = true;

	const position = (): SourcePosition => ({ offset, line, column });
	const advance = (): string => {
		const ch = source[offset++] ?? "";
		if (ch === "\n") { line++; column = 1; onlyWhitespaceOnLine = true; }
		else column++;
		return ch;
	};
	const add = (kind: TokenKind, start: SourcePosition, value?: string) => {
		tokens.push({ kind, lexeme: source.slice(start.offset, offset), value, span: { start, end: position() } });
	};

	while (offset < source.length) {
		const ch = source[offset];
		if (ch === "\r") { advance(); if (source[offset] === "\n") advance(); continue; }
		if (ch === "\n") { advance(); continue; }
		if (/\s/u.test(ch)) { advance(); continue; }

		const start = position();
		if (onlyWhitespaceOnLine && source.startsWith("//", offset)) {
			while (offset < source.length && source[offset] !== "\r" && source[offset] !== "\n") advance();
			add("comment", start);
			continue;
		}
		onlyWhitespaceOnLine = false;

		if (ch === '"' || ch === "'") {
			const quote = advance();
			let value = "";
			let closed = false;
			while (offset < source.length) {
				const current = advance();
				if (current === quote) { closed = true; break; }
				if (current === "\n" || current === "\r") break;
				if (current === "\\") {
					const escaped = advance();
					const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", "\\": "\\", '"': '"', "'": "'" };
					value += escapes[escaped] ?? escaped;
				} else value += current;
			}
			if (!closed) throw new LanguageError("UNTERMINATED_STRING", "字符串没有结束引号", { start, end: position() });
			add("string", start, value);
			continue;
		}

		if (/\d/u.test(ch) || (ch === "." && /\d/u.test(source[offset + 1] ?? ""))) {
			if (source.startsWith("0x", offset) || source.startsWith("0X", offset)) {
				advance(); advance(); while (/[0-9a-fA-F_]/u.test(source[offset] ?? "")) advance();
			} else if (source.startsWith("0b", offset) || source.startsWith("0B", offset)) {
				advance(); advance(); while (/[01_]/u.test(source[offset] ?? "")) advance();
			} else {
				while (/[\d_]/u.test(source[offset] ?? "")) advance();
				if (source[offset] === "." && source[offset + 1] !== ".") { advance(); while (/[\d_]/u.test(source[offset] ?? "")) advance(); }
				if (/[eE]/u.test(source[offset] ?? "")) { advance(); if (/[+-]/u.test(source[offset] ?? "")) advance(); while (/[\d_]/u.test(source[offset] ?? "")) advance(); }
			}
			if (/[TGMkmunp]/u.test(source[offset] ?? "")) advance();
			add("number", start);
			continue;
		}

		const codePoint = String.fromCodePoint(source.codePointAt(offset) ?? 0);
		if (identStart.test(codePoint) && !(codePoint === "$" && /\d/u.test(source[offset + 1] ?? ""))) {
			for (let i = 0; i < codePoint.length; i++) advance();
			while (offset < source.length) {
				const next = String.fromCodePoint(source.codePointAt(offset) ?? 0);
				if (!identContinue.test(next)) break;
				for (let i = 0; i < next.length; i++) advance();
			}
			add("identifier", start);
			continue;
		}

		const punctuation: Record<string, TokenKind> = { "(": "leftParen", ")": "rightParen", "[": "leftBracket", "]": "rightBracket", ",": "comma", "?": "question", ":": "colon" };
		if (punctuation[ch]) { advance(); add(punctuation[ch], start); continue; }

		const op = operators.find((candidate) => source.startsWith(candidate, offset));
		if (op) { for (let i = 0; i < op.length; i++) advance(); add("operator", start); continue; }
		advance();
		throw new LanguageError("UNEXPECTED_CHARACTER", `无法识别字符“${ch}”`, { start, end: position() });
	}

	const end = position();
	tokens.push({ kind: "eof", lexeme: "", span: { start: end, end } });
	return tokens;
}
