export type LineResult = {
	type: "empty" | "success" | "error";
	text: string;
	varName?: string;
	errorCode?: string;
	line?: number;
	column?: number;
};
