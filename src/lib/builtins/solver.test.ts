import { describe,expect,it } from "vitest";
import { evaluateSource } from "../evaluator";
describe("Newton solver",()=>{
	it("solves a quadratic from explicit and automatic seeds",()=>{const r=evaluateSource("solve(x=>x**2-2,1)\nsolve(x=>x**2-2)");expect(Number(r.lineResults[0].text.slice(1,-1))).toBeCloseTo(Math.SQRT2,12);const roots=JSON.parse(r.lineResults[1].text.replace(/([\d.]+(?:e[+-]?\d+)?)/gi,'$1'));expect(roots[0]).toBeCloseTo(-Math.SQRT2,10);expect(roots[1]).toBeCloseTo(Math.SQRT2,10);});
	it("finds and deduplicates multiple interval roots",()=>{const r=evaluateSource("solve(sin,-4,4)");const values=JSON.parse(r.lineResults[0].text);expect(values).toHaveLength(3);expect(values[0]).toBeCloseTo(-Math.PI,8);expect(values[1]).toBeCloseTo(0,8);expect(values[2]).toBeCloseTo(Math.PI,8);});
	it("reports explicit-seed non-convergence and returns no real roots",()=>{const r=evaluateSource("solve(x=>x**2+1,0)\nsolve(x=>x**2+1)");expect(r.lineResults[0].type).toBe("error");expect(r.lineResults[1].text).toBe("[]");});
});
