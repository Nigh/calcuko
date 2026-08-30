import { describe, expect, it } from "vitest";
import { evaluateSource } from "../evaluator";
describe("statistics",()=>{
	it("computes descriptive statistics",()=>{const r=evaluateSource("mean([1,2,3,4])\nmedian(1,9,3)\nvariance([1,2,3])\nsampleVariance([1,2,3])\nstd([2,2,2])");expect(r.lineResults.map(x=>x.text)).toEqual(["2.5","3","0.6666666666666666666666666666666667","1","0"]);});
	it("validates statistical domains",()=>{const r=evaluateSource("geoMean([-1,2])\nharMean([0,2])\nsampleStd([1])");expect(r.lineResults.every(x=>x.type==="error")).toBe(true);});
	it("generates values in half-open ranges",()=>{for(let i=0;i<100;i++){const r=evaluateSource("randInt(10,20)\nrand(-2,3)");const a=BigInt(r.lineResults[0].text),b=Number(r.lineResults[1].text);expect(a>=10n&&a<20n).toBe(true);expect(b>=-2&&b<3).toBe(true);}});
});
