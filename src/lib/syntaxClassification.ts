import type { Token } from "./language/token";
import { mathContext } from "./evaluator";
import { unitNames } from "./language/units";

const builtinFunctionNames = new Set(
	Object.entries(mathContext)
		.filter(([, value]) => typeof value === "function")
		.map(([name]) => name),
);
const physicalUnitNames = new Set(unitNames());

export function syntaxTokenClass(token: Token, nextToken?: Token, dimensions = false): string | undefined {
	if (["comment", "number", "string", "operator"].includes(token.kind)) return token.kind;
	if (["comma", "question", "colon"].includes(token.kind)) return "operator";
	if (token.kind === "identifier") {
		if (dimensions && physicalUnitNames.has(token.lexeme)) return "unit";
		if (nextToken?.kind === "leftParen") return builtinFunctionNames.has(token.lexeme) ? "builtin-function" : "user-function";
		return "variable";
	}
	if (token.kind === "unknown") return "unknown";
	if (token.kind === "unterminatedString") return "error";
	if (["leftParen", "rightParen", "leftBracket", "rightBracket"].includes(token.kind)) return "bracket";
	return undefined;
}
