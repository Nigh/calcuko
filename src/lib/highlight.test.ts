import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
	it("highlights commas as operators", () => {
		expect(highlight("pow(2, 3)", 0, null)).toContain('<span class="token-operator">,<\/span>');
	});

	it("keeps highlighting tokens after an unknown character", () => {
		const html = highlight("a = 1 # @ b = 2", 0, null);
		expect(html).toContain('<span class="token-variable">a<\/span>');
		expect(html).toContain('<span class="token-unknown">#<\/span>');
		expect(html).toContain('<span class="token-unknown">@<\/span>');
		expect(html).toContain('<span class="token-variable">b<\/span>');
		expect(html).toContain('<span class="token-number">2<\/span>');
	});

	it("contains unterminated strings to their line", () => {
		const html = highlight('message = "oops\nanswer = 42', 0, null);
		expect(html).toContain('<span class="token-error">"oops<\/span>');
		expect(html).toContain('<span class="token-variable">answer<\/span>');
		expect(html).toContain('<span class="token-number">42<\/span>');
	});

	it("uses tokenizer classifications", () => {
		const html = highlight('url = "https://example.com/a b"', 0, null);
		expect(html).toContain('class="token-string"');
		expect(html).not.toContain('class="token-comment"');
	});

	it("escapes source text", () => {
		expect(highlight('"<script>"', 0, null)).not.toContain("<script>");
	});
});
