/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单 core 层的扩展：种类、表单设置的属性、编辑方式与规则；内置的种类与表单设置也写成一个扩展。
// 运行时层与设计器层的扩展在它之上再加渲染、命令与面板。

import type { DesignerExtensionCore, ExtensionKeySpaces } from '@xihan-ui/designer-kit'
import type { ControlKind } from '@xihan-ui/designer-kit/properties'
import type { FormSchemaIssue } from './issues'
import type { KindDefinition, KindRegistry } from './registry/kinds'
import type { FormPropertyDescriptor } from './registry/properties'
import type { FormDocument } from './schema'
import { extensionControls, mergeExtensions } from '@xihan-ui/designer-kit'
import { FORM_SETTING_PROPERTIES } from './create'
import { BUILTIN_KINDS } from './registry/builtin'
import { createKindRegistry } from './registry/kinds'
import { propertyName } from './registry/properties'

/** 规则拿到的上下文：合并后的种类登记表。 */
export interface FormRuleContext {
  readonly registry: KindRegistry
}

/**
 * 表单 core 层的扩展：种类（字段、容器、静态元素）、表单设置的属性、编辑方式与规则。
 * 运行时层与设计器层的扩展在它之上再加渲染、命令与面板，core 函数只读这里的字段。
 */
export interface FormCoreExtension extends DesignerExtensionCore<FormDocument, FormRuleContext> {
  /** 种类；种类名不能与内置的或别的扩展的重名。 */
  readonly kinds?: readonly KindDefinition[]
  /** 表单设置的属性，path 是设置里的名字，追加在内置之后；没选中任何节点时属性面板编辑它们。 */
  readonly documentProperties?: readonly FormPropertyDescriptor[]
  /** 这个扩展自己的问题码（规则与编辑方式给出的）的说明文字；返回 undefined 时交给设计器的文案。 */
  readonly issueText?: (issue: FormSchemaIssue) => string | undefined
}

/** 内置扩展：内置种类与表单设置。选项列表与选项树用 designer-kit 的内建编辑方式，不另登记。 */
export const FORM_CORE_EXTENSION: FormCoreExtension = Object.freeze({
  id: '@xihan-form/core',
  kinds: BUILTIN_KINDS,
  documentProperties: FORM_SETTING_PROPERTIES,
})

/** 表单各层扩展共用的名字空间：种类名与表单设置的属性名。 */
export const FORM_EXTENSION_SPACES: ExtensionKeySpaces<FormCoreExtension> = Object.freeze({
  'kind': extension => (extension.kinds ?? []).map(definition => definition.kind),
  'document-property': extension => (extension.documentProperties ?? []).map(propertyName),
})

/** 一组扩展合出的表单模型。 */
export interface FormModel {
  /** 内置扩展在前，传入的按顺序在后。 */
  readonly extensions: readonly FormCoreExtension[]
  /** 各扩展的种类按登记顺序合成的登记表。 */
  readonly registry: KindRegistry
  /** 表单设置的属性，内置在前。 */
  readonly documentProperties: readonly FormPropertyDescriptor[]
  /** 内建之外的编辑方式，交给 `checkFormPropertyValue`。 */
  readonly controls: Readonly<Record<string, ControlKind>>
  /** 问题的说明文字：按扩展顺序取第一个给出的；都不给时为 undefined。 */
  readonly issueText: (issue: FormSchemaIssue) => string | undefined
}

const MODELS = new WeakMap<readonly FormCoreExtension[], FormModel>()
const NO_EXTENSIONS: readonly FormCoreExtension[] = Object.freeze([])

/**
 * 合出表单模型：内置扩展 `FORM_CORE_EXTENSION` 在前，`extensions` 按顺序在后。
 * 扩展 id、种类名、表单设置的属性名、编辑方式等重名时抛 `DesignerExtensionError`；种类名不合规或容器区域个数的上下限不合法时抛 `TypeError`。
 * 同一个数组只合一次：元素把同一份 extensions 交给各个 core 函数时不重复合并。
 */
export function createFormModel(extensions: readonly FormCoreExtension[] = NO_EXTENSIONS): FormModel {
  const cached = MODELS.get(extensions)
  if (cached !== undefined)
    return cached
  const list = mergeExtensions([FORM_CORE_EXTENSION], extensions, FORM_EXTENSION_SPACES)
  const model: FormModel = Object.freeze({
    extensions: list,
    registry: createKindRegistry(list.flatMap(extension => extension.kinds ?? [])),
    documentProperties: Object.freeze(list.flatMap(extension => extension.documentProperties ?? [])),
    controls: extensionControls(list),
    issueText: (issue: FormSchemaIssue) => {
      for (const extension of list) {
        const text = extension.issueText?.(issue)
        if (text !== undefined)
          return text
      }
      return undefined
    },
  })
  MODELS.set(extensions, model)
  return model
}
