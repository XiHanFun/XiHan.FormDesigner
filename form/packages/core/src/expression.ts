/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表达式引擎接口：与 @xihan-ui/expression 的 ExpressionEngine 结构完全相同，这里只声明类型，实现由宿主注入。

/** 引擎报出的问题：问题码加源码区间，不带文案。 */
export interface ExpressionIssue {
  readonly code: string
  readonly start: number
  readonly end: number
  readonly data?: Readonly<Record<string, string | number>>
}

/** 求值结果：成功时是 JSON 能表示的普通 JS 值。 */
export type EngineEvaluation
  = | { readonly ok: true, readonly value: unknown }
    | { readonly ok: false, readonly issue: ExpressionIssue }

/** 编译成功的表达式。 */
export interface CompiledExpression {
  readonly ok: true
  /** 引用的顶层变量名，不含函数名。 */
  readonly references: readonly string[]
  readonly evaluate: (scope: Readonly<Record<string, unknown>>) => EngineEvaluation
}

/** 编译结果。 */
export type EngineCompileResult
  = | CompiledExpression
    | { readonly ok: false, readonly issues: readonly ExpressionIssue[] }

/** 编译选项。 */
export interface EngineCompileOptions {
  /** 可引用的顶层名字。 */
  readonly identifiers?: Iterable<string> | ((name: string) => boolean)
}

/** 表达式引擎。实现必须是确定性的：同样的源码与作用域永远得到同样的结果。 */
export interface ExpressionEngine {
  readonly compile: (source: string, options?: EngineCompileOptions) => EngineCompileResult
}

/** 运行时变量：当前字段的值、所在行与行号。 */
export const RUNTIME_VARIABLES = Object.freeze({
  value: '$value',
  row: '$row',
  index: '$index',
})

/** 按源码缓存编译结果并求值；编译失败时以第一条问题作为求值失败。缓存只在一次联动或校验内使用。 */
export function evaluateSource(engine: ExpressionEngine, cache: Map<string, EngineCompileResult>, source: string, scope: Readonly<Record<string, unknown>>): EngineEvaluation {
  let compiled = cache.get(source)
  if (compiled === undefined) {
    compiled = engine.compile(source)
    cache.set(source, compiled)
  }
  if (!compiled.ok)
    return { ok: false, issue: compiled.issues[0] ?? { code: 'XH_FORM_EXPRESSION_FAILED', start: 0, end: source.length } }
  return compiled.evaluate(scope)
}
