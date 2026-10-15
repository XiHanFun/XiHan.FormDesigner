import type { ExpressionEngine, ExpressionOutcome, ExpressionProblem } from '../src'

const NAME = /[A-Z_$][\w$]*/gi
const KEYWORDS = new Set(['true', 'false', 'null'])

/**
 * 测试用的表达式引擎：检查时把源码里不在名单里、也不是函数名的标识符报成 `UNKNOWN`，
 * 含 `@@` 时报 `SYNTAX`；求值时从 `values` 表里按源码查结果，查不到报 `MISSING`，
 * 结果是函数时用作用域调用它。记录每次调用，便于断言。
 */
export function createFakeEngine(values: Record<string, unknown | ((scope: Readonly<Record<string, unknown>>) => unknown)> = {}): ExpressionEngine & {
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
      for (const match of source.matchAll(NAME)) {
        const name = match[0]
        const after = source[match.index + name.length]
        const before = source[match.index - 1]
        if (KEYWORDS.has(name) || after === '(' || before === '.' || identifiers.includes(name))
          continue
        problems.push({ code: 'UNKNOWN', start: match.index, end: match.index + name.length })
      }
      return problems
    },
    evaluate: (source, scope): ExpressionOutcome => {
      evaluations.push({ source, scope })
      if (!Object.hasOwn(values, source))
        return { ok: false, problem: { code: 'MISSING', start: 0, end: source.length } }
      const entry = values[source]
      return { ok: true, value: typeof entry === 'function' ? (entry as (scope: Readonly<Record<string, unknown>>) => unknown)(scope) : entry }
    },
  }
}
