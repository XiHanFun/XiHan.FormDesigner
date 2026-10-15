import type { EngineEvaluation, ExpressionEngine } from '@xihan-ui/expression'

/** 求值表里的一项：固定结果，或用作用域算出结果的函数。 */
export type FakeValue = null | boolean | number | string | readonly unknown[] | { readonly [key: string]: unknown } | ((scope: Readonly<Record<string, unknown>>) => unknown)

/**
 * 测试用的表达式引擎：编译时源码含 `@@` 报 `XH_EXPR_UNEXPECTED_TOKEN`，其余一律通过；
 * 求值时从 `values` 表里按源码查结果，查不到报 `XH_EXPR_FUNCTION_FAILED`，结果是函数时用作用域调用它。
 */
export function createFakeEngine(values: Readonly<Record<string, FakeValue>> = {}): ExpressionEngine {
  return {
    compile: (source) => {
      if (source.includes('@@'))
        return { ok: false, issues: [{ code: 'XH_EXPR_UNEXPECTED_TOKEN', start: source.indexOf('@@'), end: source.indexOf('@@') + 2 }] }
      return {
        ok: true,
        references: [],
        evaluate: (scope): EngineEvaluation => {
          if (!Object.hasOwn(values, source))
            return { ok: false, issue: { code: 'XH_EXPR_FUNCTION_FAILED', start: 0, end: source.length } }
          const entry = values[source]
          return { ok: true, value: typeof entry === 'function' ? entry(scope) : entry }
        },
      }
    },
  }
}
