/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 变化范围：两份值、两组问题、两张状态表与两张选项表之间的差异。

import type { JsonValue, NodeState, ValueIssue } from '@xihan-form/core'
import type { DataPath } from './paths'
import { isPlainObject, jsonEqual } from '@xihan-form/core'

function collect(before: JsonValue | undefined, after: JsonValue | undefined, path: (string | number)[], out: DataPath[]): void {
  if (jsonEqual(before, after))
    return
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys)
      collect(before[key] as JsonValue | undefined, after[key] as JsonValue | undefined, [...path, key], out)
    return
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((item, index) => collect(item, after[index], [...path, index], out))
    return
  }
  out.push(path)
}

/** 两份表单值之间变化的路径：对象逐键、等长数组逐项比较，长度变了的数组整体报出。 */
export function changedValuePaths(before: Readonly<Record<string, JsonValue>>, after: Readonly<Record<string, JsonValue>>): DataPath[] {
  const out: DataPath[] = []
  collect(before as JsonValue, after as JsonValue, [], out)
  return out
}

function groupByPath(issues: readonly ValueIssue[]): Map<string, { path: DataPath, issues: ValueIssue[] }> {
  const groups = new Map<string, { path: DataPath, issues: ValueIssue[] }>()
  for (const issue of issues) {
    const key = JSON.stringify(issue.path)
    const group = groups.get(key)
    if (group === undefined)
      groups.set(key, { path: issue.path, issues: [issue] })
    else
      group.issues.push(issue)
  }
  return groups
}

/** 两组问题之间变化的路径：某条路径上的问题出现、消失或内容变了。 */
export function changedIssuePaths(before: readonly ValueIssue[], after: readonly ValueIssue[]): DataPath[] {
  const left = groupByPath(before)
  const right = groupByPath(after)
  const out: DataPath[] = []
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(key)
    const b = right.get(key)
    if (!jsonEqual((a?.issues ?? []) as unknown as JsonValue, (b?.issues ?? []) as unknown as JsonValue))
      out.push((a ?? b)!.path)
  }
  return out
}

/** 两张表之间变化的键：新增、删除或值不同。 */
export function changedKeys<T>(before: ReadonlyMap<string, T>, after: ReadonlyMap<string, T>, same: (a: T, b: T) => boolean): string[] {
  const out: string[] = []
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(key)
    const b = after.get(key)
    if (a === undefined || b === undefined || !same(a, b))
      out.push(key)
  }
  return out
}

/** 两个节点状态是否相同。 */
export function sameState(a: NodeState, b: NodeState): boolean {
  return a.hidden === b.hidden && a.disabled === b.disabled && a.readOnly === b.readOnly && a.required === b.required
}
