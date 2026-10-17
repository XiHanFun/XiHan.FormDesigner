/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 运行时层的扩展：在 core 层之上加字段、容器与静态元素的渲染；内置种类的渲染也写成一个扩展。

import type { FormCoreExtension, FormModel } from '@xihan-form/core'
import type { ContainerBuilder, StaticBuilder } from './renderer/containers'
import type { FieldRenderer } from './renderer/types'
import { createFormModel } from '@xihan-form/core'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { CONTAINER_BUILDERS, STATIC_BUILDERS } from './renderer/containers'
import { FORM_FIELD_RENDERERS } from './renderer/fields'

/**
 * 表单运行时层的扩展：core 层的全部字段，加上各种类的渲染，键是种类名。
 * 列表容器（子表单、子表）由渲染器自己按 xh-field-array 建，不经 containerRenderers。
 */
export interface FormRuntimeExtension extends FormCoreExtension {
  readonly fieldRenderers?: Readonly<Record<string, FieldRenderer>>
  readonly containerRenderers?: Readonly<Record<string, ContainerBuilder>>
  readonly staticRenderers?: Readonly<Record<string, StaticBuilder>>
}

/** 运行时层的内置扩展：内置种类的渲染。 */
export const FORM_RUNTIME_EXTENSION: FormRuntimeExtension = Object.freeze({
  id: '@xihan-form/runtime',
  fieldRenderers: FORM_FIELD_RENDERERS,
  containerRenderers: CONTAINER_BUILDERS,
  staticRenderers: STATIC_BUILDERS,
})

/** 一组运行时扩展合出的模型：core 模型加上按种类名查的三张渲染表。 */
export interface FormRuntimeModel extends FormModel {
  /** core 与运行时的内置扩展在前，传入的按顺序在后。 */
  readonly extensions: readonly FormRuntimeExtension[]
  readonly fieldRenderers: ReadonlyMap<string, FieldRenderer>
  readonly containerRenderers: ReadonlyMap<string, ContainerBuilder>
  readonly staticRenderers: ReadonlyMap<string, StaticBuilder>
}

const MODELS = new WeakMap<readonly FormRuntimeExtension[], FormRuntimeModel>()
const NO_EXTENSIONS: readonly FormRuntimeExtension[] = Object.freeze([])

/** 按种类名合一张渲染表；同一种类登记了两次时抛 DesignerExtensionError。 */
function rendererTable<R>(extensions: readonly FormRuntimeExtension[], space: string, pick: (extension: FormRuntimeExtension) => Readonly<Record<string, R>> | undefined): ReadonlyMap<string, R> {
  const table = new Map<string, R>()
  const owners = new Map<string, string>()
  for (const extension of extensions) {
    for (const [kind, renderer] of Object.entries(pick(extension) ?? {})) {
      const previous = owners.get(kind)
      if (previous !== undefined)
        throw new DesignerExtensionError(space, kind, [previous, extension.id])
      owners.set(kind, extension.id)
      table.set(kind, renderer)
    }
  }
  return table
}

/**
 * 合出运行时模型：core 的合并查重见 `createFormModel`，内置渲染 `FORM_RUNTIME_EXTENSION` 排在传入的之前；
 * 同一种类的渲染登记了两次时抛 `DesignerExtensionError`。同一个数组只合一次。
 */
export function createFormRuntimeModel(extensions: readonly FormRuntimeExtension[] = NO_EXTENSIONS): FormRuntimeModel {
  const cached = MODELS.get(extensions)
  if (cached !== undefined)
    return cached
  const core = createFormModel([FORM_RUNTIME_EXTENSION, ...extensions])
  const list = core.extensions as readonly FormRuntimeExtension[]
  const model: FormRuntimeModel = Object.freeze({
    ...core,
    extensions: list,
    fieldRenderers: rendererTable(list, 'field-renderer', extension => extension.fieldRenderers),
    containerRenderers: rendererTable(list, 'container-renderer', extension => extension.containerRenderers),
    staticRenderers: rendererTable(list, 'static-renderer', extension => extension.staticRenderers),
  })
  MODELS.set(extensions, model)
  return model
}
