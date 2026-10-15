/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表达式引擎接口：模板里的条件与公式以源码字符串存放，检查与求值由注入的引擎完成。

/** 引擎报出的问题：问题码加源码区间，不带文案。 */
export interface ExpressionProblem {
  readonly code: string
  readonly start: number
  readonly end: number
}

/** 求值结果：成功时带 JS 值，失败时带问题。 */
export type ExpressionOutcome
  = | { readonly ok: true, readonly value: unknown }
    | { readonly ok: false, readonly problem: ExpressionProblem }

/** 表达式引擎。实现必须是确定性的：同样的源码与作用域永远得到同样的结果。 */
export interface ExpressionEngine {
  /** 静态检查源码；`identifiers` 是该位置可引用的顶层名字。没有问题时返回空数组。 */
  readonly check: (source: string, identifiers: readonly string[]) => readonly ExpressionProblem[]
  /** 在作用域上求值；作用域与结果都是 JSON 能表示的值。 */
  readonly evaluate: (source: string, scope: Readonly<Record<string, unknown>>) => ExpressionOutcome
}

/** 运行时变量：当前字段的值、所在行与行号。 */
export const RUNTIME_VARIABLES = Object.freeze({
  value: '$value',
  row: '$row',
  index: '$index',
})
