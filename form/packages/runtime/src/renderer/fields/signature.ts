/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 签名字段：只建宿主元素，部件由元素按标准结构生成；表单值是 UI 的签名数据 `{ strokes, surface }`，没有笔迹时为 `null`。

import type { JsonObject, JsonValue } from '@xihan-ui/core/json'
import type { SignaturePadPoint, SignaturePadStroke, SignaturePadValue } from '@xihan-ui/headless'
import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { EMPTY_SIGNATURE } from '@xihan-ui/headless'
import { applyControlState, assign, host } from '../dom'
import { on } from './shared'

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNumber(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 一个点：x、y 与压感都是有限数，否则为 `undefined`。 */
function pointOf(value: JsonValue): SignaturePadPoint | undefined {
  if (!isObject(value) || !isNumber(value.x) || !isNumber(value.y) || !isNumber(value.pressure))
    return undefined
  return { x: value.x, y: value.y, pressure: value.pressure }
}

/** 一笔：每个点都合法，否则为 `undefined`。 */
function strokeOf(value: JsonValue): SignaturePadStroke | undefined {
  if (!isObject(value) || !Array.isArray(value.points))
    return undefined
  const points = value.points.map(pointOf)
  return points.every(point => point !== undefined) ? { points: points as SignaturePadPoint[] } : undefined
}

/** 字段值里的签名数据；不是签名数据（含 `null`）时为空签名。 */
function signatureOf(value: JsonValue | undefined): SignaturePadValue {
  if (!isObject(value) || !Array.isArray(value.strokes) || !isObject(value.surface))
    return EMPTY_SIGNATURE
  const { width, height } = value.surface
  if (!isNumber(width) || !isNumber(height))
    return EMPTY_SIGNATURE
  const strokes = value.strokes.map(strokeOf)
  if (!strokes.every(stroke => stroke !== undefined))
    return EMPTY_SIGNATURE
  return { strokes: strokes as SignaturePadStroke[], surface: { width, height } }
}

/** UI 交回的签名数据写成字段值：一笔都没有时为 `null`。 */
function recordOf(value: SignaturePadValue): JsonValue {
  if (value.strokes.length === 0)
    return null
  return {
    strokes: value.strokes.map(stroke => ({ points: stroke.points.map(point => ({ x: point.x, y: point.y, pressure: point.pressure })) })),
    surface: { width: value.surface.width, height: value.surface.height },
  }
}

/** 签名：`xh-signature-pad`，落笔、撤销、重做与清空定稿后写回字段值；字段值换了一份才重写元素的 value。 */
export const signatureField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-signature-pad')
  const ref: ContextRef = { current: context }
  on<{ value: SignaturePadValue }>(element, 'value-change', detail => ref.current.setValue(recordOf(detail.value)))
  let shown: { value: JsonValue | undefined } | undefined
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    applyControlState(element, next.state)
    if (shown !== undefined && shown.value === next.value)
      return
    shown = { value: next.value }
    assign(element, 'value', signatureOf(next.value))
  }
  update(context)
  return { element, update }
}
