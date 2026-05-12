function esc(s: string): string {
	let r = "";
	for (const ch of s) {
		if (ch === "&") r += "&#38;";
		else if (ch === "<") r += "&#60;";
		else if (ch === ">") r += "&#62;";
		else r += ch;
	}
	return r;
}

export function highlight(text: string, cursorPosition: number, matchedBracketIndex: number | null): string {
	const tokens = [
		{ type: "comment", regex: /\/\/.*/ },
		{ type: "number", regex: /0x[0-9a-fA-F]+/ },
		{ type: "number", regex: /0b[01]+/ },
		{ type: "number", regex: /0[0-7]+/ },
		{ type: "number", regex: /\d*\.?\d+[TGMkmunp]/ },
		{ type: "number", regex: /\d*\.?\d+/ },
		{ type: "operator", regex: /[+\-*/=<>!&|^%]+/ },
		{ type: "bracket", regex: /[()\[\]{}]/ },
		{ type: "variable", regex: /(?:[\p{ID_Start}$]|\p{Extended_Pictographic})(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})*/u },
	];

	let result = "";
	let i = 0;
	while (i < text.length) {
		let matched = false;

		if (i === cursorPosition || i === matchedBracketIndex) {
			const ch = text[i];
			if ("()[]{}".includes(ch)) {
				result += `<span class="bg-primary/30 text-primary font-bold underline">${esc(ch)}</span>`;
				i++;
				matched = true;
				continue;
			}
		}

		for (const token of tokens) {
			const substr = text.slice(i);
			const m = substr.match(token.regex);
			if (m && substr.indexOf(m[0]) === 0) {
				result += `<span class="token-${token.type}">${esc(m[0])}</span>`;
				i += m[0].length;
				matched = true;
				break;
			}
		}

		if (!matched) {
			result += esc(text[i]);
			i++;
		}
	}

	return result + "\n";
}
