export type LineResult = {
	type: "empty" | "success" | "error";
	text: string;
	varName?: string;
	errorCode?: string;
	line?: number;
	column?: number;
	preview?: { type: "color"; css: string };
	value?: unknown;
	valueKind?: "bigint" | "decimal" | "rational" | "quantity" | "color" | "matrix" | "other";
	hasSi?: boolean;
};
