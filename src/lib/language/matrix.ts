import { isNumericValue, numericBinary, type NumericValue } from "./numeric";
import type { RuntimeValue } from "./interpreter";

export class Matrix {
	readonly rows: NumericValue[][];
	readonly rowCount: number;
	readonly columnCount: number;
	constructor(rows: RuntimeValue[]) {
		if (!rows.length || !rows.every(Array.isArray)) throw new Error("矩阵需要非空的二维数组");
		const converted = rows.map((row) => (row as RuntimeValue[]).map((value) => {
			if (!isNumericValue(value)) throw new Error("矩阵元素必须是数值");
			return value;
		}));
		const width = converted[0].length;
		if (!width || converted.some((row) => row.length !== width)) throw new Error("矩阵各行长度必须一致");
		this.rows = converted; this.rowCount = converted.length; this.columnCount = width;
	}
}

export const isMatrix = (value: unknown): value is Matrix => value instanceof Matrix;
const op = (operator: string, a: NumericValue, b: NumericValue) => numericBinary(operator, a, b) as NumericValue;

export function matrixBinary(operator: string, left: Matrix | NumericValue, right: Matrix | NumericValue): Matrix {
	if (left instanceof Matrix && right instanceof Matrix) {
		if (operator === "*") return multiply(left, right);
		if (left.rowCount !== right.rowCount || left.columnCount !== right.columnCount) throw new Error("矩阵形状不一致");
		return fromNumeric(left.rows.map((row, r) => row.map((value, c) => op(operator, value, right.rows[r][c]))));
	}
	if (left instanceof Matrix) return fromNumeric(left.rows.map((row) => row.map((value) => op(operator, value, right as NumericValue))));
	if (right instanceof Matrix) return fromNumeric(right.rows.map((row) => row.map((value) => op(operator, left as NumericValue, value))));
	throw new Error("矩阵运算至少需要一个矩阵");
}

function multiply(left: Matrix, right: Matrix): Matrix {
	if (left.columnCount !== right.rowCount) throw new Error("矩阵乘法维度不匹配");
	return fromNumeric(Array.from({ length: left.rowCount }, (_, row) => Array.from({ length: right.columnCount }, (_, column) => {
		let total: NumericValue = 0n;
		for (let k = 0; k < left.columnCount; k++) total = op("+", total, op("*", left.rows[row][k], right.rows[k][column]));
		return total;
	})));
}

export function determinant(matrix: Matrix): NumericValue {
	if (matrix.rowCount !== matrix.columnCount) throw new Error("只有方阵可以计算行列式");
	if (matrix.rowCount === 1) return matrix.rows[0][0];
	let total: NumericValue = 0n;
	for (let column = 0; column < matrix.columnCount; column++) {
		const minor = fromNumeric(matrix.rows.slice(1).map((row) => row.filter((_, index) => index !== column)));
		let term = op("*", matrix.rows[0][column], determinant(minor));
		if (column % 2) term = op("-", 0n, term);
		total = op("+", total, term);
	}
	return total;
}

const fromNumeric = (rows: NumericValue[][]): Matrix => new Matrix(rows as RuntimeValue[]);
