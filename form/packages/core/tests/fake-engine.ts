import type { EngineEvaluation, ExpressionEngine, ExpressionIssue } from '../src'

const NAME = /[A-Z_$][\w$]*/gi
const KEYWORDS = new Set(['true', 'false', 'null'])

/** 求值表里的一项：固定结果，或用作用域算出结果的函数。 */
export type FakeValue = null | boolean | number | string | readonly unknown[] | { readonly [key: string]: unknown } | ((scope: Readonly<Record<string, unknown>>) => unknown)

/**
 * 测试用的表达式引擎：编译时源码含 `@@` 报 `SYNTAX`；给了名单时，把不在名单里、也不是函数名的标识符报成 `UNKNOWN`。
 * 求值时从 `values` 表里按源码查结果，查不到报 `MISSING`，结果是函数时用作用域调用它。
 * 带名单的编译记进 `checks`，求值记进 `evaluations`，便于断言。
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
    compile: (source, options = {}) => {
      const known = options.identifiers
      const isKnown = known === undefined ? undefined : typeof known === 'function' ? known : (name: string) => [...known].includes(name)
      if (known !== undefined)
        checks.push({ source, identifiers: typeof known === 'function' ? [] : [...known] })
      const issues: ExpressionIssue[] = []
      if (source.includes('@@'))
        issues.push({ code: 'SYNTAX', start: source.indexOf('@@'), end: source.indexOf('@@') + 2 })
      if (isKnown !== undefined) {
        for (const match of source.matchAll(NAME)) {
          const name = match[0]
          const after = source[match.index + name.length]
          const before = source[match.index - 1]
          if (KEYWORDS.has(name) || after === '(' || before === '.' || isKnown(name))
            continue
          issues.push({ code: 'UNKNOWN', start: match.index, end: match.index + name.length })
        }
      }
      if (issues.length > 0)
        return { ok: false, issues }
      return {
        ok: true,
        references: [],
        evaluate: (scope): EngineEvaluation => {
          evaluations.push({ source, scope })
          if (!Object.hasOwn(values, source))
            return { ok: false, issue: { code: 'MISSING', start: 0, end: source.length } }
          const entry = values[source]
          return { ok: true, value: typeof entry === 'function' ? entry(scope) : entry }
        },
      }
    },
  }
}
