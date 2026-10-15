/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// JSON 值的类型、判定、深比较与深冻结。

/** JSON 标量。 */
export type JsonPrimitive = null | boolean | number | string

/** JSON 值：模板里出现的一切数据都是它。 */
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject

/** JSON 对象。 */
export interface JsonObject {
  readonly [key: string]: JsonValue
}

/** 属性包：一组按名字存放的 JSON 值。 */
export type PropertyBag = Readonly<Record<string, JsonValue>>

/** 是否为原型是 `Object.prototype` 或 `null` 的普通对象。 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** 是否为合法的 JSON 值：有限数字、字符串、布尔、null，以及由它们组成的数组与普通对象；深度不超过 `maxDepth`。 */
export function isJsonValue(value: unknown, maxDepth = 64): value is JsonValue {
  if (maxDepth < 0)
    return false
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (Array.isArray(value))
    return value.every(item => isJsonValue(item, maxDepth - 1))
  if (!isPlainObject(value))
    return false
  return Object.keys(value).every(key => isJsonValue(value[key], maxDepth - 1))
}

/** 深比较两个 JSON 值；对象按键集合比较，与键顺序无关。 */
export function jsonEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === b)
    return true
  if (a === undefined || b === undefined || a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
    return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false
    return a.every((item, index) => jsonEqual(item, b[index]))
  }
  const left = a as JsonObject
  const right = b as JsonObject
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length)
    return false
  return keys.every(key => Object.hasOwn(right, key) && jsonEqual(left[key], right[key]))
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
