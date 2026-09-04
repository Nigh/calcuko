import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { tokenize } from "./language/tokenizer";
import { syntaxTokenClass } from "./syntaxClassification";

export type EditorUiState = {
	activeLine: number;
	hoverLine: number | null;
	errorLines: number[];
	resultHeights: number[];
};
export const setEditorUi = StateEffect.define<EditorUiState>();

class SpacerWidget extends WidgetType {
	constructor(
		readonly height: number,
		readonly className: string,
	) {
		super();
	}
	eq(other: SpacerWidget) {
		return other.height === this.height && other.className === this.className;
	}
	toDOM() {
		const element = document.createElement("div");
		element.style.height = this.height + "px";
		element.className = this.className;
		element.setAttribute("aria-hidden", "true");
		return element;
	}
}

const buildUi = (state: EditorState, ui: EditorUiState): DecorationSet => {
	const ranges: Array<ReturnType<Decoration["range"]>> = [];
	const errors = new Set(ui.errorLines);
	for (let number = 1; number <= state.doc.lines; number++) {
		const line = state.doc.line(number);
		if (errors.has(number)) ranges.push(Decoration.line({ class: "cm-error-line" }).range(line.from));
		if (ui.hoverLine === number) ranges.push(Decoration.line({ class: "cm-result-hover-line" }).range(line.from));
		const extra = Math.max(0, (ui.resultHeights[number - 1] ?? 24) - 24);
		if (extra)
			ranges.push(
				Decoration.widget({
					widget: new SpacerWidget(extra, ["cm-line-spacer", ui.activeLine === number ? "cm-line-spacer-active" : "", ui.hoverLine === number ? "cm-line-spacer-hover" : "", errors.has(number) ? "cm-line-spacer-error" : ""].filter(Boolean).join(" ")),
					block: true,
					side: 1,
				}).range(line.to),
			);
	}
	return Decoration.set(ranges, true);
};

type UiFieldValue = { ui: EditorUiState; decorations: DecorationSet };
const emptyUi: EditorUiState = {
	activeLine: 1,
	hoverLine: null,
	errorLines: [],
	resultHeights: [],
};
export const editorUiField = StateField.define<UiFieldValue>({
	create: (state) => ({ ui: emptyUi, decorations: buildUi(state, emptyUi) }),
	update(value, transaction) {
		let ui = value.ui;
		for (const effect of transaction.effects) if (effect.is(setEditorUi)) ui = effect.value;
		return {
			ui,
			decorations: transaction.docChanged || ui !== value.ui ? buildUi(transaction.state, ui) : value.decorations,
		};
	},
	provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

const buildSyntax = (state: EditorState, dimensions: boolean): DecorationSet => {
	const ranges: Array<ReturnType<Decoration["range"]>> = [];
	const tokens = tokenize(state.doc.toString(), { tolerant: true });
	for (const [index, token] of tokens.entries()) {
		if (token.kind === "eof") continue;
		const css = syntaxTokenClass(token, tokens[index + 1], dimensions);
		if (css) ranges.push(Decoration.mark({ class: `token-${css}` }).range(token.span.start.offset, token.span.end.offset));
	}
	return Decoration.set(ranges, true);
};
export const syntaxDecorations = (dimensions = false) => StateField.define<DecorationSet>({
	create: (state) => buildSyntax(state, dimensions),
	update: (value, transaction) => (transaction.docChanged ? buildSyntax(transaction.state, dimensions) : value),
	provide: (field) => EditorView.decorations.from(field),
});
