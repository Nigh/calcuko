import { tokenize } from "./language/tokenizer";
import { syntaxTokenClass } from "./syntaxClassification";

function esc(s: string): string {
	return s.replaceAll("&", "&#38;").replaceAll("<", "&#60;").replaceAll(">", "&#62;");
}

export function highlight(text: string, cursorPosition: number, matchedBracketIndex: number | null, dimensions = false): string {
	let tokens: ReturnType<typeof tokenize>;
	try {
		tokens = tokenize(text, { tolerant: true }).filter((token) => token.kind !== "eof");
	} catch {
		return esc(text) + "\n";
	}

	let result = "";
	let offset = 0;
	for (const [index, token] of tokens.entries()) {
		result += esc(text.slice(offset, token.span.start.offset));
		const cssClass = syntaxTokenClass(token, tokens[index + 1], dimensions);
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
