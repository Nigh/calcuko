import { expect, test, type Page } from "@playwright/test";

const editor = (page: Page) => page.locator(".cm-content");
const setSource = async (page: Page, source: string) => {
	await editor(page).fill(source);
};

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("calcuko-locale", "zh-CN"));
});

test("shows the build version beside the title", async ({ page }) => {
	await page.goto("./");
	await expect(page.getByLabel(/^版本 /)).toHaveText(/^(?:dev|v\d+\.\d+\.\d+)$/);
});

test("detects English, localizes all surfaces, and persists manual switching", async ({ page }) => {
	await page.addInitScript(() => localStorage.removeItem("calcuko-locale"));
	await page.goto("./");
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(editor(page)).toContainText("Unicode identifiers");
	await expect(page).toHaveTitle("Calcuko - Multi-line Formula Calculator");
	await expect(page.getByRole("button", { name: "Help" })).toBeVisible();

	await setSource(page, "missing");
	await expect(page.getByText("Line 1, column 1: Undefined identifier “missing”")).toBeVisible();
	await setSource(page, "sq");
	await expect(page.locator(".cm-completionLabel", { hasText: "sqrt" })).toBeVisible();
	await expect(page.locator(".cm-completionLabel", { hasText: "sqrt" }).locator("..").locator(".cm-completionDetail")).toContainText("Square root");

	await page.getByRole("button", { name: "Help" }).click();
	await expect(page.getByRole("heading", { name: "Basics" })).toBeVisible();
	await page.getByRole("button", { name: "Close help" }).click();
	await page.getByRole("combobox", { name: "Language" }).selectOption("zh-CN");
	await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
	await expect(page.getByRole("button", { name: "帮助" })).toBeVisible();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("calcuko-locale"))).toBe("zh-CN");
});

test("evaluates, persists, and restores formulas", async ({ page }) => {
	await page.goto("./");
	await setSource(page, 'a = 12\nb = a * 3\nurl = "https://example.com/a b"');
	await expect(page.locator('[data-result-line="2"]')).toContainText("36");
	await expect(page.locator('[data-result-line="2"]')).not.toContainText("b =");
	await expect(page.locator('[data-result-line="3"]')).toContainText('"https://example.com/a b"');
	await page.reload();
	await expect(editor(page)).toContainText("a = 12");
});

test("links active and hovered result rows to editor lines", async ({ page }) => {
	await page.goto("./");
	await setSource(page, "a=1\nb=2\nc=3");
	await editor(page).press("Control+Home");
	await editor(page).press("ArrowDown");
	await expect(page.locator('[data-result-line="2"]')).toHaveClass(/result-active/);
	await page.locator('[data-result-line="3"]').hover();
	await expect(page.locator(".cm-line").nth(2)).toHaveClass(/cm-result-hover-line/);
	await expect(page.locator('[data-result-line="3"]')).toHaveClass(/result-hover/);
});

test("shows a visible themed editor cursor", async ({ page }) => {
	await page.goto("./");
	await setSource(page, "value=42");
	await editor(page).click();
	const cursor = page.locator(".cm-cursor").first();
	await expect(cursor).toBeVisible();
	await expect(cursor).toHaveCSS("border-left-color", "rgb(251, 113, 133)");
});

test("autocompletes earlier symbols and built-ins with Tab without consuming a normal Tab", async ({ page }) => {
	await page.goto("./");
	await setSource(page, "total = 42\nfn triple(value)=value*3\ntot");
	await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible();
	await expect(page.locator(".cm-completionLabel", { hasText: "total" })).toBeVisible();
	await expect(page.locator(".cm-tooltip-autocomplete")).toHaveCSS("border-top-width", "1px");
	await expect(page.locator(".cm-tooltip-autocomplete")).toHaveCSS("border-radius", "16px");
	const variableIconColor = await page.locator(".cm-completionIcon-variable").first().evaluate((icon) => getComputedStyle(icon, "::after").color);
	await expect(page.locator(".cm-tooltip-autocomplete")).toHaveCSS("padding", "8px");
	expect(variableIconColor).toBe("rgb(14, 165, 233)");
	await editor(page).press("Tab");
	await expect(page.locator(".cm-line").nth(2)).toHaveText("total");

	await editor(page).press("Enter");
	await editor(page).pressSequentially("sq");
	await expect(page.locator(".cm-completionLabel", { hasText: "sqrt" })).toBeVisible();
	await expect(page.locator(".cm-completionLabel", { hasText: "sqrt" }).locator("..").locator(".cm-completionDetail")).toContainText("平方根");
	await editor(page).press("Escape");
	const before = await editor(page).textContent();
	await editor(page).press("Tab");
	await expect(editor(page)).toHaveText(before ?? "");
});

test("shows matrices, errors, and color previews", async ({ page }) => {
	await page.goto("./");
	await setSource(page, "missing\nmatrix([[1,2],[3,4]])\nrgb(255,0,0)");
	await expect(page.getByText(/第 1 行，第 1 列/)).toBeVisible();
	await expect(page.locator('[data-result-line="2"] table tr')).toHaveCount(2);
	await expect(page.locator('[data-result-line="2"] table tr').first().locator("td")).toHaveCount(2);
	await expect(page.locator('[data-result-line="2"] .matrix-bracket')).toHaveCount(2);
	const matrixWidth = await page.locator('[data-result-line="2"] .matrix-result').evaluate((element) => element.getBoundingClientRect().width);
	const resultWidth = await page.locator('[data-result-line="2"]').evaluate((element) => element.getBoundingClientRect().width);
	expect(matrixWidth).toBeLessThan(resultWidth);
	const editorLines = page.locator(".cm-line");
	const sourcePitch = await editorLines.nth(2).evaluate((line, previous) => line.getBoundingClientRect().top - (previous as Element).getBoundingClientRect().top, await editorLines.nth(1).elementHandle());
	const resultRows = page.locator("[data-result-line]");
	const resultPitch = await resultRows.nth(2).evaluate((row, previous) => row.getBoundingClientRect().top - (previous as Element).getBoundingClientRect().top, await resultRows.nth(1).elementHandle());
	expect(Math.abs(sourcePitch - resultPitch)).toBeLessThanOrEqual(1);
	await expect(page.getByLabel("颜色预览").first()).toBeVisible();
});

test("formats results and restores the line format after reload", async ({ page }) => {
	await page.goto("./");
	await setSource(page, "value=255");
	await page.locator('[data-result-line="1"] button').first().click();
	await page.getByRole("menuitem", { name: "十六进制" }).click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("calcuko-result-formats"))).toContain('"name":"hex"');
	await expect(page.locator('[data-result-line="1"]')).toContainText("0xFF");
	await page.reload();
	await expect(page.locator('[data-result-line="1"]')).toContainText("0xFF");
	await setSource(page, "other=1\nvalue=255");
	await expect(page.locator('[data-result-line="2"]')).toContainText("0xFF");
	await setSource(page, 'other=1\nvalue="text"');
	await expect(page.locator('[data-result-line="2"]')).toContainText('"text"');
	await expect.poll(() => page.evaluate(() => localStorage.getItem("calcuko-result-formats"))).not.toContain('"name":"hex"');
});

test("confirms clear and supports undo", async ({ page }) => {
	await page.goto("./");
	await setSource(page, "answer = 42");
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "清除" }).click();
	await expect(editor(page)).toHaveText("");
	await page.getByRole("button", { name: "撤销" }).click();
	await expect(editor(page)).toContainText("answer = 42");
});
