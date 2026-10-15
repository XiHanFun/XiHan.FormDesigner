/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 属性包类型、JSON 值判定与深冻结；JSON 值类型与通用函数取自 @xihan-ui/core/json。

import type { JsonValue } from '@xihan-ui/core/json'
import { findJsonViolation } from '@xihan-ui/core/json'

/** 属性包：一组按名字存放的 JSON 值。 */
export type PropertyBag = Readonly<Record<string, JsonValue>>

/** 是否为合法的 JSON 值：有限数字、字符串、布尔、null，以及由它们组成的数组与普通对象，不含循环引用。 */
export function isJsonValue(value: unknown): value is JsonValue {
  return findJsonViolation(value) === undefined
}

/** 深冻结并返回同一个值。 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value))
      deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}
