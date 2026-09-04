import { acceptCompletion, autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { mathContext } from "./evaluator";
import { mathFunctions } from "./constants";
import { functionDescription, t } from "./i18n";
import { parse } from "./language/parser";

const identifierBeforeCursor = /(?:[\p{ID_Start}$]|\p{Extended_Pictographic})(?:[\p{ID_Continue}$]|\p{Extended_Pictographic})*$/u;

const builtinCompletions: Completion[] = Object.entries(mathContext)
	.filter(([, value]) => typeof value === "function")
	.map(([label]) => ({ label, type: "function", boost: 0 }))
	.sort((left, right) => left.label.localeCompare(right.label));

export function completionOptions(source: string, cursor: number): Completion[] {
	const lineStart = source.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
	const options = new Map<string, Completion>();

	for (const line of source.slice(0, lineStart).split("\n")) {
		try {
			const statement = parse(line);
			if (statement.kind === "functionDefinition") {
				options.set(statement.name, { label: statement.name, type: "function", detail: t("customFunction", { params: statement.parameters.join(", ") }), boost: 2 });
			} else if (statement.kind === "assignment") {
				const parameters = statement.value.kind === "lambda" ? statement.value.parameters : undefined;
				options.set(statement.name, parameters
					? { label: statement.name, type: "function", detail: t("customFunction", { params: parameters.join(", ") }), boost: 2 }
					: { label: statement.name, type: "variable", detail: t("earlierVariable"), boost: 1 });
			} else if (statement.kind === "destructuringAssignment") {
				for (const label of statement.names) options.set(label, { label, type: "variable", detail: t("earlierVariable"), boost: 1 });
			}
		} catch {
			// 正在编辑或语法错误的行不会向后方作用域贡献候选。
		}
	}
	for (const option of builtinCompletions) {
		if (!options.has(option.label)) options.set(option.label, { ...option, detail: functionDescription(option.label, mathFunctions[option.label] ?? t("builtinFunction")) });
	}
	return [...options.values()];
}

export function calcukoCompletionSource(context: CompletionContext): CompletionResult | null {
	const word = context.matchBefore(identifierBeforeCursor);
	if (!word && !context.explicit) return null;
	return {
		from: word?.from ?? context.pos,
		options: completionOptions(context.state.doc.toString(), context.pos),
		validFor: identifierBeforeCursor,
	};
}

export const calcukoAutocomplete = [
	autocompletion({ override: [calcukoCompletionSource], activateOnTyping: true }),
	Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
];
