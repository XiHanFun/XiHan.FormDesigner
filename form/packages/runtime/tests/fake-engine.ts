import type { ExpressionEngine, ExpressionOutcome, ExpressionProblem } from '@xihan-form/core'

/** 求值表里的一项：固定结果，或用作用域算出结果的函数。 */
export type FakeValue = null | boolean | number | string | readonly unknown[] | { readonly [key: string]: unknown } | ((scope: Readonly<Record<string, unknown>>) => unknown)

/**
 * 测试用的表达式引擎：检查时源码含 `@@` 报 `SYNTAX`，其余一律通过；求值时从 `values` 表里按源码查结果，查不到报 `MISSING`，
 * 结果是函数时用作用域调用它。记录每次调用，便于断言。
 */
export function createFakeEngine(values: Readonly<Record<string, FakeValue>> = {}): ExpressionEngine & {
  readonly checks: { source: string, identifiers: readonly string[] }[]
  readonly evaluations: { source: string, scope: Readonly<Record<string, unknown>> }[]
} {
  const checks: { source: string, identifiers: readonly string[] }[] = []
  const evaluations: { source: string, scope: Readonly<Record<string, unknown>> }[] = []
  return {
    checks,
    evaluations,
    check: (source, identifiers) => {
      checks.push({ source, identifiers })
      const problems: ExpressionProblem[] = []
      if (source.includes('@@'))
        problems.push({ code: 'SYNTAX', start: source.indexOf('@@'), end: source.indexOf('@@') + 2 })
      return problems
    },
    evaluate: (source, scope): ExpressionOutcome => {
      evaluations.push({ source, scope })
      if (!Object.hasOwn(values, source))
        return { ok: false, problem: { code: 'MISSING', start: 0, end: source.length } }
      const entry = values[source]
      return { ok: true, value: typeof entry === 'function' ? entry(scope) : entry }
    },
  }
}
