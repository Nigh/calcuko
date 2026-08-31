import { expect, test } from "@playwright/test";

test("evaluates, persists, and restores formulas", async ({ page }) => {
	await page.goto("./");
	const editor = page.locator("textarea");
	await editor.fill('a = 12\nb = a * 3\nurl = "https://example.com/a b"');
	await expect(page.locator('[title="b = 36"]')).toBeVisible();
	await expect(page.locator('[title=\'url = "https://example.com/a b"\']')).toBeVisible();
	await page.reload();
	await expect(editor).toHaveValue(/a = 12/);
});

test("shows errors and color previews", async ({ page }) => {
	await page.goto("./");
	await page.locator("textarea").fill('missing\nrgb(255,0,0)');
	await expect(page.getByText(/第 1 行，第 1 列/)).toBeVisible();
	await expect(page.getByLabel("颜色预览").first()).toBeVisible();
});

test("confirms clear and supports undo", async ({ page }) => {
	await page.goto("./");
	await page.locator("textarea").fill("answer = 42");
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "清除" }).click();
	await expect(page.locator("textarea")).toHaveValue("");
	await page.getByRole("button", { name: "撤销" }).click();
	await expect(page.locator("textarea")).toHaveValue("answer = 42");
});
