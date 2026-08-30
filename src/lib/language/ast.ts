import type { SourceSpan } from "./token";

export type Expression =
	| NumberLiteral | StringLiteral | IdentifierExpression | ArrayExpression
	| UnaryExpression | BinaryExpression | ConditionalExpression | CallExpression;

export interface NumberLiteral { kind: "number"; raw: string; span: SourceSpan }
export interface StringLiteral { kind: "string"; value: string; span: SourceSpan }
export interface IdentifierExpression { kind: "identifier"; name: string; span: SourceSpan }
export interface ArrayExpression { kind: "array"; elements: Expression[]; span: SourceSpan }
export interface UnaryExpression { kind: "unary"; operator: string; operand: Expression; span: SourceSpan }
export interface BinaryExpression { kind: "binary"; operator: string; left: Expression; right: Expression; implicit?: boolean; span: SourceSpan }
export interface ConditionalExpression { kind: "conditional"; condition: Expression; whenTrue: Expression; whenFalse: Expression; span: SourceSpan }
export interface CallExpression { kind: "call"; callee: Expression; args: Expression[]; span: SourceSpan }

export type Statement =
	| { kind: "empty"; span: SourceSpan }
	| { kind: "expression"; expression: Expression; span: SourceSpan }
	| { kind: "assignment"; name: string; value: Expression; span: SourceSpan };
