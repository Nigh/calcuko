import { tokenize } from "./language/tokenizer";
import type { Token } from "./language/token";

function esc(s: string): string {
	return s.replaceAll("&", "&#38;").replaceAll("<", "&#60;").replaceAll(">", "&#62;");
}

const tokenClass = (token: Token): string | undefined => {
	if (["comment", "number", "string", "operator"].includes(token.kind)) return token.kind;
	if (["comma", "question", "colon"].includes(token.kind)) return "operator";
	if (token.kind === "identifier") return "variable";
	if (token.kind === "unknown") return "unknown";
	if (token.kind === "unterminatedString") return "error";
	if (["leftParen", "rightParen", "leftBracket", "rightBracket"].includes(token.kind)) return "bracket";
	return undefined;
};

export function highlight(text: string, cursorPosition: number, matchedBracketIndex: number | null): string {
	let tokens: Token[];
	try { tokens = tokenize(text, { tolerant: true }).filter((token) => token.kind !== "eof"); }
	catch { return esc(text) + "\n"; }

	let result = "";
	let offset = 0;
	for (const token of tokens) {
		result += esc(text.slice(offset, token.span.start.offset));
		const cssClass = tokenClass(token);
		let content = esc(token.lexeme);
		if (cssClass === "bracket" && (token.span.start.offset === cursorPosition || token.span.start.offset === cursorPosition - 1 || token.span.start.offset === matchedBracketIndex)) {
			content = `<span class="bg-primary/30 text-primary font-bold underline">${content}</span>`;
		}
		result += cssClass ? `<span class="token-${cssClass}">${content}</span>` : content;
		offset = token.span.end.offset;
	}
	result += esc(text.slice(offset));
	return result + "\n";
}
