/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表达式求值：引擎由宿主注入，形状取 @xihan-ui/expression 的 ExpressionEngine；这里只放表单自己的运行时变量与按源码缓存的求值。

import type { EngineCompileResult, EngineEvaluation, ExpressionEngine } from '@xihan-ui/expression'

/** 运行时变量：当前字段的值、所在行与行号。 */
export const RUNTIME_VARIABLES = Object.freeze({
  value: '$value',
  row: '$row',
  index: '$index',
})

/**
 * 按源码缓存编译结果并求值；编译失败时以第一条问题作为求值失败。缓存只在一次联动或校验内使用。
 * 引擎编译失败却没有给出问题时抛 `TypeError`。
 */
export function evaluateSource(engine: ExpressionEngine, cache: Map<string, EngineCompileResult>, source: string, scope: Readonly<Record<string, unknown>>): EngineEvaluation {
  let compiled = cache.get(source)
  if (compiled === undefined) {
    compiled = engine.compile(source)
    cache.set(source, compiled)
  }
  if (compiled.ok)
    return compiled.evaluate(scope)
  const issue = compiled.issues[0]
  if (issue === undefined)
    throw new TypeError(`表达式引擎编译「${source}」失败却没有给出问题`)
  return { ok: false, issue }
}
