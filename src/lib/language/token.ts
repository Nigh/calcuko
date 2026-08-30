export type TokenKind =
	| "number" | "string" | "identifier" | "comment" | "operator"
	| "leftParen" | "rightParen" | "leftBracket" | "rightBracket"
	| "comma" | "question" | "colon" | "eof";

export interface SourcePosition {
	offset: number;
	line: number;
	column: number;
}

export interface SourceSpan {
	start: SourcePosition;
	end: SourcePosition;
}

export interface Token {
	kind: TokenKind;
	lexeme: string;
	value?: string;
	span: SourceSpan;
}

export class LanguageError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly span: SourceSpan,
	) {
		super(message);
		this.name = "LanguageError";
	}
}
