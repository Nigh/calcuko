import { beforeEach, describe, expect, it } from "vitest";
import { functionDescription, localizeError, setLocale, t } from "./i18n";
import { mathFunctions } from "./constants";

describe("i18n", () => {
	beforeEach(() => setLocale("zh-CN", false));

	it("formats UI messages in both languages", () => {
		expect(t("clear")).toBe("清除");
		setLocale("en", false);
		expect(t("clear")).toBe("Clear");
		expect(t("lineError", { line: 2, column: 4, message: "Expected an expression" })).toBe("Line 2, column 4: Expected an expression");
	});

	it("localizes static and dynamic evaluator errors", () => {
		expect(localizeError("字符串没有结束引号", "en")).toBe("String is missing a closing quote");
		expect(localizeError("未定义标识符“answer”", "en")).toBe("Undefined identifier “answer”");
		expect(localizeError("函数需要 2 个参数，实际收到 1 个", "en")).toBe("Function expects 2 arguments, received 1");
	});

	it("localizes built-in function descriptions", () => {
		expect(functionDescription("sqrt", mathFunctions.sqrt, "en")).toBe("Math.sqrt(x) — Square root");
		expect(functionDescription("sqrt", mathFunctions.sqrt, "zh-CN")).toContain("平方根");
		expect(Object.keys(mathFunctions).filter((name) => functionDescription(name, mathFunctions[name], "en") === "Built-in function")).toEqual([]);
	});
});
