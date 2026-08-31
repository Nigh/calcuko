import type { SourceSpan } from "./token";

export type Expression =
	| NumberLiteral | StringLiteral | IdentifierExpression | ArrayExpression
	| UnaryExpression | BinaryExpression | ConditionalExpression | CallExpression | LambdaExpression;

export interface NumberLiteral { kind: "number"; raw: string; span: SourceSpan }
export interface StringLiteral { kind: "string"; value: string; span: SourceSpan }
export interface IdentifierExpression { kind: "identifier"; name: string; span: SourceSpan }
export interface ArrayExpression { kind: "array"; elements: Expression[]; span: SourceSpan }
export interface UnaryExpression { kind: "unary"; operator: string; operand: Expression; span: SourceSpan }
export interface BinaryExpression { kind: "binary"; operator: string; left: Expression; right: Expression; implicit?: boolean; span: SourceSpan }
export interface ConditionalExpression { kind: "conditional"; condition: Expression; whenTrue: Expression; whenFalse: Expression; span: SourceSpan }
export interface CallExpression { kind: "call"; callee: Expression; args: Expression[]; span: SourceSpan }
export interface LambdaExpression { kind: "lambda"; parameters: string[]; body: Expression; span: SourceSpan }

export type Statement =
	| { kind: "empty"; span: SourceSpan }
	| { kind: "expression"; expression: Expression; span: SourceSpan }
	| { kind: "assignment"; name: string; value: Expression; span: SourceSpan }
	| { kind: "destructuringAssignment"; names: string[]; value: Expression; span: SourceSpan }
	| { kind: "functionDefinition"; name: string; parameters: string[]; body: Expression; span: SourceSpan };
