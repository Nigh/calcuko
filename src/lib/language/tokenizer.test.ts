import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenizer";

const visible = (source: string) => tokenize(source).filter((token) => token.kind !== "eof");

describe("tokenize", () => {
	it("treats only line-leading // as comments", () => {
		const tokens = visible("  // note\n8 // 3");
		expect(tokens.map((token) => [token.kind, token.lexeme])).toEqual([
			["comment", "// note"], ["number", "8"], ["operator", "//"], ["number", "3"],
		]);
	});

	it("preserves spaces and comment markers in strings", () => {
		const token = visible('url = "https://example.com/a b"')[2];
		expect(token.kind).toBe("string");
		expect(token.value).toBe("https://example.com/a b");
	});

	it("recognizes unicode identifiers and numeric formats", () => {
		const tokens = visible("半径 = 0xFF + 100n + 😊");
		expect(tokens.map((token) => token.kind)).toEqual(["identifier", "operator", "number", "operator", "number", "operator", "identifier"]);
	});

	it("tracks line and column positions", () => {
		const token = visible("a = 1\n  b = 2")[3];
		expect(token.span.start).toMatchObject({ line: 2, column: 3 });
	});
});
