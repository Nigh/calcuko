import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
	it("uses tokenizer classifications", () => {
		const html = highlight('url = "https://example.com/a b"', 0, null);
		expect(html).toContain('class="token-string"');
		expect(html).not.toContain('class="token-comment"');
	});

	it("escapes source text", () => {
		expect(highlight('"<script>"', 0, null)).not.toContain("<script>");
	});
});
